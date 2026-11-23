const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/modules/wishlist/wishlist.service', () => ({
  addToWishList: jest.fn(),
  removeFromWishList: jest.fn(),
  getWishList: jest.fn(),
}));

const wishlistService = require('../src/modules/wishlist/wishlist.service');

function tokenFor(role = 'CUSTOMER', id = 1) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET);
}

beforeEach(() => jest.resetAllMocks());

describe('wishlist routes', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/wishlist');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-customer role', async () => {
    const res = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`);
    expect(res.status).toBe(403);
  });

  it('POST adds a product', async () => {
    wishlistService.addToWishList.mockResolvedValue({ productId: 7, added: true });
    const res = await request(app)
      .post('/api/wishlist/7')
      .set('Authorization', `Bearer ${tokenFor()}`);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ productId: 7, added: true });
  });

  it('POST returns 409 on a duplicate', async () => {
    wishlistService.addToWishList.mockRejectedValue(
      Object.assign(new Error('Product already in wish list'), { status: 409 })
    );
    const res = await request(app)
      .post('/api/wishlist/7')
      .set('Authorization', `Bearer ${tokenFor()}`);
    expect(res.status).toBe(409);
  });

  it('POST returns 400 on an invalid product id', async () => {
    const res = await request(app)
      .post('/api/wishlist/abc')
      .set('Authorization', `Bearer ${tokenFor()}`);
    expect(res.status).toBe(400);
  });

  it('DELETE removes a product', async () => {
    wishlistService.removeFromWishList.mockResolvedValue({ productId: 7, removed: true });
    const res = await request(app)
      .delete('/api/wishlist/7')
      .set('Authorization', `Bearer ${tokenFor()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ productId: 7, removed: true });
  });

  it('GET returns the wish list', async () => {
    wishlistService.getWishList.mockResolvedValue({
      items: [{ productId: 7, name: 'L.A. Woman', price: 1650 }],
    });
    const res = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${tokenFor()}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });
});
