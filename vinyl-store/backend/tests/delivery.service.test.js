//replace the real prisma client with fake functions, so these tests need no database
jest.mock('../src/config/prisma', () => ({
  order: { findMany: jest.fn() },
}));

const prisma = require('../src/config/prisma');
const deliveryService = require('../src/modules/deliveries/delivery.service');

beforeEach(() => {
  jest.resetAllMocks();
});

const createdAt = new Date('2026-11-01T10:00:00Z');

//an order with two different records, bought by customer 7
const order = {
  id: 12,
  userId: 7,
  status: 'PROCESSING',
  deliveryAddress: 'Orta Mah. Istanbul',
  createdAt,
  items: [
    { productId: 1, quantity: 2, unitPrice: '2390.00', product: { name: 'Discovery' } },
    { productId: 4, quantity: 1, unitPrice: '1150.50', product: { name: 'Hello, Dolly!' } },
  ],
};

describe('listDeliveries', () => {
  //test 1: one row per product, with every column the requirement asks for
  it('returns one row per product in an order', async () => {
    prisma.order.findMany.mockResolvedValue([order]);

    const rows = await deliveryService.listDeliveries();

    expect(rows).toEqual([
      {
        deliveryId: 12,
        customerId: 7,
        productId: 1,
        productName: 'Discovery',
        quantity: 2,
        totalPrice: 4780,
        deliveryAddress: 'Orta Mah. Istanbul',
        status: 'PROCESSING',
        completed: false,
        createdAt,
      },
      {
        deliveryId: 12,
        customerId: 7,
        productId: 4,
        productName: 'Hello, Dolly!',
        quantity: 1,
        totalPrice: 1150.5,
        deliveryAddress: 'Orta Mah. Istanbul',
        status: 'PROCESSING',
        completed: false,
        createdAt,
      },
    ]);
  });

  //test 2: only delivered orders are marked completed
  it('marks delivered orders as completed', async () => {
    prisma.order.findMany.mockResolvedValue([{ ...order, status: 'DELIVERED' }]);
    const rows = await deliveryService.listDeliveries();
    expect(rows.every((row) => row.completed === true)).toBe(true);

    prisma.order.findMany.mockResolvedValue([{ ...order, status: 'IN_TRANSIT' }]);
    const waiting = await deliveryService.listDeliveries();
    expect(waiting.every((row) => row.completed === false)).toBe(true);
  });

  //test 3: cancelled orders are left out, and waiting orders come first, oldest first
  it('leaves out cancelled orders and lists waiting orders first', async () => {
    prisma.order.findMany.mockResolvedValue([]);

    await deliveryService.listDeliveries();

    const query = prisma.order.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ status: { not: 'CANCELLED' } });
    expect(query.orderBy).toEqual([{ status: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]);
  });

  //test 4: the completed filter
  it('filters by completed', async () => {
    prisma.order.findMany.mockResolvedValue([]);

    await deliveryService.listDeliveries({ completed: true });
    await deliveryService.listDeliveries({ completed: false });

    expect(prisma.order.findMany.mock.calls[0][0].where).toEqual({ status: 'DELIVERED' });
    expect(prisma.order.findMany.mock.calls[1][0].where).toEqual({
      status: { in: ['PROCESSING', 'IN_TRANSIT'] },
    });
  });

  //test 5: the store's cost is never asked for, and an order with no items gives no rows
  it('never selects the unit cost and handles orders without items', async () => {
    prisma.order.findMany.mockResolvedValue([{ ...order, items: [] }]);

    const rows = await deliveryService.listDeliveries();

    expect(rows).toEqual([]);
    expect(JSON.stringify(prisma.order.findMany.mock.calls[0][0].select)).not.toContain('unitCost');
  });
});
