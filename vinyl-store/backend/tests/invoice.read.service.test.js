//getInvoiceForRead: only the owner and staff can read an invoice, everyone else gets 404
jest.mock('../src/config/prisma', () => ({
  invoice: { findUnique: jest.fn() },
}));

const prisma = require('../src/config/prisma');
const { getInvoiceForRead } = require('../src/modules/invoices/invoice.service');

beforeEach(() => jest.resetAllMocks());

const invoice = {
  id: 10,
  invoiceNumber: 'INV-X',
  totalAmount: 1650,
  issuedAt: new Date('2026-11-20'),
  orderId: 1,
  order: {
    userId: 2,
    deliveryAddress: 'Test St 1',
    user: { name: 'Test', lastname: 'User', email: 'customer@test.com', homeAddress: 'X' },
    items: [
      {
        quantity: 1,
        unitPrice: 1650,
        product: { name: 'L.A. Woman', model: 'Reissue', serialNumber: 'VS-LP-007' },
      },
    ],
  },
};

describe('getInvoiceForRead', () => {
  it('returns the invoice to the order owner', async () => {
    prisma.invoice.findUnique.mockResolvedValue(invoice);
    const result = await getInvoiceForRead(1, { id: 2, role: 'CUSTOMER' });
    expect(result.invoiceNumber).toBe('INV-X');
    expect(result.customer.email).toBe('customer@test.com');
    expect(result.items[0].lineTotal).toBe(1650);
  });

  it('returns the invoice to a staff role', async () => {
    prisma.invoice.findUnique.mockResolvedValue(invoice);
    const result = await getInvoiceForRead(1, { id: 99, role: 'SALES_MANAGER' });
    expect(result.invoiceNumber).toBe('INV-X');
  });

  it('returns 404 to another customer', async () => {
    prisma.invoice.findUnique.mockResolvedValue(invoice);
    await expect(getInvoiceForRead(1, { id: 3, role: 'CUSTOMER' })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('returns 404 when the order has no invoice', async () => {
    prisma.invoice.findUnique.mockResolvedValue(null);
    await expect(getInvoiceForRead(1, { id: 2, role: 'CUSTOMER' })).rejects.toMatchObject({
      status: 404,
    });
  });
});
