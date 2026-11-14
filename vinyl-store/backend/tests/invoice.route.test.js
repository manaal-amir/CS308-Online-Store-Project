jest.mock('../src/config/prisma', () => ({
  order: { findUnique: jest.fn() },
  invoice: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
}));
jest.mock('../src/modules/invoices/invoice.email', () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue({ sent: false }),
}));

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_secret';

function customerToken(id = 2) {
  return jwt.sign({ id, role: 'CUSTOMER' }, 'test_secret');
}

beforeEach(() => jest.resetAllMocks());

describe('GET /api/invoices/:orderId', () => {
  it('returns 200 for own order', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 1,
      userId: 2,
      totalPrice: 1650,
      deliveryAddress: 'Test St',
      user: { name: 'T', lastname: 'U', email: 't@x.com', homeAddress: 'H' },
      items: [
        { quantity: 1, unitPrice: 1650, product: { name: 'P', model: 'M', serialNumber: 'S' } },
      ],
    });
    prisma.invoice.findUnique.mockResolvedValue({
      id: 10,
      invoiceNumber: 'INV-X',
      totalAmount: 1650,
      issuedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/invoices/1')
      .set('Authorization', `Bearer ${customerToken(2)}`);

    expect(res.status).toBe(200);
    expect(res.body.invoiceNumber).toBe('INV-X');
    expect(res.body.items.length).toBe(1);
  });

  it("returns 404 for another user's order", async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 1,
      userId: 999,
      totalPrice: 1650,
      deliveryAddress: 'X',
      user: { name: 'T', lastname: 'U', email: 't@x.com', homeAddress: 'H' },
      items: [],
    });

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
