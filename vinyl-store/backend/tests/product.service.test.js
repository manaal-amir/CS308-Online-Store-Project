jest.mock('../src/config/prisma', () => ({
  product: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
}));
const prisma = require('../src/config/prisma');
const productService = require('../src/modules/products/product.service');

beforeEach(() => {
  jest.resetAllMocks();
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
        AND: [
          { genre: { name: { equals: 'rock', mode: 'insensitive' } } },
        ],
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
});