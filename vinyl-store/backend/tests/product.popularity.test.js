//VS-14: sorting products by popularity (total units sold)
jest.mock('../src/config/prisma', () => ({
  product: { findMany: jest.fn(), findUnique: jest.fn() },
  orderItem: { groupBy: jest.fn() },
}));
const prisma = require('../src/config/prisma');
const productService = require('../src/modules/products/product.service');

beforeEach(() => {
  jest.resetAllMocks();
});

//products come from the database newest first, like the default order
const newestFirst = [
  { id: 1, name: 'Newest, never sold', price: '100.00' },
  { id: 2, name: 'Sold 5', price: '100.00' },
  { id: 3, name: 'Sold 20', price: '100.00' },
  { id: 4, name: 'Sold 5 too, but older', price: '100.00' },
  { id: 5, name: 'Oldest, never sold', price: '100.00' },
];

describe('popularity sort', () => {
  //test 1: most units sold first, ties and unsold products keep the newest first order
  it('puts the best sellers first and keeps newest first for ties', async () => {
    prisma.product.findMany.mockResolvedValue(newestFirst);
    prisma.orderItem.groupBy.mockResolvedValue([
      { productId: 2, _sum: { quantity: 5 } },
      { productId: 3, _sum: { quantity: 20 } },
      { productId: 4, _sum: { quantity: 5 } },
    ]);

    const products = await productService.getProducts({ sort: 'popularity' });

    expect(products.map((p) => p.id)).toEqual([3, 2, 4, 1, 5]);
  });

  //test 2: units are counted from order items, and cancelled orders are not counted
  it('counts quantities from order items and ignores cancelled orders', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.orderItem.groupBy.mockResolvedValue([]);

    await productService.getProducts({ sort: 'popularity' });

    expect(prisma.orderItem.groupBy).toHaveBeenCalledWith({
      by: ['productId'],
      where: { order: { status: { not: 'CANCELLED' } } },
      _sum: { quantity: true },
    });
  });

  //test 3: the catalog is still returned in the normal shape, prices are numbers
  it('still converts prices to numbers', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 1, name: 'A', price: '1450.50' }]);
    prisma.orderItem.groupBy.mockResolvedValue([]);

    const products = await productService.getProducts({ sort: 'popularity' });

    expect(products).toEqual([{ id: 1, name: 'A', price: 1450.5 }]);
  });

  //test 4: genre and search filters still apply, and sales are not looked up for other sorts
  it('keeps the filters, and only looks up sales for the popularity sort', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.orderItem.groupBy.mockResolvedValue([]);

    await productService.getProducts({ genre: 'Jazz', search: 'blue', sort: 'popularity' });
    const query = prisma.product.findMany.mock.calls[0][0];
    expect(query.where.AND).toHaveLength(2);

    prisma.orderItem.groupBy.mockClear();
    await productService.getProducts({ sort: 'price_asc' });
    await productService.getProducts();
    expect(prisma.orderItem.groupBy).not.toHaveBeenCalled();
  });
});
