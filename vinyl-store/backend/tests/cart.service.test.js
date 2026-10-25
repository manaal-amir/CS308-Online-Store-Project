//replace the real prisma client with fake functions, so these tests need no database
jest.mock('../src/config/prisma', () => ({
  cart: { upsert: jest.fn(), findUnique: jest.fn() },
  product: { findUnique: jest.fn(), findMany: jest.fn() },
  cartItem: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));

const prisma = require('../src/config/prisma');
const cartService = require('../src/modules/cart/cart.service');

//fake products, similar to the seed data
const inStock = { id: 1, name: 'Discovery', price: 2390, quantity: 5, imageUrl: null, artist: { name: 'Daft Punk' } };
const outOfStock = { id: 2, name: 'Surrender', price: 1790, quantity: 0, imageUrl: null, artist: null };

//sets what the cart looks like when it is reloaded at the end of each action
function cartContains(items) {
  prisma.cart.findUnique.mockResolvedValue({ id: 10, items });
}

beforeEach(() => {
  jest.resetAllMocks();
  //every user already has cart 10, and it is empty unless a test says otherwise
  prisma.cart.upsert.mockResolvedValue({ id: 10, userId: 7 });
  cartContains([]);
  //the fake transaction just waits for all the writes it was given
  prisma.$transaction.mockImplementation((writes) => Promise.all(writes));
});

describe('getCart', () => {
  //test 1: an empty cart has no items and a total of 0
  it('returns an empty cart', async () => {
    const cart = await cartService.getCart(7);
    expect(cart).toEqual({ items: [], itemCount: 0, total: 0 });
  });

  //test 2: line totals, item count and total are calculated, decimals become numbers
  it('calculates line totals and the cart total', async () => {
    cartContains([
      { productId: 1, quantity: 2, product: { ...inStock, price: { toString: () => '19.99' } } },
      { productId: 3, quantity: 1, product: { id: 3, name: 'Post', price: 10.01, quantity: 4, imageUrl: null, artist: null } },
    ]);
    const cart = await cartService.getCart(7);
    expect(cart.items[0].lineTotal).toBe(39.98);
    expect(cart.items[0].artist).toBe('Daft Punk');
    expect(cart.items[1].artist).toBeNull();
    expect(cart.itemCount).toBe(3);
    expect(cart.total).toBe(49.99);
  });

  //test 3: two first requests at once both try to create the cart, the second loads it instead
  it('loads the cart if another request created it at the same moment', async () => {
    prisma.cart.upsert.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    prisma.cart.findUnique
      .mockResolvedValueOnce({ id: 10, userId: 7 })
      .mockResolvedValueOnce({ id: 10, items: [] });
    const cart = await cartService.getCart(7);
    expect(cart.items).toEqual([]);
  });
});

describe('addItem', () => {
  //test 4: a product already in the cart is increased, but only while it stays within stock
  it('increases an existing item with a stock check in the same query', async () => {
    prisma.product.findUnique.mockResolvedValue(inStock);
    prisma.cartItem.updateMany.mockResolvedValue({ count: 1 });
    await cartService.addItem(7, 1, 2);
    expect(prisma.cartItem.updateMany).toHaveBeenCalledWith({
      where: { cartId: 10, productId: 1, quantity: { lte: 3 } },
      data: { quantity: { increment: 2 } },
    });
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });

  //test 5: a product that is not in the cart yet is created
  it('creates a new item when the product is not in the cart', async () => {
    prisma.product.findUnique.mockResolvedValue(inStock);
    prisma.cartItem.updateMany.mockResolvedValue({ count: 0 });
    prisma.cartItem.findUnique.mockResolvedValue(null);
    await cartService.addItem(7, 1, 2);
    expect(prisma.cartItem.create).toHaveBeenCalledWith({ data: { cartId: 10, productId: 1, quantity: 2 } });
  });

  //test 6: unknown products give 404
  it('rejects a product that does not exist', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(cartService.addItem(7, 999, 1)).rejects.toMatchObject({ status: 404 });
  });

  //test 7: out of stock products cannot be added (requirement 7)
  it('rejects an out of stock product', async () => {
    prisma.product.findUnique.mockResolvedValue(outOfStock);
    await expect(cartService.addItem(7, 2, 1)).rejects.toMatchObject({
      status: 409,
      message: 'Product is out of stock',
    });
    expect(prisma.cartItem.updateMany).not.toHaveBeenCalled();
  });

  //test 8: asking for more than the stock in one go is rejected without touching the cart
  it('rejects a single request above stock', async () => {
    prisma.product.findUnique.mockResolvedValue(inStock);
    await expect(cartService.addItem(7, 1, 6)).rejects.toMatchObject({ status: 409, message: 'Only 5 in stock' });
    expect(prisma.cartItem.updateMany).not.toHaveBeenCalled();
  });

  //test 9: if the item exists but the new total would pass stock, nothing changes
  it('rejects adding more when the cart already holds most of the stock', async () => {
    prisma.product.findUnique.mockResolvedValue(inStock);
    prisma.cartItem.updateMany.mockResolvedValue({ count: 0 });
    prisma.cartItem.findUnique.mockResolvedValue({ id: 50, quantity: 4 });
    await expect(cartService.addItem(7, 1, 2)).rejects.toMatchObject({ status: 409, message: 'Only 5 in stock' });
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });

  //test 10: two requests at once both try to create the item, the second one increases it instead
  it('handles a double click that creates the item at the same time', async () => {
    prisma.product.findUnique.mockResolvedValue(inStock);
    prisma.cartItem.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    prisma.cartItem.findUnique.mockResolvedValue(null);
    prisma.cartItem.create.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    await cartService.addItem(7, 1, 1);
    expect(prisma.cartItem.updateMany).toHaveBeenCalledTimes(2);
  });

  //test 11: database errors other than the duplicate case are not hidden
  it('passes on other database errors', async () => {
    prisma.product.findUnique.mockResolvedValue(inStock);
    prisma.cartItem.updateMany.mockResolvedValue({ count: 0 });
    prisma.cartItem.findUnique.mockResolvedValue(null);
    prisma.cartItem.create.mockRejectedValue(new Error('connection lost'));
    await expect(cartService.addItem(7, 1, 1)).rejects.toThrow('connection lost');
  });
});

