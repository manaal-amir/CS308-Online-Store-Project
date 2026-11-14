//role separation: staff routes reject wrong roles, protected routes reject guests
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

process.env.JWT_SECRET = 'test-secret';

function tokenFor(role) {
  return jwt.sign({ id: 1, role }, process.env.JWT_SECRET);
}

describe('role separation', () => {
  it('unauthenticated request to checkout returns 401', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        cardNumber: '4242424242424242',
        cardHolder: 'X',
        expiryMonth: 12,
        expiryYear: 2030,
        cvv: '123',
      });
    expect(res.status).toBe(401);
  });

  it('customer cannot access product manager status route', async () => {
    const res = await request(app)
      .patch('/api/orders/1/status')
      .set('Authorization', `Bearer ${tokenFor('CUSTOMER')}`)
      .send({ status: 'IN_TRANSIT' });
    expect(res.status).toBe(403);
  });

  it('sales manager cannot access product manager status route', async () => {
    const res = await request(app)
      .patch('/api/orders/1/status')
      .set('Authorization', `Bearer ${tokenFor('SALES_MANAGER')}`)
      .send({ status: 'IN_TRANSIT' });
    expect(res.status).toBe(403);
  });

  it('support agent cannot access product manager status route', async () => {
    const res = await request(app)
      .patch('/api/orders/1/status')
      .set('Authorization', `Bearer ${tokenFor('SUPPORT_AGENT')}`)
      .send({ status: 'IN_TRANSIT' });
    expect(res.status).toBe(403);
  });

  it('unauthenticated request to invoices returns 401', async () => {
    const res = await request(app).get('/api/invoices/1');
    expect(res.status).toBe(401);
  });

  it('unauthenticated request to cart returns 401', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
  });

  it('unauthenticated request to logout returns 401', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('product manager cannot call customer checkout', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`)
      .send({
        cardNumber: '4242424242424242',
        cardHolder: 'X',
        expiryMonth: 12,
        expiryYear: 2030,
        cvv: '123',
      });
    expect(res.status).toBe(403);
  });

  it('sales manager cannot call customer checkout', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenFor('SALES_MANAGER')}`)
      .send({
        cardNumber: '4242424242424242',
        cardHolder: 'X',
        expiryMonth: 12,
        expiryYear: 2030,
        cvv: '123',
      });
    expect(res.status).toBe(403);
  });

  it('product manager cannot call customer cancel', async () => {
    const res = await request(app)
      .post('/api/orders/1/cancel')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`);
    expect(res.status).toBe(403);
  });

  it('product manager cannot call customer cart', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`);
    expect(res.status).toBe(403);
  });
});
