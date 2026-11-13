//tests for cancelling an order with a fake database, so no docker is needed
//the real database test (cancel.db.test.js) checks stock and double cancels for real

//replace prisma with fake functions
jest.mock('../src/config/prisma', () => ({ $transaction: jest.fn() }));

const prisma = require('../src/config/prisma');
const { cancelOrder } = require('../src/modules/orders/cancel.service');

//a processing order with two products, higher product id first to check the stock order
const savedOrder = {
  id: 42,
  userId: 7,
  status: 'CANCELLED',
  totalPrice: '7500.99',
  items: [
    { productId: 5, quantity: 2, product: { name: 'Discovery' } },
    { productId: 2, quantity: 1, product: { name: 'Turntable' } },
  ],
};

//a fake transaction object, every test changes the parts it needs
let tx;

beforeEach(() => {
  jest.resetAllMocks();
  tx = {
    order: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      //first call loads the cancelled order, cancelError uses it to explain a failed cancel
      findUnique: jest.fn().mockResolvedValue(savedOrder),
    },
    product: { update: jest.fn().mockResolvedValue({}) },
    payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  //run the transaction callback with the fake tx, like prisma does
  prisma.$transaction.mockImplementation((callback) => callback(tx));
});

describe('cancel order service', () => {
  //test 1: a processing order is cancelled and the result is returned
  it('cancels a processing order', async () => {
    const result = await cancelOrder(7, 42);
    expect(result).toEqual({
      id: 42,
      status: 'CANCELLED',
      totalPrice: 7500.99,
      refundedAmount: 7500.99,
      items: [
        { productId: 5, name: 'Discovery', quantity: 2 },
        { productId: 2, name: 'Turntable', quantity: 1 },
      ],
    });
  });

  //test 2: the status only changes if the order is this customer's and still processing, in one step
  it('changes the status only for the owner while processing', async () => {
    await cancelOrder(7, 42);
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 42, userId: 7, status: 'PROCESSING' },
      data: { status: 'CANCELLED' },
    });
  });

  //test 3: every product gets its stock back, in product id order
  it('gives the stock back in product id order', async () => {
    await cancelOrder(7, 42);
    expect(tx.product.update.mock.calls.map((call) => call[0])).toEqual([
      { where: { id: 2 }, data: { quantity: { increment: 1 } } },
      { where: { id: 5 }, data: { quantity: { increment: 2 } } },
    ]);
  });

  //test 4: the payment is marked as refunded
  it('marks the payment as refunded', async () => {
    await cancelOrder(7, 42);
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { orderId: 42, status: 'SUCCESSFUL' },
      data: { status: 'REFUNDED' },
    });
  });

  //test 5: an order that does not exist gives 404
  it('rejects an order that does not exist', async () => {
    tx.order.updateMany.mockResolvedValue({ count: 0 });
    tx.order.findUnique.mockResolvedValue(null);
    await expect(cancelOrder(7, 42)).rejects.toMatchObject({ status: 404, message: 'Order not found' });
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  //test 6: another customer's order also gives 404, so its existence is not revealed
  it("rejects another customer's order with 404", async () => {
    tx.order.updateMany.mockResolvedValue({ count: 0 });
    tx.order.findUnique.mockResolvedValue({ userId: 99, status: 'PROCESSING' });
    await expect(cancelOrder(7, 42)).rejects.toMatchObject({ status: 404 });
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  //test 7: an order already in transit, delivered or cancelled gives 409 and nothing changes
  it('rejects an order that is no longer processing', async () => {
    tx.order.updateMany.mockResolvedValue({ count: 0 });
    tx.order.findUnique.mockResolvedValue({ userId: 7, status: 'IN_TRANSIT' });
    await expect(cancelOrder(7, 42)).rejects.toMatchObject({
      status: 409,
      message: 'Only orders that are processing can be cancelled, this order is IN_TRANSIT',
    });
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });
});
