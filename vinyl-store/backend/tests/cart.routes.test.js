//these tests send real http requests to the cart routes, but with a fake service
//they check that login, roles and validation work before the service is reached
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

//replace the service with fake functions, so no database is needed
jest.mock('../src/modules/cart/cart.service', () => ({
  getCart: jest.fn(),
  addItem: jest.fn(),
  updateItem: jest.fn(),
  removeItem: jest.fn(),
  mergeCart: jest.fn(),
}));
const cartService = require('../src/modules/cart/cart.service');
const cartRoutes = require('../src/modules/cart/cart.routes');
const errorHandler = require('../src/middlewares/errorHandler');

//the auth middleware checks tokens with this secret
process.env.JWT_SECRET = 'test-secret';

//a small app with only the cart routes and the error handler
const app = express();
app.use(express.json());
app.use('/api/cart', cartRoutes);
app.use(errorHandler);

//makes a token like the login route does
function tokenFor(role) {
  return jwt.sign({ id: 7, role }, process.env.JWT_SECRET);
}
const customer = `Bearer ${tokenFor('CUSTOMER')}`;

const emptyCart = { items: [], itemCount: 0, total: 0 };

beforeEach(() => {
  jest.resetAllMocks();
});

describe('cart routes', () => {
  //test 1: no token means 401
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
  });

  //test 2: managers and agents cannot use the cart
  it('rejects users who are not customers', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${tokenFor('SALES_MANAGER')}`);
    expect(res.status).toBe(403);
  });

  //test 3: a customer gets their cart, using the id from the token
  it('returns the cart for a customer', async () => {
    cartService.getCart.mockResolvedValue(emptyCart);
    const res = await request(app).get('/api/cart').set('Authorization', customer);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(emptyCart);
    expect(cartService.getCart).toHaveBeenCalledWith(7);
  });

  //test 4: quantity defaults to 1 when adding
  it('adds an item with quantity 1 by default', async () => {
    cartService.addItem.mockResolvedValue(emptyCart);
    const res = await request(app).post('/api/cart/items').set('Authorization', customer).send({ productId: 3 });
    expect(res.status).toBe(200);
    expect(cartService.addItem).toHaveBeenCalledWith(7, 3, 1);
  });

  //test 5: invalid input is stopped by validation before reaching the service
  it('rejects invalid add requests with 400', async () => {
    const res = await request(app).post('/api/cart/items').set('Authorization', customer).send({ productId: 'abc', quantity: 0 });
    expect(res.status).toBe(400);
    expect(cartService.addItem).not.toHaveBeenCalled();
  });

  //test 6: the product id in the url is converted to a number
  it('updates an item using the id from the url', async () => {
    cartService.updateItem.mockResolvedValue(emptyCart);
    const res = await request(app).patch('/api/cart/items/3').set('Authorization', customer).send({ quantity: 2 });
    expect(res.status).toBe(200);
    expect(cartService.updateItem).toHaveBeenCalledWith(7, 3, 2);
  });

  //test 7: errors from the service reach the user through the error handler
  it('passes service errors to the error handler', async () => {
    const err = new Error('Only 5 in stock');
    err.status = 409;
    cartService.removeItem.mockRejectedValue(err);
    const res = await request(app).delete('/api/cart/items/3').set('Authorization', customer);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Only 5 in stock' });
  });

  //test 8: merge sends the browser items to the service
  it('merges the browser cart', async () => {
    cartService.mergeCart.mockResolvedValue({ ...emptyCart, adjustments: [] });
    const items = [{ productId: 3, quantity: 2 }];
    const res = await request(app).post('/api/cart/merge').set('Authorization', customer).send({ items });
    expect(res.status).toBe(200);
    expect(cartService.mergeCart).toHaveBeenCalledWith(7, items);
  });

  //test 9: ids too big for the database are rejected with 400 instead of crashing
  it('rejects a product id larger than the database allows', async () => {
    const res = await request(app).delete('/api/cart/items/3000000000').set('Authorization', customer);
    expect(res.status).toBe(400);
    expect(cartService.removeItem).not.toHaveBeenCalled();
  });

  //test 10: a quantity is required when changing an item
  it('rejects an update without a quantity', async () => {
    const res = await request(app).patch('/api/cart/items/3').set('Authorization', customer).send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'quantity is required' });
  });
});