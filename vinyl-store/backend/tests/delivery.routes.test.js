//these tests send real http requests to the delivery route, but with a fake service
//they check that login, roles and the filter are checked before the service is reached
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

//replace the service with a fake function, so no database is needed
jest.mock('../src/modules/deliveries/delivery.service', () => ({ listDeliveries: jest.fn() }));
const deliveryService = require('../src/modules/deliveries/delivery.service');
const deliveryRoutes = require('../src/modules/deliveries/delivery.routes');
const errorHandler = require('../src/middlewares/errorHandler');

//the auth middleware checks tokens with this secret
process.env.JWT_SECRET = 'test-secret';

//a small app with only the delivery route and the error handler
const app = express();
app.use(express.json());
app.use('/api/deliveries', deliveryRoutes);
app.use(errorHandler);

//makes a token like the login route does
function tokenFor(role) {
  return jwt.sign({ id: 3, role }, process.env.JWT_SECRET);
}
const productManager = `Bearer ${tokenFor('PRODUCT_MANAGER')}`;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('delivery list route', () => {
  //test 1: guests get 401
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/deliveries');
    expect(res.status).toBe(401);
    expect(deliveryService.listDeliveries).not.toHaveBeenCalled();
  });

  //test 2: only product managers can see the list
  it('rejects every other role', async () => {
    for (const role of ['CUSTOMER', 'SALES_MANAGER', 'SUPPORT_AGENT']) {
      const res = await request(app)
        .get('/api/deliveries')
        .set('Authorization', `Bearer ${tokenFor(role)}`);
      expect(res.status).toBe(403);
    }
    expect(deliveryService.listDeliveries).not.toHaveBeenCalled();
  });

  //test 3: a product manager gets the list
  it('returns the delivery list for a product manager', async () => {
    const rows = [{ deliveryId: 12, customerId: 7, completed: false }];
    deliveryService.listDeliveries.mockResolvedValue(rows);

    const res = await request(app).get('/api/deliveries').set('Authorization', productManager);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    expect(deliveryService.listDeliveries).toHaveBeenCalledWith({ completed: undefined });
  });

  //test 4: ?completed=true and ?completed=false become real booleans
  it('passes the completed filter as a boolean', async () => {
    deliveryService.listDeliveries.mockResolvedValue([]);

    await request(app).get('/api/deliveries?completed=true').set('Authorization', productManager);
    await request(app).get('/api/deliveries?completed=false').set('Authorization', productManager);

    expect(deliveryService.listDeliveries).toHaveBeenNthCalledWith(1, { completed: true });
    expect(deliveryService.listDeliveries).toHaveBeenNthCalledWith(2, { completed: false });
  });

  //test 5: anything else is rejected before the service
  it('rejects an invalid completed value with 400', async () => {
    const res = await request(app)
      .get('/api/deliveries?completed=maybe')
      .set('Authorization', productManager);
    expect(res.status).toBe(400);
    expect(deliveryService.listDeliveries).not.toHaveBeenCalled();
  });

  //test 6: errors from the service reach the error handler
  it('passes service errors to the error handler', async () => {
    deliveryService.listDeliveries.mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/api/deliveries').set('Authorization', productManager);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});
