const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/modules/invoices/invoice.service', () => ({
  getInvoiceForRead: jest.fn(),
  listInvoices: jest.fn(),
}));

const invoiceService = require('../src/modules/invoices/invoice.service');

function tokenFor(role = 'PRODUCT_MANAGER', id = 1) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET);
}

beforeEach(() => jest.resetAllMocks());

describe('GET /api/invoices', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a customer', async () => {
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${tokenFor('CUSTOMER')}`);
    expect(res.status).toBe(403);
  });

  it('returns the list for a product manager', async () => {
    invoiceService.listInvoices.mockResolvedValue([
      {
        id: 1,
        invoiceNumber: 'INV-1',
        totalAmount: 1650,
        issuedAt: '2026-11-09',
        orderId: 1,
        customer: { name: 'T', lastname: 'C', email: 't@x.com' },
      },
    ]);

    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].invoiceNumber).toBe('INV-1');
  });

  it('returns the list for a sales manager', async () => {
    invoiceService.listInvoices.mockResolvedValue([]);
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${tokenFor('SALES_MANAGER')}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('passes date filters to the service', async () => {
    invoiceService.listInvoices.mockResolvedValue([]);
    await request(app)
      .get('/api/invoices?from=2026-11-01&to=2026-12-31')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`);
    expect(invoiceService.listInvoices).toHaveBeenCalledWith({
      from: '2026-11-01',
      to: '2026-12-31',
    });
  });
});