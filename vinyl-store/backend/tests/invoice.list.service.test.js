jest.mock('../src/config/prisma', () => ({
  invoice: { findMany: jest.fn() },
  order: { findUnique: jest.fn() },
}));

const prisma = require('../src/config/prisma');
const { listInvoices } = require('../src/modules/invoices/invoice.service');

beforeEach(() => jest.resetAllMocks());

describe('listInvoices', () => {
  it('returns invoices newest first with customer and numeric total', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      {
        id: 1,
        invoiceNumber: 'INV-1',
        totalAmount: '1650.00',
        issuedAt: new Date('2026-11-20'),
        orderId: 10,
        order: { id: 10, user: { name: 'T', lastname: 'C', email: 't@x.com' } },
      },
    ]);

    const result = await listInvoices({});

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      invoiceNumber: 'INV-1',
      totalAmount: 1650,
      issuedAt: new Date('2026-11-20'),
      orderId: 10,
      customer: { name: 'T', lastname: 'C', email: 't@x.com' },
    });
    expect(prisma.invoice.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { issuedAt: 'desc' },
      include: expect.any(Object),
    });
  });

  it('filters by from date', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    await listInvoices({ from: '2026-11-01' });
    const call = prisma.invoice.findMany.mock.calls[0][0];
    expect(call.where.issuedAt.gte).toEqual(new Date('2026-11-01'));
  });

  it('includes the whole last day for the to date', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    await listInvoices({ to: '2026-12-31' });
    const call = prisma.invoice.findMany.mock.calls[0][0];
    expect(call.where.issuedAt.lte.getUTCHours()).toBe(23);
    expect(call.where.issuedAt.lte.getUTCMinutes()).toBe(59);
    expect(call.where.issuedAt.lte.getUTCSeconds()).toBe(59);
  });

  it('returns 400 for an invalid from date', async () => {
    await expect(listInvoices({ from: 'abc' })).rejects.toMatchObject({ status: 400 });
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid to date', async () => {
    await expect(listInvoices({ to: 'not-a-date' })).rejects.toMatchObject({ status: 400 });
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty array when there are no invoices', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    const result = await listInvoices({});
    expect(result).toEqual([]);
  });
});
