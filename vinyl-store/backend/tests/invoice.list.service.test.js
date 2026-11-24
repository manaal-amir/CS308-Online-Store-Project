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
    expect(result[0].totalAmount).toBe(1650);
  });
  it('includes the whole last day for the to date', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    await listInvoices({ to: '2026-12-31' });
    const call = prisma.invoice.findMany.mock.calls[0][0];
    expect(call.where.issuedAt.lte.getUTCHours()).toBe(23);
  });
  it('returns 400 for an invalid from date', async () => {
    await expect(listInvoices({ from: 'abc' })).rejects.toMatchObject({ status: 400 });
  });
  it('returns 400 for an invalid to date', async () => {
    await expect(listInvoices({ to: 'not-a-date' })).rejects.toMatchObject({ status: 400 });
  });
  it('returns an empty array when there are no invoices', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    const result = await listInvoices({});
    expect(result).toEqual([]);
  });
});