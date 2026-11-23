//these tests send real http requests to the order history routes, but with fake services
//they check that login, roles and the order id are checked before the service is reached
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

//replace all the order services with fake functions, so no database is needed
jest.mock('../src/modules/orders/history.service', () => ({
  listOrders: jest.fn(),
  getOrder: jest.fn(),
}));
jest.mock('../src/modules/orders/checkout.service', () => ({ checkout: jest.fn() }));
jest.mock('../src/modules/orders/cancel.service', () => ({ cancelOrder: jest.fn() }));
jest.mock('../src/modules/orders/status.service', () => ({ updateStatus: jest.fn() }));
const historyService = require('../src/modules/orders/history.service');
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

describe('order history routes', () => {
  //test 1: no token means 401
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
    expect(historyService.listOrders).not.toHaveBeenCalled();
  });

  //test 2: staff cannot use the customer order history
  it('rejects users who are not customers', async () => {
    const list = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${tokenFor('SUPPORT_AGENT')}`);
    const one = await request(app)
      .get('/api/orders/3')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`);
    expect(list.status).toBe(403);
    expect(one.status).toBe(403);
    expect(historyService.listOrders).not.toHaveBeenCalled();
    expect(historyService.getOrder).not.toHaveBeenCalled();
  });

  //test 3: the list uses the user id from the token
  it('returns the orders of the logged in customer', async () => {
    historyService.listOrders.mockResolvedValue([{ id: 3, status: 'PROCESSING', total: 100 }]);
    const res = await request(app).get('/api/orders').set('Authorization', customer);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 3, status: 'PROCESSING', total: 100 }]);
    expect(historyService.listOrders).toHaveBeenCalledWith(7);
  });

  //test 4: the order id in the url becomes a number
  it('returns one order using the id from the url', async () => {
    historyService.getOrder.mockResolvedValue({ id: 3, items: [] });
    const res = await request(app).get('/api/orders/3').set('Authorization', customer);
    expect(res.status).toBe(200);
    expect(historyService.getOrder).toHaveBeenCalledWith(7, 3);
  });

  //test 5: someone else's order is a 404 from the service
  it("passes the 404 for orders that are not the user's", async () => {
    const err = new Error('Order not found');
    err.status = 404;
    historyService.getOrder.mockRejectedValue(err);
    const res = await request(app).get('/api/orders/99').set('Authorization', customer);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Order not found' });
  });

  //test 6: ids that are not numbers, or too big for the database, are rejected before the service
  it('rejects invalid order ids with 400', async () => {
    const bad = await request(app).get('/api/orders/abc').set('Authorization', customer);
    const big = await request(app).get('/api/orders/3000000000').set('Authorization', customer);
    expect(bad.status).toBe(400);
    expect(big.status).toBe(400);
    expect(historyService.getOrder).not.toHaveBeenCalled();
  });
});
