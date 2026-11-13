const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/modules/orders/status.service', () => ({ updateStatus: jest.fn() }));
jest.mock('../src/modules/orders/checkout.service', () => ({ checkout: jest.fn() }));
jest.mock('../src/modules/orders/cancel.service', () => ({ cancelOrder: jest.fn() }));

const statusService = require('../src/modules/orders/status.service');
const orderRoutes = require('../src/modules/orders/orders.routes');
const errorHandler = require('../src/middlewares/errorHandler');

process.env.JWT_SECRET = 'test-secret';

const app = express();
app.use(express.json());
app.use('/api/orders', orderRoutes);
app.use(errorHandler);

function tokenFor(role) {
  return jwt.sign({ id: 7, role }, process.env.JWT_SECRET);
}

beforeEach(() => jest.resetAllMocks());

describe('PATCH /api/orders/:id/status', () => {
  it('rejects without token', async () => {
    const res = await request(app).patch('/api/orders/42/status').send({ status: 'IN_TRANSIT' });
    expect(res.status).toBe(401);
  });

  it('rejects customer role with 403', async () => {
    const res = await request(app)
      .patch('/api/orders/42/status')
      .set('Authorization', `Bearer ${tokenFor('CUSTOMER')}`)
      .send({ status: 'IN_TRANSIT' });
    expect(res.status).toBe(403);
  });

  it('product manager updates status', async () => {
    statusService.updateStatus.mockResolvedValue({ id: 42, status: 'IN_TRANSIT' });
    const res = await request(app)
      .patch('/api/orders/42/status')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`)
      .send({ status: 'IN_TRANSIT' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 42, status: 'IN_TRANSIT' });
    expect(statusService.updateStatus).toHaveBeenCalledWith(42, 'IN_TRANSIT');
  });

  it('rejects invalid status with 400', async () => {
    const res = await request(app)
      .patch('/api/orders/42/status')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`)
      .send({ status: 'INVALID' });
    expect(res.status).toBe(400);
  });

  it('rejects bad order id with 400', async () => {
    const res = await request(app)
      .patch('/api/orders/abc/status')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`)
      .send({ status: 'IN_TRANSIT' });
    expect(res.status).toBe(400);
  });
});