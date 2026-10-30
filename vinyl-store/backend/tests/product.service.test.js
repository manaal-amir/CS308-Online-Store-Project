jest.mock('../src/config/prisma', () => ({
  product: {
    findMany: jest.fn(),
  },
}));
const prisma = require('../src/config/prisma');
const productService = require('../src/modules/products/product.service');

beforeEach(() => {
  jest.resetAllMocks();
});

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
      orderBy: { createdAt: 'desc' },
      select: {
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
      },
    });
    expect(products[0].price).toBe(2500.5);
    expect(products[0].artist.name).toBe('Miles Davis');
    expect(products[0]).not.toHaveProperty('cost');
  });
});
