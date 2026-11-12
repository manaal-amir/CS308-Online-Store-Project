//these tests send real http requests to the cancel route, but with fake services
//they check that login, roles and the order id are checked before the service is reached
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

//replace both order services with fake functions, so no database is needed
jest.mock('../src/modules/orders/cancel.service', () => ({ cancelOrder: jest.fn() }));
jest.mock('../src/modules/orders/checkout.service', () => ({ checkout: jest.fn() }));
const cancelService = require('../src/modules/orders/cancel.service');
const orderRoutes = require('../src/modules/orders/orders.routes');
const errorHandler = require('../src/middlewares/errorHandler');

//the auth middleware checks tokens with this secret
process.env.JWT_SECRET = 'test-secret';

//a small app with only the order routes and the error handler
const app = express();
app.use(express.json());
app.use('/api/orders', orderRoutes);
app.use(errorHandler);

//makes a token like the login route does
function tokenFor(role) {
  return jwt.sign({ id: 7, role }, process.env.JWT_SECRET);
}
const customer = `Bearer ${tokenFor('CUSTOMER')}`;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('cancel order route', () => {
  //test 1: guests cannot cancel orders
  it('rejects a request without a token', async () => {
    const res = await request(app).post('/api/orders/42/cancel');
    expect(res.status).toBe(401);
    expect(cancelService.cancelOrder).not.toHaveBeenCalled();
  });

  //test 2: only customers cancel their own orders
  it('rejects users who are not customers', async () => {
    const res = await request(app)
      .post('/api/orders/42/cancel')
      .set('Authorization', `Bearer ${tokenFor('SALES_MANAGER')}`);
    expect(res.status).toBe(403);
  });

  //test 3: a valid cancel returns 200 and passes the user id and the order id as numbers
  it('cancels the order for a customer', async () => {
    cancelService.cancelOrder.mockResolvedValue({ id: 42, status: 'CANCELLED' });
    const res = await request(app).post('/api/orders/42/cancel').set('Authorization', customer);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 42, status: 'CANCELLED' });
    expect(cancelService.cancelOrder).toHaveBeenCalledWith(7, 42);
  });

  //test 4: order ids that are not positive whole numbers, or too big for the database, give 400
  it('rejects a bad order id', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '99999999999']) {
      const res = await request(app).post(`/api/orders/${id}/cancel`).set('Authorization', customer);
      expect(res.status).toBe(400);
    }
    expect(cancelService.cancelOrder).not.toHaveBeenCalled();
  });

  //test 5: errors from the service keep their status, e.g. an order already in transit
  it('returns the service error status', async () => {
    const err = new Error('Only orders that are processing can be cancelled, this order is IN_TRANSIT');
    err.status = 409;
    cancelService.cancelOrder.mockRejectedValue(err);
    const res = await request(app).post('/api/orders/42/cancel').set('Authorization', customer);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe(err.message);
  });
});
