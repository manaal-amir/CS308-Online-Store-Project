const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/modules/products/product.service', () => ({
  getProducts: jest.fn(),
  getProductById: jest.fn(),
  updateStock: jest.fn(),
  getProductOptions: jest.fn(),
  createProduct: jest.fn(),
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

  describe('GET /api/products/options', () => {
    function getOptions(auth = productManager) {
      const req = request(app).get('/api/products/options');
      if (auth) req.set('Authorization', auth);
      return req;
    }

    //test 1: a product manager gets the dropdown lists, and "options" is not read as an id
    it('returns the form options to a product manager', async () => {
      const options = {
        categories: [{ id: 1, name: 'Vinyl' }],
        artists: [{ id: 2, name: 'Miles Davis' }],
        genres: [{ id: 3, name: 'Jazz' }],
      };
      productService.getProductOptions.mockResolvedValue(options);

      const response = await getOptions();

      expect(response.status).toBe(200);
      expect(response.body).toEqual(options);
      expect(productService.getProductById).not.toHaveBeenCalled();
    });

    //test 2: no token means 401
    it('returns 401 without a token', async () => {
      const response = await getOptions(null);

      expect(response.status).toBe(401);
      expect(productService.getProductOptions).not.toHaveBeenCalled();
    });

    //test 3: every other role is forbidden
    it.each(['CUSTOMER', 'SALES_MANAGER', 'SUPPORT_AGENT'])('returns 403 for %s', async (role) => {
      const response = await getOptions(`Bearer ${tokenFor(role)}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Forbidden' });
      expect(productService.getProductOptions).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/products', () => {
    //a valid record like the catalogue form sends it, optional fields left out
    const record = {
      name: 'Kind of Blue',
      model: 'Reissue',
      serialNumber: 'VS-LP-100',
      distributor: 'Blue Note',
      warrantyStatus: '1 year',
      description: 'A jazz record',
      quantity: 5,
      price: 19.99,
      categoryId: 1,
    };

    function postRecord(body, auth = productManager) {
      const req = request(app).post('/api/products');
      if (auth) req.set('Authorization', auth);
      return req.send(body);
    }

    //record without the given field
    function without(field) {
      const copy = { ...record };
      delete copy[field];
      return copy;
    }

    //test 1: a product manager adds a record and gets it back with 201
    it('lets a product manager add a record', async () => {
      const created = { id: 50, ...record, averageRating: null, ratingCount: 0 };
      productService.createProduct.mockResolvedValue(created);

      const response = await postRecord(record);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(created);
      expect(productService.createProduct).toHaveBeenCalledWith(record);
    });

    //test 2: no token means 401
    it('returns 401 without a token', async () => {
      const response = await postRecord(record, null);

      expect(response.status).toBe(401);
      expect(productService.createProduct).not.toHaveBeenCalled();
    });

    //test 3: every other role is forbidden
    it.each(['CUSTOMER', 'SALES_MANAGER', 'SUPPORT_AGENT'])('returns 403 for %s', async (role) => {
      const response = await postRecord(record, `Bearer ${tokenFor(role)}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Forbidden' });
      expect(productService.createProduct).not.toHaveBeenCalled();
    });

    //test 4: every required field must be there
    it.each(Object.keys(record))('returns 400 when %s is missing', async (field) => {
      const response = await postRecord(without(field));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(`${field} is required`);
      expect(productService.createProduct).not.toHaveBeenCalled();
    });

    //test 5: values the validator must reject, the service is never called for them
    it.each([
      ['name is only spaces', { name: '   ' }, 'name is required'],
      ['quantity is negative', { quantity: -1 }, 'quantity must be at least 0'],
      ['quantity is a decimal', { quantity: 2.5 }, 'quantity must be an integer'],
      ['price is 0', { price: 0 }, 'price must be at least 0.01'],
      ['price has 3 decimals', { price: 1.999 }, 'price must have at most 2 decimal places'],
      ['price is too large', { price: 100000000 }, 'price must be at most 99999999.99'],
      ['cost is negative', { cost: -1 }, 'cost must be at least 0'],
      ['cost has 3 decimals', { cost: 0.005 }, 'cost must have at most 2 decimal places'],
      ['categoryId is 0', { categoryId: 0 }, 'categoryId must be at least 1'],
      ['categoryId is text', { categoryId: 'abc' }, 'categoryId must be an integer'],
      ['artistId is a decimal', { artistId: 1.5 }, 'artistId must be an integer'],
      [
        'imageUrl is a javascript: link',
        { imageUrl: 'javascript:alert(1)' },
        'imageUrl must start with http:// or https://',
      ],
    ])('returns 400 when %s', async (_label, change, message) => {
      const response = await postRecord({ ...record, ...change });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: message });
      expect(productService.createProduct).not.toHaveBeenCalled();
    });

    //test 6: prices with up to 2 decimals pass, even ones floats cannot store exactly
    it.each([19.99, 0.01, 0.1, 99999999.99])('accepts a price of %s', async (price) => {
      productService.createProduct.mockResolvedValue({ id: 50, ...record, price });

      const response = await postRecord({ ...record, price });

      expect(response.status).toBe(201);
      expect(productService.createProduct.mock.calls[0][0].price).toBe(price);
    });

    //test 7: a cost of 0 and every optional field are accepted
    it('accepts a cost of 0 and all optional fields', async () => {
      const full = {
        ...record,
        cost: 0,
        artistId: 2,
        genreId: 3,
        imageUrl: 'https://example.com/cover.jpg',
      };
      productService.createProduct.mockResolvedValue({ id: 50, ...record });

      const response = await postRecord(full);

      expect(response.status).toBe(201);
      expect(productService.createProduct).toHaveBeenCalledWith(full);
    });

    //test 8: the service's 409 reaches the client in the shared error format
    it('returns 409 for a duplicate serial number', async () => {
      productService.createProduct.mockRejectedValue(
        Object.assign(new Error('A record with this serial number already exists'), {
          status: 409,
        })
      );

      const response = await postRecord(record);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: 'A record with this serial number already exists' });
    });
  });
});
