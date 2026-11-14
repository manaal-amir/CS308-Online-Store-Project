jest.mock('../src/config/prisma', () => ({
  order: { findUnique: jest.fn() },
  invoice: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
}));

const prisma = require('../src/config/prisma');
const { buildInvoice } = require('../src/modules/invoices/invoice.service');

beforeEach(() => jest.resetAllMocks());

const order = {
  id: 1,
  userId: 2,
  totalPrice: 1650,
  deliveryAddress: 'Test St 1',
  user: { name: 'Test', lastname: 'User', email: 'customer@test.com', homeAddress: 'X' },
  items: [
    {
      quantity: 1,
      unitPrice: 1650,
      product: { name: 'L.A. Woman', model: 'Reissue', serialNumber: 'VS-LP-007' },
    },
  ],
};

describe('buildInvoice', () => {
  it('returns invoice for the order owner', async () => {
    prisma.order.findUnique.mockResolvedValue(order);
    prisma.invoice.findUnique.mockResolvedValue(null);
    prisma.invoice.create.mockResolvedValue({
      id: 10,
      invoiceNumber: 'INV-X',
      totalAmount: 1650,
      issuedAt: new Date(),
    });

    const invoice = await buildInvoice(1, { id: 2, role: 'CUSTOMER' });
    expect(invoice.invoiceNumber).toBe('INV-X');
    expect(invoice.items.length).toBe(1);
  });

  it("throws 404 for another customer's order", async () => {
    prisma.order.findUnique.mockResolvedValue(order);
    await expect(buildInvoice(1, { id: 999, role: 'CUSTOMER' })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('allows staff to view any order', async () => {
    prisma.order.findUnique.mockResolvedValue(order);
    prisma.invoice.findUnique.mockResolvedValue({
      id: 10,
      invoiceNumber: 'INV-X',
      totalAmount: 1650,
      issuedAt: new Date(),
    });

    const invoice = await buildInvoice(1, { id: 99, role: 'SALES_MANAGER' });
    expect(invoice.invoiceNumber).toBe('INV-X');
  });

  it('throws 404 for missing order', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(buildInvoice(999, { id: 2, role: 'CUSTOMER' })).rejects.toMatchObject({
      status: 404,
    });
  });
});
