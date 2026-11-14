//these tests cancel real orders in the real database (docker must be running)
//they check what fake tests cannot: stock really comes back, and a double cancel gives it back only once

//load DATABASE_URL from .env so this file knows whether a database is available
require('dotenv').config();

//skip these tests where there is no database
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

//database calls are slower than fake ones, so allow up to 20 seconds per test
jest.setTimeout(20000);

//checkout emails the invoice, silence it here
jest.mock('../src/modules/invoices/invoice.email', () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue({ sent: false }),
}));

const card = {
  cardNumber: '4242424242424242',
  expiryMonth: 12,
  expiryYear: 2099,
  deliveryAddress: 'Test St 1',
};

//turns the results of several requests into short text, e.g. ["ok", "409 ..."]
//so a failing test shows the real error message instead of only a count
function summarize(results) {
  return results
    .map((r) => (r.status === 'fulfilled' ? 'ok' : `${r.reason.status} ${r.reason.message}`))
    .sort();
}

describeIfDb('cancel order with the real database', () => {
  let prisma;
  let checkoutService;
  let cancelService;
  let product;
  const userIds = [];

  //makes a throwaway customer who has just bought `quantity` copies of the test product
  async function customerWithOrder(quantity) {
    const user = await prisma.user.create({
      data: {
        name: 'Cancel',
        lastname: 'Test',
        email: `cancel-test-${Date.now()}-${Math.random()}@x.com`,
        passwordHash: 'not-a-real-hash',
        cart: { create: { items: { create: { productId: product.id, quantity } } } },
      },
    });
    userIds.push(user.id);
    const order = await checkoutService.checkout(user.id, card);
    return { userId: user.id, orderId: order.id };
  }

  async function stockNow() {
    const row = await prisma.product.findUnique({ where: { id: product.id } });
    return row.quantity;
  }

  beforeAll(async () => {
    //load prisma only when the tests really run, so a skipped run never touches the database
    prisma = require('../src/config/prisma');
    checkoutService = require('../src/modules/orders/checkout.service');
    cancelService = require('../src/modules/orders/cancel.service');

    //a test product of our own, so other test files using seeded products are not affected
    const category = await prisma.category.findFirst();
    product = await prisma.product.create({
      data: {
        name: 'Cancel Test Record',
        model: 'Test',
        serialNumber: `CANCEL-TEST-${Date.now()}`,
        quantity: 10,
        price: '100.00',
        warrantyStatus: 'None',
        distributor: 'Test',
        description: 'Only used by cancel tests',
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

  //test 1: cancelling gives the stock back and refunds the payment
  it('cancels an order, gives stock back and refunds the payment', async () => {
    const before = await stockNow();
    const { userId, orderId } = await customerWithOrder(3);
    expect(await stockNow()).toBe(before - 3);

    const result = await cancelService.cancelOrder(userId, orderId);

    expect(result).toMatchObject({ id: orderId, status: 'CANCELLED', refundedAmount: 300 });
    expect(await stockNow()).toBe(before);
    const saved = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    expect(saved.status).toBe('CANCELLED');
    expect(saved.payment.status).toBe('REFUNDED');
  });

  //test 2: a double click sends the cancel twice, the stock comes back only once
  it('gives the stock back only once when cancelled twice at the same moment', async () => {
    const before = await stockNow();
    const { userId, orderId } = await customerWithOrder(2);

    const results = await Promise.allSettled([
      cancelService.cancelOrder(userId, orderId),
      cancelService.cancelOrder(userId, orderId),
    ]);

    expect(summarize(results)).toEqual([
      '409 Only orders that are processing can be cancelled, this order is CANCELLED',
      'ok',
    ]);
    expect(await stockNow()).toBe(before);
  });

  //test 3: an order that is already in transit cannot be cancelled, nothing changes
  it('does not cancel an order that is in transit', async () => {
    const { userId, orderId } = await customerWithOrder(1);
    await prisma.order.update({ where: { id: orderId }, data: { status: 'IN_TRANSIT' } });
    const before = await stockNow();

    await expect(cancelService.cancelOrder(userId, orderId)).rejects.toMatchObject({ status: 409 });

    expect(await stockNow()).toBe(before);
    const saved = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    expect(saved.status).toBe('IN_TRANSIT');
    expect(saved.payment.status).toBe('SUCCESSFUL');
  });

  //test 4: a customer cannot cancel someone else's order
  it("does not cancel another customer's order", async () => {
    const owner = await customerWithOrder(1);
    const other = await customerWithOrder(1);

    await expect(cancelService.cancelOrder(other.userId, owner.orderId)).rejects.toMatchObject({
      status: 404,
    });

    const saved = await prisma.order.findUnique({ where: { id: owner.orderId } });
    expect(saved.status).toBe('PROCESSING');
  });
});
