const request = require('supertest');

jest.mock('../src/modules/products/product.service', () => ({
  getProducts: jest.fn(),
  getProductById: jest.fn(),
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
});
