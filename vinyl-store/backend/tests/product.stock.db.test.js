//these tests save real stock values in the real database (docker must be running)
//they check what fake tests cannot: the new total is saved, and 0 really stops new cart items

//load DATABASE_URL from .env so this file knows whether a database is available
require('dotenv').config();

//skip these tests where there is no database
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

//database calls are slower than fake ones, so allow up to 20 seconds per test
jest.setTimeout(20000);

describeIfDb('update stock with the real database', () => {
  let prisma;
  let productService;
  let cartService;
  let product;
  const userIds = [];

  beforeAll(async () => {
    //load prisma only when the tests really run, so a skipped run never touches the database
    prisma = require('../src/config/prisma');
    productService = require('../src/modules/products/product.service');
    cartService = require('../src/modules/cart/cart.service');

    //a throwaway record, so the stock changes never touch the seed data
    const category = await prisma.category.findFirst();
    product = await prisma.product.create({
      data: {
        name: 'Stock Test Record',
        model: 'Test',
        serialNumber: `STOCK-TEST-${Date.now()}-${Math.random()}`,
        quantity: 10,
        price: '100.00',
        warrantyStatus: 'None',
        distributor: 'Test',
        description: 'Only used by stock tests',
        categoryId: category.id,
      },
    });
  });

  afterAll(async () => {
    //carts and their items are deleted with their user (onDelete: Cascade)
    //they must go before the product they point to
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.product.deleteMany({ where: { id: product.id } });
    await prisma.$disconnect();
  });

  //test 1: the quantity is the new total, not an amount added to the old stock
  it('saves the new total stock', async () => {
    const result = await productService.updateStock(product.id, 5);

    expect(result).toEqual({ id: product.id, quantity: 5 });
    const saved = await prisma.product.findUnique({ where: { id: product.id } });
    expect(saved.quantity).toBe(5);
  });

  //test 2: 0 is saved, and the record can no longer be added to a cart
  it('saves 0, after which adding the record to a cart fails with 409', async () => {
    await productService.updateStock(product.id, 0);

    const saved = await prisma.product.findUnique({ where: { id: product.id } });
    expect(saved.quantity).toBe(0);

    const user = await prisma.user.create({
      data: {
        name: 'Stock',
        lastname: 'Test',
        email: `stock-test-${Date.now()}-${Math.random()}@x.com`,
        passwordHash: 'not-a-real-hash',
      },
    });
    userIds.push(user.id);

    await expect(cartService.addItem(user.id, product.id, 1)).rejects.toMatchObject({
      status: 409,
    });
  });

  //test 3: a product id that does not exist gives a 404, nothing is created
  it('returns 404 for a product that does not exist', async () => {
    await expect(productService.updateStock(2147483647, 5)).rejects.toMatchObject({
      status: 404,
      message: 'Product not found',
    });
  });
});