describe('updateItem', () => {
  //test 12: the quantity is set to the exact new number
  it('sets a new quantity', async () => {
    prisma.cartItem.findUnique.mockResolvedValue({ id: 50, quantity: 1, product: inStock });
    await cartService.updateItem(7, 1, 4);
    expect(prisma.cartItem.update).toHaveBeenCalledWith({ where: { id: 50 }, data: { quantity: 4 } });
  });

  //test 13: updating a product that is not in the cart gives 404
  it('rejects updating an item that is not in the cart', async () => {
    prisma.cartItem.findUnique.mockResolvedValue(null);
    await expect(cartService.updateItem(7, 1, 2)).rejects.toMatchObject({ status: 404 });
  });

  //test 14: the new quantity cannot go above stock
  it('rejects a quantity above stock', async () => {
    prisma.cartItem.findUnique.mockResolvedValue({ id: 50, quantity: 1, product: inStock });
    await expect(cartService.updateItem(7, 1, 6)).rejects.toMatchObject({ status: 409 });
    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });
});

describe('removeItem', () => {
  //test 15: removing an item deletes it from this user's cart only
  it('removes an item from the cart', async () => {
    prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
    await cartService.removeItem(7, 1);
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 10, productId: 1 } });
  });

  //test 16: removing something that is not there gives 404
  it('rejects removing an item that is not in the cart', async () => {
    prisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });
    await expect(cartService.removeItem(7, 1)).rejects.toMatchObject({ status: 404 });
  });
});

describe('mergeCart', () => {
  //test 17: browser items are saved to the database cart in one transaction
  it('adds browser cart items in a single transaction', async () => {
    prisma.product.findMany.mockResolvedValue([inStock]);
    prisma.cartItem.findMany.mockResolvedValue([]);
    const result = await cartService.mergeCart(7, [{ productId: 1, quantity: 2 }]);
    expect(prisma.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { cartId: 10, productId: 1, quantity: 2 } })
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.adjustments).toEqual([]);
  });

  //test 18: browser and database quantities are added together but capped at stock
  it('caps merged quantities at stock and reports it', async () => {
    prisma.product.findMany.mockResolvedValue([inStock]);
    prisma.cartItem.findMany.mockResolvedValue([{ productId: 1, quantity: 3 }]);
    const result = await cartService.mergeCart(7, [{ productId: 1, quantity: 4 }]);
    expect(prisma.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { quantity: 5 } })
    );
    expect(result.adjustments).toEqual([{ productId: 1, reason: 'Only 5 in stock' }]);
  });

  //test 19: the same product twice in the browser cart is combined
  it('combines duplicate products from the browser cart', async () => {
    prisma.product.findMany.mockResolvedValue([inStock]);
    prisma.cartItem.findMany.mockResolvedValue([]);
    await cartService.mergeCart(7, [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 2 }]);
    expect(prisma.cartItem.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { cartId: 10, productId: 1, quantity: 3 } })
    );
  });

  //test 20: missing and out of stock products are skipped and reported
  it('skips missing and out of stock products', async () => {
    prisma.product.findMany.mockResolvedValue([outOfStock]);
    prisma.cartItem.findMany.mockResolvedValue([]);
    const result = await cartService.mergeCart(7, [{ productId: 2, quantity: 1 }, { productId: 999, quantity: 1 }]);
    expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
    expect(result.adjustments).toEqual([
      { productId: 2, reason: 'Product is out of stock' },
      { productId: 999, reason: 'Product not found' },
    ]);
  });

  //test 21: an empty browser cart just returns the current cart
  it('accepts an empty list', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.cartItem.findMany.mockResolvedValue([]);
    const result = await cartService.mergeCart(7, []);
    expect(result.items).toEqual([]);
  });

  //test 22: anything that is not a list is rejected
  it('rejects items that are not a list', async () => {
    await expect(cartService.mergeCart(7, 'abc')).rejects.toMatchObject({ status: 400 });
  });

  //test 23: each item needs a valid productId and quantity within database limits
  it('rejects invalid items', async () => {
    await expect(cartService.mergeCart(7, [{ productId: 1, quantity: 0 }])).rejects.toMatchObject({ status: 400 });
    await expect(cartService.mergeCart(7, [{ productId: '1', quantity: 1 }])).rejects.toMatchObject({ status: 400 });
    await expect(cartService.mergeCart(7, [{ productId: 3000000000, quantity: 1 }])).rejects.toMatchObject({ status: 400 });
    await expect(cartService.mergeCart(7, [null])).rejects.toMatchObject({ status: 400 });
  });

  //test 24: very long lists are rejected
  it('rejects more than 100 items', async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({ productId: i + 1, quantity: 1 }));
    await expect(cartService.mergeCart(7, items)).rejects.toMatchObject({ status: 400 });
  });
});