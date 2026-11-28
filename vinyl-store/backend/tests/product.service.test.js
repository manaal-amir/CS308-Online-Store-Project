jest.mock('../src/config/prisma', () => ({
  product: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  category: { findMany: jest.fn() },
  artist: { findMany: jest.fn() },
  genre: { findMany: jest.fn() },
  rating: { groupBy: jest.fn(), aggregate: jest.fn() },
}));
const prisma = require('../src/config/prisma');
const productService = require('../src/modules/products/product.service');

beforeEach(() => {
  jest.resetAllMocks();
  //by default no record has ratings, tests that need ratings set their own
  prisma.rating.groupBy.mockResolvedValue([]);
  prisma.rating.aggregate.mockResolvedValue({ _avg: { value: null }, _count: { _all: 0 } });
});

const SELECT = {
  id: true,
  name: true,
  model: true,
  serialNumber: true,
  quantity: true,
  price: true,
  distributor: true,
  description: true,
  imageUrl: true,
  createdAt: true,
  warrantyStatus: true, // ← added
  category: { select: { name: true } },
  artist: { select: { name: true } },
  genre: { select: { name: true } },
};

describe('product service', () => {
  it('loads public product data and converts Decimal prices to numbers', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    prisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Kind of Blue',
        model: 'Reissue',
        serialNumber: 'VS-LP-001',
        quantity: 3,
        price: { toString: () => '2500.50' },
        distributor: 'Blue Note',
        description: 'A jazz record',
        imageUrl: null,
        createdAt,
        warrantyStatus: 'Covered against manufacturing defects',
        category: { name: 'Vinyl' },
        artist: { name: 'Miles Davis' },
        genre: { name: 'Jazz' },
      },
    ]);

    const products = await productService.getProducts();

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });
    expect(products[0].price).toBe(2500.5);
    expect(products[0].artist.name).toBe('Miles Davis');
    expect(products[0]).not.toHaveProperty('cost');
  });

  it('filters by genre, case-insensitively', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await productService.getProducts({ genre: 'rock' });

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        AND: [{ genre: { name: { equals: 'rock', mode: 'insensitive' } } }],
      },
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });
  });

  it('returns everything when no genre is given', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await productService.getProducts({});

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });
  });

  it('returns one product by id', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 1,
      name: 'Kind of Blue',
      model: 'Reissue',
      serialNumber: 'VS-LP-001',
      quantity: 3,
      price: { toString: () => '2500.50' },
      distributor: 'Blue Note',
      description: 'A jazz record',
      imageUrl: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      warrantyStatus: 'Covered against manufacturing defects',
      category: { name: 'Vinyl' },
      artist: { name: 'Miles Davis' },
      genre: { name: 'Jazz' },
    });

    const product = await productService.getProductById(1);

    expect(prisma.product.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: SELECT,
    });
    expect(product.price).toBe(2500.5);
    expect(product.name).toBe('Kind of Blue');
  });

  it('returns null when the product does not exist', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    const product = await productService.getProductById(99999);

    expect(product).toBeNull();
  });

  it('searches by name, case-insensitively', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await productService.getProducts({ search: 'moon' });

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: 'moon', mode: 'insensitive' } },
              { description: { contains: 'moon', mode: 'insensitive' } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });
  });

  it('combines genre and search filters with AND', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await productService.getProducts({ genre: 'Rock', search: 'the' });

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { genre: { name: { equals: 'Rock', mode: 'insensitive' } } },
          {
            OR: [
              { name: { contains: 'the', mode: 'insensitive' } },
              { description: { contains: 'the', mode: 'insensitive' } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });
  });

  it('sorts by price ascending', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await productService.getProducts({ sort: 'price_asc' });

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { price: 'asc' },
      select: SELECT,
    });
  });

  it('sorts by price descending', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await productService.getProducts({ sort: 'price_desc' });

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { price: 'desc' },
      select: SELECT,
    });
  });

  it('falls back to default order for an unrecognized sort value', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await productService.getProducts({ sort: 'garbage' });

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });
  });

  //VS-15 (requirement 7): out of stock records must still show up in the catalog and in search
  it('returns out of stock products from search with quantity 0', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 4, name: 'Hello, Dolly!', quantity: 0, price: '1150.00' },
    ]);

    const products = await productService.getProducts({ search: 'dolly' });

    expect(products).toEqual([
      {
        id: 4,
        name: 'Hello, Dolly!',
        quantity: 0,
        price: 1150,
        averageRating: null,
        ratingCount: 0,
      },
    ]);
  });

  it('never filters on stock, so search and the catalog keep quantity 0 records', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await productService.getProducts({ genre: 'Jazz', search: 'dolly' });
    await productService.getProducts();

    for (const [query] of prisma.product.findMany.mock.calls) {
      expect(JSON.stringify(query.where ?? {})).not.toContain('quantity');
    }
  });

  //SCRUM-161 (requirement 5): the catalog and the product page show each record's rating
  describe('ratings', () => {
    //test 1: a rated record gets its rounded average and count, an unrated one gets null and 0
    it('adds the average rating and count to each listed product', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 1, name: 'Rated', price: '100.00' },
        { id: 2, name: 'Not rated', price: '100.00' },
      ]);
      prisma.rating.groupBy.mockResolvedValue([
        { productId: 1, _avg: { value: 13 / 3 }, _count: { _all: 3 } },
      ]);

      const products = await productService.getProducts();

      expect(products).toEqual([
        { id: 1, name: 'Rated', price: 100, averageRating: 4.3, ratingCount: 3 },
        { id: 2, name: 'Not rated', price: 100, averageRating: null, ratingCount: 0 },
      ]);
    });

    //test 2: one ratings query for the whole list, not one per record
    it('looks up the ratings of all listed products in one query', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 1, name: 'A', price: '100.00' },
        { id: 2, name: 'B', price: '100.00' },
        { id: 3, name: 'C', price: '100.00' },
      ]);

      await productService.getProducts();

      expect(prisma.rating.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.rating.groupBy).toHaveBeenCalledWith({
        by: ['productId'],
        where: { productId: { in: [1, 2, 3] } },
        _avg: { value: true },
        _count: { _all: true },
      });
    });

    //test 3: an empty catalog does not query ratings at all
    it('does not query ratings when no products are found', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      const products = await productService.getProducts({ search: 'nothing' });

      expect(products).toEqual([]);
      expect(prisma.rating.groupBy).not.toHaveBeenCalled();
    });

    //test 4: the product page gets the same two fields, for rated and unrated records
    it('adds the average rating and count to one product', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 1, name: 'Rated', price: '100.00' });
      prisma.rating.aggregate.mockResolvedValue({ _avg: { value: 4.5 }, _count: { _all: 2 } });

      expect(await productService.getProductById(1)).toEqual({
        id: 1,
        name: 'Rated',
        price: 100,
        averageRating: 4.5,
        ratingCount: 2,
      });
      expect(prisma.rating.aggregate).toHaveBeenCalledWith({
        where: { productId: 1 },
        _avg: { value: true },
        _count: { _all: true },
      });

      prisma.product.findUnique.mockResolvedValue({ id: 2, name: 'Not rated', price: '100.00' });
      prisma.rating.aggregate.mockResolvedValue({ _avg: { value: null }, _count: { _all: 0 } });

      expect(await productService.getProductById(2)).toEqual({
        id: 2,
        name: 'Not rated',
        price: 100,
        averageRating: null,
        ratingCount: 0,
      });
    });

    //test 5: a missing product is still null, and its ratings are never looked up
    it('does not query ratings for a product that does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      expect(await productService.getProductById(99999)).toBeNull();
      expect(prisma.rating.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('updateStock', () => {
    //test 1: the new total is the only field that changes, and only id and quantity come back
    it('sends only the new quantity to the database', async () => {
      prisma.product.update.mockResolvedValue({ id: 17, quantity: 12 });

      expect(await productService.updateStock(17, 12)).toEqual({ id: 17, quantity: 12 });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 17 },
        data: { quantity: 12 },
        select: { id: true, quantity: true },
      });
    });

    //test 2: 0 is a real stock value (sold out), not a missing one
    it('accepts 0 as the new stock', async () => {
      prisma.product.update.mockResolvedValue({ id: 17, quantity: 0 });

      expect(await productService.updateStock(17, 0)).toEqual({ id: 17, quantity: 0 });
      expect(prisma.product.update.mock.calls[0][0].data).toEqual({ quantity: 0 });
    });

    //test 3: prisma says P2025 when there is no product with that id
    it('turns a missing product into a 404', async () => {
      prisma.product.update.mockRejectedValue(
        Object.assign(new Error('missing'), { code: 'P2025' })
      );

      await expect(productService.updateStock(99999, 5)).rejects.toMatchObject({
        status: 404,
        message: 'Product not found',
      });
    });

    //test 4: any other database error is passed on unchanged
    it('rethrows other database errors', async () => {
      const dbError = new Error('Database unavailable');
      prisma.product.update.mockRejectedValue(dbError);

      await expect(productService.updateStock(17, 5)).rejects.toBe(dbError);
    });
  });

  describe('getProductOptions', () => {
    //test 1: three lists of { id, name }, each sorted by name, in the shape the form expects
    it('returns categories, artists and genres as id and name', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 1, name: 'Vinyl' }]);
      prisma.artist.findMany.mockResolvedValue([{ id: 2, name: 'Miles Davis' }]);
      prisma.genre.findMany.mockResolvedValue([{ id: 3, name: 'Jazz' }]);

      expect(await productService.getProductOptions()).toEqual({
        categories: [{ id: 1, name: 'Vinyl' }],
        artists: [{ id: 2, name: 'Miles Davis' }],
        genres: [{ id: 3, name: 'Jazz' }],
      });
      const query = { select: { id: true, name: true }, orderBy: { name: 'asc' } };
      expect(prisma.category.findMany).toHaveBeenCalledWith(query);
      expect(prisma.artist.findMany).toHaveBeenCalledWith(query);
      expect(prisma.genre.findMany).toHaveBeenCalledWith(query);
    });
  });

  describe('createProduct', () => {
    //the required fields the form always sends
    const required = {
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

    //what prisma gives back for the new record, price is a Decimal there
    function saved() {
      return {
        id: 50,
        ...required,
        price: { toString: () => '19.99' },
        imageUrl: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        category: { name: 'Vinyl' },
        artist: null,
        genre: null,
      };
    }

    //the data that reached prisma.product.create
    function createdData() {
      return prisma.product.create.mock.calls[0][0].data;
    }

    //test 1: every allowed field is passed on, with the public select
    it('saves only the allowed fields', async () => {
      prisma.product.create.mockResolvedValue(saved());
      const optional = {
        artistId: 2,
        genreId: 3,
        cost: 8.5,
        imageUrl: 'https://example.com/cover.jpg',
      };

      await productService.createProduct({ ...required, ...optional });

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: { ...required, ...optional },
        select: SELECT,
      });
    });

    //test 2: no cost means null, checkout then uses half the price (requirement 11)
    it('saves null when no cost is given', async () => {
      prisma.product.create.mockResolvedValue(saved());

      await productService.createProduct(required);

      expect(createdData().cost).toBeNull();
    });

    //test 3: 0 is a real cost, not a missing one
    it('keeps a cost of 0', async () => {
      prisma.product.create.mockResolvedValue(saved());

      await productService.createProduct({ ...required, cost: 0 });

      expect(createdData().cost).toBe(0);
    });

    //test 4: the validator lets empty optional values through, they are saved as null
    it.each([
      ['empty text', ''],
      ['null', null],
    ])('saves null for optional fields that are %s', async (_label, empty) => {
      prisma.product.create.mockResolvedValue(saved());

      await productService.createProduct({
        ...required,
        artistId: empty,
        genreId: empty,
        cost: empty,
        imageUrl: empty,
      });

      expect(createdData()).toMatchObject({
        artistId: null,
        genreId: null,
        cost: null,
        imageUrl: null,
      });
    });

    //test 5: fields that are not on the form can never be set by the request
    it('ignores extra fields like id, createdAt and originalPrice', async () => {
      prisma.product.create.mockResolvedValue(saved());

      await productService.createProduct({
        ...required,
        id: 999,
        createdAt: '2000-01-01',
        originalPrice: 50,
        isAdmin: true,
      });

      const data = createdData();
      expect(data).not.toHaveProperty('id');
      expect(data).not.toHaveProperty('createdAt');
      expect(data).not.toHaveProperty('originalPrice');
      expect(data).not.toHaveProperty('isAdmin');
    });

    //test 6: the new record comes back like the GET routes return it, without cost
    it('returns the public record with a number price and no ratings', async () => {
      prisma.product.create.mockResolvedValue(saved());

      const product = await productService.createProduct({ ...required, cost: 8.5 });

      expect(product.price).toBe(19.99);
      expect(product.averageRating).toBeNull();
      expect(product.ratingCount).toBe(0);
      expect(product).not.toHaveProperty('cost');
      expect(prisma.product.create.mock.calls[0][0].select).not.toHaveProperty('cost');
    });

    //test 7: serialNumber is unique, a second record with the same one is a conflict
    it('turns a duplicate serial number into a 409', async () => {
      prisma.product.create.mockRejectedValue(
        Object.assign(new Error('unique'), { code: 'P2002' })
      );

      await expect(productService.createProduct(required)).rejects.toMatchObject({
        status: 409,
        message: 'A record with this serial number already exists',
      });
    });

    //test 8: a category, artist or genre id that does not exist is the client's mistake
    it('turns a missing category, artist or genre into a 400', async () => {
      prisma.product.create.mockRejectedValue(
        Object.assign(new Error('foreign key'), { code: 'P2003' })
      );

      await expect(productService.createProduct(required)).rejects.toMatchObject({
        status: 400,
        message: 'Category, artist or genre not found',
      });
    });

    //test 9: any other database error is passed on unchanged
    it('rethrows other database errors', async () => {
      const dbError = new Error('Database unavailable');
      prisma.product.create.mockRejectedValue(dbError);

      await expect(productService.createProduct(required)).rejects.toBe(dbError);
    });
  });
});
