const request = require('supertest');

jest.mock('../src/modules/products/product.service', () => ({
  getProducts: jest.fn(),
}));
const productService = require('../src/modules/products/product.service');
const app = require('../src/app');

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
});
