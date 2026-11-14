//route tests for PATCH /api/orders/:id/status with fake services
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
  it('rejects a request without a token', async () => {
    const res = await request(app).patch('/api/orders/42/status').send({ status: 'IN_TRANSIT' });
    expect(res.status).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    const res = await request(app)
      .patch('/api/orders/42/status')
      .set('Authorization', `Bearer ${tokenFor('CUSTOMER')}`)
      .send({ status: 'IN_TRANSIT' });
    expect(res.status).toBe(403);
  });

  it('product manager updates the status', async () => {
    statusService.updateStatus.mockResolvedValue({ id: 42, status: 'IN_TRANSIT' });
    const res = await request(app)
      .patch('/api/orders/42/status')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`)
      .send({ status: 'IN_TRANSIT' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 42, status: 'IN_TRANSIT' });
    expect(statusService.updateStatus).toHaveBeenCalledWith(42, 'IN_TRANSIT');
  });

  it('rejects CANCELLED as a status target with 400', async () => {
    const res = await request(app)
      .patch('/api/orders/42/status')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(400);
    expect(statusService.updateStatus).not.toHaveBeenCalled();
  });

  it('rejects PROCESSING as a status target with 400', async () => {
    const res = await request(app)
      .patch('/api/orders/42/status')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`)
      .send({ status: 'PROCESSING' });
    expect(res.status).toBe(400);
  });

  it('rejects a bad order id with 400', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '99999999999']) {
      const res = await request(app)
        .patch(`/api/orders/${id}/status`)
        .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`)
        .send({ status: 'IN_TRANSIT' });
      expect(res.status).toBe(400);
    }
    expect(statusService.updateStatus).not.toHaveBeenCalled();
  });

  it('returns the service error status', async () => {
    const err = new Error('Cannot move order from IN_TRANSIT to PROCESSING. Allowed: DELIVERED');
    err.status = 409;
    statusService.updateStatus.mockRejectedValue(err);

    const res = await request(app)
      .patch('/api/orders/42/status')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`)
      .send({ status: 'DELIVERED' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(err.message);
  });
});
