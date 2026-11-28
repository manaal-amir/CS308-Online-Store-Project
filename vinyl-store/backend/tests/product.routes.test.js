const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/modules/products/product.service', () => ({
  getProducts: jest.fn(),
  getProductById: jest.fn(),
  updateStock: jest.fn(),
}));
const productService = require('../src/modules/products/product.service');
const app = require('../src/app');

//the auth middleware checks tokens with this secret
process.env.JWT_SECRET = 'test-secret';

//makes a token like the login route does
function tokenFor(role) {
  return jwt.sign({ id: 7, role }, process.env.JWT_SECRET);
}
const productManager = `Bearer ${tokenFor('PRODUCT_MANAGER')}`;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('product routes', () => {
  it('returns the product catalog as JSON', async () => {
    const products = [
      {
        id: 1,
        name: 'Kind of Blue',
        price: 2500,
        quantity: 3,
        category: { name: 'Vinyl' },
        artist: { name: 'Miles Davis' },
        genre: { name: 'Jazz' },
      },
    ];
    productService.getProducts.mockResolvedValue(products);

    const response = await request(app).get('/api/products');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(products);
    expect(productService.getProducts).toHaveBeenCalledTimes(1);
  });

  it('passes database errors to the shared error handler', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    productService.getProducts.mockRejectedValue(new Error('Database unavailable'));

    const response = await request(app).get('/api/products');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });

  it('passes the genre query param through to the service', async () => {
    productService.getProducts.mockResolvedValue([]);

    await request(app).get('/api/products?genre=Rock');

    expect(productService.getProducts).toHaveBeenCalledWith({ genre: 'Rock' });
  });

  it('returns one product by id', async () => {
    productService.getProductById.mockResolvedValue({ id: 1, name: 'Kind of Blue' });

    const response = await request(app).get('/api/products/1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 1, name: 'Kind of Blue' });
  });

  it('returns 404 when the product does not exist', async () => {
    productService.getProductById.mockResolvedValue(null);

    const response = await request(app).get('/api/products/99999');

    expect(response.status).toBe(404);
  });

  it('returns 400 for a non-numeric id', async () => {
    const response = await request(app).get('/api/products/abc');

    expect(response.status).toBe(400);
  });

  it('passes the search query param through to the service', async () => {
    productService.getProducts.mockResolvedValue([]);

    await request(app).get('/api/products?search=moon');

    expect(productService.getProducts).toHaveBeenCalledWith({ genre: undefined, search: 'moon' });
  });

  it('passes the sort query param through to the service', async () => {
    productService.getProducts.mockResolvedValue([]);

    await request(app).get('/api/products?sort=price_asc');

    expect(productService.getProducts).toHaveBeenCalledWith({
      genre: undefined,
      search: undefined,
      sort: 'price_asc',
    });
  });

  describe('PATCH /api/products/:id/stock', () => {
    function patchStock(id, body, auth = productManager) {
      const req = request(app).patch(`/api/products/${id}/stock`);
      if (auth) req.set('Authorization', auth);
      return req.send(body);
    }

    //test 1: a product manager sets the new total, the service gets real numbers
    it('lets a product manager set the stock', async () => {
      productService.updateStock.mockResolvedValue({ id: 17, quantity: 12 });

      const response = await patchStock(17, { quantity: 12 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: 17, quantity: 12 });
      expect(productService.updateStock).toHaveBeenCalledWith(17, 12);
    });

    //test 2: 0 is valid, it means sold out
    it('accepts 0 as the new stock', async () => {
      productService.updateStock.mockResolvedValue({ id: 17, quantity: 0 });

      const response = await patchStock(17, { quantity: 0 });

      expect(response.status).toBe(200);
      expect(productService.updateStock).toHaveBeenCalledWith(17, 0);
    });

    //test 3: no login means 401
    it('returns 401 without a token', async () => {
      const response = await patchStock(17, { quantity: 12 }, null);

      expect(response.status).toBe(401);
      expect(productService.updateStock).not.toHaveBeenCalled();
    });

    //test 4: a token that was not signed by the server means 401
    it('returns 401 for an invalid token', async () => {
      const response = await patchStock(17, { quantity: 12 }, 'Bearer not-a-token');

      expect(response.status).toBe(401);
      expect(productService.updateStock).not.toHaveBeenCalled();
    });

    //test 5: every other role is forbidden
    it.each(['CUSTOMER', 'SALES_MANAGER', 'SUPPORT_AGENT'])('returns 403 for %s', async (role) => {
      const response = await patchStock(17, { quantity: 12 }, `Bearer ${tokenFor(role)}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Forbidden' });
      expect(productService.updateStock).not.toHaveBeenCalled();
    });

    //test 6: quantity must be a whole number from 0 to the largest database integer
    it.each([
      ['missing', {}],
      ['null', { quantity: null }],
      ['negative', { quantity: -1 }],
      ['a decimal', { quantity: 2.5 }],
      ['text', { quantity: 'abc' }],
      ['too large', { quantity: 2147483648 }],
    ])('returns 400 when quantity is %s', async (_label, body) => {
      const response = await patchStock(17, body);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/quantity/);
      expect(productService.updateStock).not.toHaveBeenCalled();
    });

    //test 7: the id is checked with the same rule as GET /:id
    it('returns 400 for an invalid id', async () => {
      const response = await patchStock('abc', { quantity: 12 });

      expect(response.status).toBe(400);
      expect(productService.updateStock).not.toHaveBeenCalled();
    });

    //test 8: the service's 404 reaches the client in the shared error format
    it('returns 404 when the product does not exist', async () => {
      productService.updateStock.mockRejectedValue(
        Object.assign(new Error('Product not found'), { status: 404 })
      );

      const response = await patchStock(99999, { quantity: 12 });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Product not found' });
    });
  });
});
