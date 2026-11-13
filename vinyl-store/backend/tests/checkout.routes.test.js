//these tests send real http requests to the checkout route, but with a fake service
//they check that login, roles and card validation work before the service is reached
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

//replace both order services with fake functions, so no database is needed
jest.mock('../src/modules/orders/checkout.service', () => ({ checkout: jest.fn() }));
jest.mock('../src/modules/orders/cancel.service', () => ({ cancelOrder: jest.fn() }));
const checkoutService = require('../src/modules/orders/checkout.service');
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

//a valid checkout body
const body = {
  cardNumber: '4242424242424242',
  cardHolder: 'Test Customer',
  expiryMonth: 12,
  expiryYear: 2030,
  cvv: '123',
  deliveryAddress: 'Orta Mahalle, Tuzla, Istanbul',
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe('checkout route', () => {
  //test 1: guests must sign in before checkout (requirement 4)
  it('rejects a request without a token', async () => {
    const res = await request(app).post('/api/orders').send(body);
    expect(res.status).toBe(401);
    expect(checkoutService.checkout).not.toHaveBeenCalled();
  });

  //test 2: managers and agents cannot place orders
  it('rejects users who are not customers', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`)
      .send(body);
    expect(res.status).toBe(403);
  });

  //test 3: a valid checkout returns 201 and passes the user id from the token
  it('creates an order for a customer', async () => {
    checkoutService.checkout.mockResolvedValue({ id: 42, status: 'PROCESSING' });
    const res = await request(app).post('/api/orders').set('Authorization', customer).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 42, status: 'PROCESSING' });
    expect(checkoutService.checkout).toHaveBeenCalledWith(7, body);
  });

  //test 4: month and year sent as text are turned into numbers
  it('accepts expiry month and year sent as text', async () => {
    checkoutService.checkout.mockResolvedValue({ id: 42 });
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', customer)
      .send({ ...body, expiryMonth: '12', expiryYear: '2030' });
    expect(res.status).toBe(201);
    expect(checkoutService.checkout.mock.calls[0][1]).toMatchObject({ expiryMonth: 12, expiryYear: 2030 });
  });

  //test 5: missing card fields are all listed in one 400
  it('rejects a body with missing card details', async () => {
    const res = await request(app).post('/api/orders').set('Authorization', customer).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cardNumber is required');
    expect(res.body.error).toContain('cvv is required');
    expect(checkoutService.checkout).not.toHaveBeenCalled();
  });

  //test 6: card number with letters, spaces or sent as a number is rejected
  it('rejects a badly formatted card number', async () => {
    for (const cardNumber of ['4242 4242 4242 4242', '42424242abcd4242', 4242424242424242, '123']) {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', customer)
        .send({ ...body, cardNumber });
      expect(res.status).toBe(400);
    }
  });

  //test 7: cvv must be 3 or 4 digits and month must be 1 to 12
  it('rejects a bad cvv or expiry month', async () => {
    const badCvv = await request(app).post('/api/orders').set('Authorization', customer).send({ ...body, cvv: '12' });
    expect(badCvv.status).toBe(400);
    expect(badCvv.body.error).toBe('cvv must be 3 or 4 digits');

    const badMonth = await request(app)
      .post('/api/orders')
      .set('Authorization', customer)
      .send({ ...body, expiryMonth: 13 });
    expect(badMonth.status).toBe(400);
  });

  //test 8: errors from the service keep their status, e.g. a declined card
  it('returns the service error status', async () => {
    const err = new Error('Payment declined: Card declined');
    err.status = 402;
    checkoutService.checkout.mockRejectedValue(err);
    const res = await request(app).post('/api/orders').set('Authorization', customer).send(body);
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('Payment declined: Card declined');
  });
});
