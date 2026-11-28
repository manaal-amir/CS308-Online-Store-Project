const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/modules/invoices/invoice.service', () => ({
  getInvoiceForRead: jest.fn(),
}));

const invoiceService = require('../src/modules/invoices/invoice.service');

function customerToken(id = 2) {
  return jwt.sign({ id, role: 'CUSTOMER' }, 'test-secret');
}

beforeEach(() => jest.resetAllMocks());

describe('GET /api/invoices/:orderId', () => {
  it('returns 200 for own order', async () => {
    invoiceService.getInvoiceForRead.mockResolvedValue({
      id: 10,
      invoiceNumber: 'INV-X',
      totalAmount: 1650,
      issuedAt: new Date(),
      customer: { name: 'T' },
      deliveryAddress: 'St',
      items: [{ quantity: 1 }],
    });

    const res = await request(app)
      .get('/api/invoices/1')
      .set('Authorization', `Bearer ${customerToken(2)}`);

    expect(res.status).toBe(200);
    expect(res.body.invoiceNumber).toBe('INV-X');
    expect(res.body.items.length).toBe(1);
  });

  it("returns 404 for another user's order", async () => {
    invoiceService.getInvoiceForRead.mockRejectedValue(
      Object.assign(new Error('Invoice not found'), { status: 404 })
    );

    const res = await request(app)
      .get('/api/invoices/1')
      .set('Authorization', `Bearer ${customerToken(2)}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const res = await request(app)
      .get('/api/invoices/abc')
      .set('Authorization', `Bearer ${customerToken(2)}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/invoices/1');
    expect(res.status).toBe(401);
  });
});