//these tests run the cart service against the real database (docker must be running)
//they check things fake tests cannot, like many requests arriving at the same moment

//load DATABASE_URL from .env so this file knows whether a database is available
require('dotenv').config();

//skip these tests where there is no database, e.g. in CI
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

//database calls are slower than fake ones, so allow up to 20 seconds per test
jest.setTimeout(20000);

describeIfDb('cart service with the real database', () => {
  let prisma;
  let cartService;
  let userId;
  let plenty;
  let lowStock;
  let outOfStock;

  beforeAll(async () => {
    //load prisma only when the tests really run, so a skipped run never touches the database
    prisma = require('../src/config/prisma');
    cartService = require('../src/modules/cart/cart.service');

    //a throwaway customer so the seeded test accounts are not touched
    const user = await prisma.user.create({
      data: { name: 'Cart', lastname: 'Test', email: `cart-test-${Date.now()}@x.com`, passwordHash: 'not-a-real-hash' },
    });
    userId = user.id;

    //seeded products: one with plenty of stock, one with little, one with none
    plenty = await prisma.product.findFirst({ where: { name: 'Discovery' } });
    lowStock = await prisma.product.findFirst({ where: { name: 'Direct-Drive DJ Turntable' } });
    outOfStock = await prisma.product.findFirst({ where: { name: 'Surrender' } });
  });

  afterEach(async () => {
    //empty the test user's cart between tests
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
  });

  afterAll(async () => {
    //deleting the user also deletes their cart and items (onDelete: Cascade in the schema)
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  //test 1: adding saves the item and the total uses the real price
  it('adds an item and calculates the total', async () => {
    const cart = await cartService.addItem(userId, plenty.id, 2);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
    expect(cart.total).toBe(Math.round(Number(plenty.price) * 2 * 100) / 100);
  });

  //test 2: out of stock products are rejected
  it('rejects an out of stock product', async () => {
    await expect(cartService.addItem(userId, outOfStock.id, 1)).rejects.toMatchObject({ status: 409 });
  });

  //test 3: many add requests at the same moment never push the cart above stock (requirement 18)
  it('never goes above stock when many requests arrive at once', async () => {
    const stock = lowStock.quantity;
    const requests = Array.from({ length: stock + 5 }, () => cartService.addItem(userId, lowStock.id, 1));
    const results = await Promise.allSettled(requests);

    //exactly "stock" requests succeed, the rest are rejected with 409
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(stock);
    expect(results.filter((r) => r.status === 'rejected').every((r) => r.reason.status === 409)).toBe(true);

    const cart = await cartService.getCart(userId);
    expect(cart.items[0].quantity).toBe(stock);
  });

  //test 4: merging caps quantities at stock and skips out of stock products
  it('merges a browser cart with stock limits', async () => {
    const result = await cartService.mergeCart(userId, [
      { productId: lowStock.id, quantity: lowStock.quantity + 2 },
      { productId: outOfStock.id, quantity: 1 },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(lowStock.quantity);
    expect(result.adjustments).toHaveLength(2);
  });

  //test 5: an item can be changed and then removed
  it('updates and removes an item', async () => {
    await cartService.addItem(userId, plenty.id, 1);
    const updated = await cartService.updateItem(userId, plenty.id, 3);
    expect(updated.items[0].quantity).toBe(3);
    const emptied = await cartService.removeItem(userId, plenty.id);
    expect(emptied.items).toEqual([]);
  });
});