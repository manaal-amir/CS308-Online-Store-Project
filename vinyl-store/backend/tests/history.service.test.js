//replace the real prisma client with fake functions, so these tests need no database
jest.mock('../src/config/prisma', () => ({
  order: { findMany: jest.fn(), findFirst: jest.fn() },
}));

const prisma = require('../src/config/prisma');
const historyService = require('../src/modules/orders/history.service');

beforeEach(() => {
  jest.resetAllMocks();
});

describe('listOrders', () => {
  //test 1: only the logged in user's orders are asked for, newest first
  it("asks for the user's orders newest first", async () => {
    prisma.order.findMany.mockResolvedValue([]);
    await historyService.listOrders(7);
    const query = prisma.order.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ userId: 7 });
    expect(query.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  //test 2: each order is reduced to id, status, date and a number total
  it('returns id, status, date and total', async () => {
    const createdAt = new Date('2026-11-01T10:00:00Z');
    prisma.order.findMany.mockResolvedValue([
      { id: 3, status: 'PROCESSING', totalPrice: '4780.00', createdAt },
    ]);
    const orders = await historyService.listOrders(7);
    expect(orders).toEqual([{ id: 3, status: 'PROCESSING', createdAt, total: 4780 }]);
  });
});

describe('getOrder', () => {
  const createdAt = new Date('2026-11-01T10:00:00Z');
  const order = {
    id: 3,
    status: 'DELIVERED',
    totalPrice: '4780.00',
    deliveryAddress: 'Orta Mah. Istanbul',
    cardLast4: '4242',
    createdAt,
    items: [
      {
        productId: 1,
        quantity: 2,
        unitPrice: '2390.00',
        unitCost: '1100.00',
        product: { name: 'Discovery', imageUrl: null, artist: { name: 'Daft Punk' } },
      },
    ],
  };

  //test 3: the query includes the user id, so other people's orders are never found
  it('looks the order up by id and owner', async () => {
    prisma.order.findFirst.mockResolvedValue(order);
    await historyService.getOrder(7, 3);
    expect(prisma.order.findFirst.mock.calls[0][0].where).toEqual({ id: 3, userId: 7 });
  });

  //test 4: items show the price paid, and never the store's cost
  it('returns the order with items and hides the cost', async () => {
    prisma.order.findFirst.mockResolvedValue(order);
    const result = await historyService.getOrder(7, 3);
    expect(result).toEqual({
      id: 3,
      status: 'DELIVERED',
      createdAt,
      deliveryAddress: 'Orta Mah. Istanbul',
      cardLast4: '4242',
      total: 4780,
      items: [
        {
          productId: 1,
          name: 'Discovery',
          artist: 'Daft Punk',
          imageUrl: null,
          unitPrice: 2390,
          quantity: 2,
          lineTotal: 4780,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('unitCost');
  });

  //test 5: an order that is missing or belongs to someone else is a 404
  it('throws 404 when the order is not found', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(historyService.getOrder(7, 99)).rejects.toMatchObject({
      status: 404,
      message: 'Order not found',
    });
  });

  //test 6: a product without an artist still works
  it('handles products with no artist', async () => {
    prisma.order.findFirst.mockResolvedValue({
      ...order,
      items: [{ ...order.items[0], product: { name: 'Turntable', imageUrl: null, artist: null } }],
    });
    const result = await historyService.getOrder(7, 3);
    expect(result.items[0].artist).toBeNull();
  });
});