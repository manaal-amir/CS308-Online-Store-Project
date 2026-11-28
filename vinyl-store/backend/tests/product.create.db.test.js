//these tests add real records to the real database (docker must be running)
//they check what fake tests cannot: a missing cost is really saved as null,
//and the unique serial number and the category link are enforced by the database

//load DATABASE_URL from .env so this file knows whether a database is available
require('dotenv').config();

//skip these tests where there is no database
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

//database calls are slower than fake ones, so allow up to 20 seconds per test
jest.setTimeout(20000);

describeIfDb('add a record with the real database', () => {
  let prisma;
  let productService;
  let category;
  const productIds = [];

  //a unique serial number for each record, so reruns never clash with old rows
  function serialNumber() {
    return `CREATE-TEST-${Date.now()}-${Math.random()}`;
  }

  //the required fields of a record, as the validator passes them on
  function record(overrides = {}) {
    return {
      name: 'Create Test Record',
      model: 'Test',
      serialNumber: serialNumber(),
      distributor: 'Test',
      warrantyStatus: 'None',
      description: 'Only used by create tests',
      quantity: 3,
      price: 19.99,
      categoryId: category.id,
      ...overrides,
    };
  }

  beforeAll(async () => {
    //load prisma only when the tests really run, so a skipped run never touches the database
    prisma = require('../src/config/prisma');
    productService = require('../src/modules/products/product.service');
    category = await prisma.category.findFirst();
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.$disconnect();
  });

  //test 1: no cost is saved as null, checkout then uses half the price (requirement 11)
  it('saves a record without a cost as null', async () => {
    const created = await productService.createProduct(record());
    productIds.push(created.id);

    expect(created.price).toBe(19.99);
    expect(created).not.toHaveProperty('cost');
    const saved = await prisma.product.findUnique({ where: { id: created.id } });
    expect(saved.cost).toBeNull();
    expect(saved.price.toString()).toBe('19.99');
  });

  //test 2: a second record with the same serial number is refused with 409
  it('returns 409 for a duplicate serial number', async () => {
    const first = await productService.createProduct(record());
    productIds.push(first.id);

    await expect(
      productService.createProduct(record({ serialNumber: first.serialNumber }))
    ).rejects.toMatchObject({
      status: 409,
      message: 'A record with this serial number already exists',
    });
  });

  //test 3: a category id that does not exist is refused with 400, nothing is saved
  it('returns 400 for a category that does not exist', async () => {
    const data = record({ categoryId: 2147483647 });

    await expect(productService.createProduct(data)).rejects.toMatchObject({
      status: 400,
      message: 'Category, artist or genre not found',
    });
    const saved = await prisma.product.findUnique({
      where: { serialNumber: data.serialNumber },
    });
    expect(saved).toBeNull();
  });
});
