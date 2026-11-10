//these tests run checkout against the real database (docker must be running)
//they check what fake tests cannot: customers buying at the same moment, and the real tables

//load DATABASE_URL from .env so this file knows whether a database is available
require('dotenv').config();

//skip these tests where there is no database
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

//database calls are slower than fake ones, so allow up to 20 seconds per test
jest.setTimeout(20000);

//the invoice email only logs in development, silence it here
jest.mock('../src/modules/invoices/invoice.email', () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue({ sent: true }),
}));

const card = { cardNumber: '4242424242424242', expiryMonth: 12, expiryYear: 2099, deliveryAddress: 'Test St 1' };

//turns the results of several checkouts into short text, e.g. ["ok", "409 Not enough stock ..."]
//so a failing test shows the real error message instead of only a count
function summarize(results) {
  return results
    .map((r) => (r.status === 'fulfilled' ? 'ok' : `${r.reason.status} ${r.reason.message}`))
    .sort();
}

describeIfDb('checkout with the real database', () => {
  let prisma;
  let checkoutService;
  let product;
  const userIds = [];

  //makes a throwaway customer with the given cart, so seeded accounts are not touched
  async function customerWithCart(quantity) {
    const user = await prisma.user.create({
      data: {
        name: 'Checkout',
        lastname: 'Test',
        email: `checkout-test-${Date.now()}-${Math.random()}@x.com`,
        passwordHash: 'not-a-real-hash',
        cart: { create: { items: { create: { productId: product.id, quantity } } } },
      },
    });
    userIds.push(user.id);
    return user.id;
  }

  //sets the test product's stock before each test
  async function setStock(quantity) {
    await prisma.product.update({ where: { id: product.id }, data: { quantity } });
  }

  async function stockNow() {
    const row = await prisma.product.findUnique({ where: { id: product.id } });
    return row.quantity;
  }

  beforeAll(async () => {
    //load prisma only when the tests really run, so a skipped run never touches the database
    prisma = require('../src/config/prisma');
    checkoutService = require('../src/modules/orders/checkout.service');

    //a test product of our own, so other test files using seeded products are not affected
    const category = await prisma.category.findFirst();
    product = await prisma.product.create({
      data: {
        name: 'Checkout Test Record',
        model: 'Test',
        serialNumber: `CHECKOUT-TEST-${Date.now()}`,
        quantity: 1,
        price: '100.00',
        warrantyStatus: 'None',
        distributor: 'Test',
        description: 'Only used by checkout tests',
        categoryId: category.id,
      },
    });
  });

  afterAll(async () => {
    //orders must go before users and the product they point to
    //order items, payments and invoices are deleted with their order (onDelete: Cascade)
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.$disconnect();
  });

  //test 1: one customer checks out, the order, payment and stock are saved in the real tables
  it('checks out a cart', async () => {
    await setStock(5);
    const userId = await customerWithCart(2);

    const order = await checkoutService.checkout(userId, card);

    expect(order).toMatchObject({ status: 'PROCESSING', totalPrice: 200, cardLast4: '4242' });
    expect(await stockNow()).toBe(3);
    const saved = await prisma.order.findUnique({ where: { id: order.id }, include: { payment: true, items: true } });
    expect(saved.payment.status).toBe('SUCCESSFUL');
    expect(saved.items).toHaveLength(1);
    const cartLeft = await prisma.cartItem.findMany({ where: { cart: { userId } } });
    expect(cartLeft).toHaveLength(0);
  });

  //test 2: two customers check out the last copy at the same moment, only one gets it (requirement 18)
  it('sells the last copy only once', async () => {
    await setStock(1);
    const first = await customerWithCart(1);
    const second = await customerWithCart(1);

    const results = await Promise.allSettled([
      checkoutService.checkout(first, card),
      checkoutService.checkout(second, card),
    ]);

    //one order succeeds, the other is rejected because stock ran out, and stock never goes below 0
    expect(summarize(results)).toEqual(['409 Not enough stock for "Checkout Test Record"', 'ok']);
    expect(await stockNow()).toBe(0);
  });

  //test 3: a double click sends the same checkout twice, only one order is made
  it('makes one order when the same cart is checked out twice at once', async () => {
    await setStock(5);
    const userId = await customerWithCart(2);

    const results = await Promise.allSettled([
      checkoutService.checkout(userId, card),
      checkoutService.checkout(userId, card),
    ]);

    //one succeeds, the other finds the cart already empty, and stock went down once
    expect(summarize(results)).toEqual(['400 Your cart is empty', 'ok']);
    expect(await stockNow()).toBe(3);
    const orders = await prisma.order.findMany({ where: { userId } });
    expect(orders).toHaveLength(1);
  });

  //test 4: a declined card leaves stock and cart as they were
  it('rolls back stock and cart when the card is declined', async () => {
    await setStock(3);
    const userId = await customerWithCart(2);

    await expect(
      checkoutService.checkout(userId, { ...card, cardNumber: '4000000000000002' })
    ).rejects.toMatchObject({ status: 402 });

    expect(await stockNow()).toBe(3);
    const items = await prisma.cartItem.findMany({ where: { cart: { userId } } });
    expect(items).toHaveLength(1);
    const orders = await prisma.order.findMany({ where: { userId } });
    expect(orders).toHaveLength(0);
  });
});
