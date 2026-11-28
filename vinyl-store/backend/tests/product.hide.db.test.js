//these tests remove a record in the real database (docker must be running)
//they check what fake tests cannot: the row stays, carts are cleaned and order history still shows it

//load DATABASE_URL from .env so this file knows whether a database is available
require('dotenv').config();

//skip these tests where there is no database
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

//database calls are slower than fake ones, so allow up to 20 seconds per test
jest.setTimeout(20000);

describeIfDb('remove a record with the real database', () => {
  let prisma;
  let productService;
  let cartService;
  let wishlistService;
  let historyService;
  let checkoutService;
  let product;
  let customerId;
  let orderId;
  const userIds = [];
  const productIds = [];

  //a word only this test's record has, so search finds nothing else
  const searchWord = `HideTest${Date.now()}`;

  //card details as they arrive after route validation
  const card = {
    cardNumber: '4242424242424242',
    expiryMonth: 12,
    expiryYear: 2030,
    deliveryAddress: 'Test St 1',
  };

  beforeAll(async () => {
    //load prisma only when the tests really run, so a skipped run never touches the database
    prisma = require('../src/config/prisma');
    productService = require('../src/modules/products/product.service');
    cartService = require('../src/modules/cart/cart.service');
    wishlistService = require('../src/modules/wishlist/wishlist.service');
    historyService = require('../src/modules/orders/history.service');
    checkoutService = require('../src/modules/orders/checkout.service');

    //a throwaway record that is in a cart, a wish list and a delivered order
    const category = await prisma.category.findFirst();
    product = await prisma.product.create({
      data: {
        name: `${searchWord} Record`,
        model: 'Test',
        serialNumber: `HIDE-TEST-${Date.now()}-${Math.random()}`,
        quantity: 10,
        price: '100.00',
        warrantyStatus: 'None',
        distributor: 'Test',
        description: 'Only used by the remove record tests',
        categoryId: category.id,
      },
    });
    productIds.push(product.id);

    const user = await prisma.user.create({
      data: {
        name: 'Hide',
        lastname: 'Test',
        email: `hide-test-${Date.now()}-${Math.random()}@x.com`,
        passwordHash: 'not-a-real-hash',
        homeAddress: 'Test St 1',
      },
    });
    customerId = user.id;
    userIds.push(user.id);

    const order = await prisma.order.create({
      data: {
        userId: customerId,
        status: 'DELIVERED',
        totalPrice: '100.00',
        deliveryAddress: 'Test St 1',
        cardLast4: '4242',
        items: {
          create: { productId: product.id, quantity: 1, unitPrice: '100.00', unitCost: '50.00' },
        },
      },
    });
    orderId = order.id;

    await cartService.addItem(customerId, product.id, 2);
    await wishlistService.addToWishList(customerId, product.id);

    //checked before removing, so the tests below show what removing changed
    expect((await cartService.getCart(customerId)).items).toHaveLength(1);

    expect(await productService.removeProduct(product.id)).toEqual({
      id: product.id,
      removed: true,
    });
  });

  afterAll(async () => {
    //carts and wish lists are deleted with their user (onDelete: Cascade)
    //orders must go before users and the product they point to
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.$disconnect();
  });

  //test 1: the row is still there, only hidden, and its stock is unchanged
  it('keeps the product row', async () => {
    const row = await prisma.product.findUnique({ where: { id: product.id } });
    expect(row).toMatchObject({ id: product.id, isHidden: true, quantity: 10 });
  });

  //test 2: the record is gone from the catalog, search, every sort and the product page
  it('leaves the record out of the list, search and detail', async () => {
    const ids = (list) => list.map((p) => p.id);

    expect(ids(await productService.getProducts())).not.toContain(product.id);
    expect(await productService.getProducts({ search: searchWord })).toEqual([]);
    for (const sort of ['price_asc', 'price_desc', 'newest', 'featured', 'popularity']) {
      expect(ids(await productService.getProducts({ sort }))).not.toContain(product.id);
    }
    expect(await productService.getProductById(product.id)).toBeNull();
  });

  //test 3: removing it again gives 404
  it('gives 404 when the record is removed a second time', async () => {
    await expect(productService.removeProduct(product.id)).rejects.toMatchObject({
      status: 404,
      message: 'Product not found',
    });
  });

  //test 4: the cart item was deleted when the record was removed
  it('deletes the record from the cart', async () => {
    expect(await prisma.cartItem.count({ where: { productId: product.id } })).toBe(0);
    expect((await cartService.getCart(customerId)).items).toEqual([]);
  });

  //test 5: the wish list row is kept but not shown, and it can still be removed
  it('hides the record in the wish list without deleting the row', async () => {
    expect((await wishlistService.getWishList(customerId)).items).toEqual([]);
    expect(await prisma.wishListItem.count({ where: { productId: product.id } })).toBe(1);
  });

  //test 6: order history still shows the record the customer bought
  it('keeps the record in order history', async () => {
    const order = await historyService.getOrder(customerId, orderId);
    expect(order.items).toEqual([
      expect.objectContaining({ productId: product.id, name: `${searchWord} Record` }),
    ]);
  });

  //test 7: an add that raced the removal puts the item back, the next cart load cleans it
  it('cleans a cart item inserted after hiding on the next cart load', async () => {
    const cart = await prisma.cart.findUnique({ where: { userId: customerId } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 1 } });

    expect((await cartService.getCart(customerId)).items).toEqual([]);
    expect(await prisma.cartItem.count({ where: { productId: product.id } })).toBe(0);
  });

  //test 8: checkout rejects the stale item and rolls back, so the next cart load removes it
  it('rejects checkout with a hidden record, then the cart load removes it', async () => {
    const cart = await prisma.cart.findUnique({ where: { userId: customerId } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 1 } });

    await expect(checkoutService.checkout(customerId, card)).rejects.toMatchObject({
      status: 409,
      message: 'A product in your cart is no longer available',
    });
    //the transaction rolled back, so the item is still there and no order was made
    expect(await prisma.cartItem.count({ where: { productId: product.id } })).toBe(1);
    expect(await prisma.order.count({ where: { userId: customerId } })).toBe(1);
    expect((await prisma.product.findUnique({ where: { id: product.id } })).quantity).toBe(10);

    expect((await cartService.getCart(customerId)).items).toEqual([]);
    expect(await prisma.cartItem.count({ where: { productId: product.id } })).toBe(0);
  });

  //test 9: new items, stock changes and ratings on the hidden record are refused
  it('refuses new cart, wish list, stock and rating changes on the hidden record', async () => {
    await expect(cartService.addItem(customerId, product.id, 1)).rejects.toMatchObject({
      status: 404,
    });
    await expect(productService.updateStock(product.id, 5)).rejects.toMatchObject({
      status: 404,
    });

    //the delivered order of a hidden record no longer counts, so rating it gets 404
    const ratingService = require('../src/modules/reviews/rating.service');
    await expect(ratingService.rateProduct(customerId, product.id, 5)).rejects.toMatchObject({
      status: 404,
    });

    //the wish list already has it, so remove it and try adding it back
    await wishlistService.removeFromWishList(customerId, product.id);
    await expect(wishlistService.addToWishList(customerId, product.id)).rejects.toMatchObject({
      status: 404,
    });
  });
});
