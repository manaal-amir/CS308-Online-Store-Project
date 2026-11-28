//SCRUM-161: the catalog and the product page show each record's rating, checked with the real database
//(docker must be running). They check what fake tests cannot: the real groupBy and aggregate results

//load DATABASE_URL from .env so this file knows whether a database is available
require('dotenv').config();

//skip these tests where there is no database
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

//database calls are slower than fake ones, so allow up to 20 seconds per test
jest.setTimeout(20000);

describeIfDb('product rating fields with the real database', () => {
  let prisma;
  let productService;
  let rated;
  let unrated;
  const userIds = [];
  const productIds = [];

  //makes a throwaway record, so its average only depends on this file
  async function createProduct() {
    const category = await prisma.category.findFirst();
    const created = await prisma.product.create({
      data: {
        name: 'Product Rating Test Record',
        model: 'Test',
        serialNumber: `PRODUCT-RATING-TEST-${Date.now()}-${Math.random()}`,
        quantity: 10,
        price: '100.00',
        warrantyStatus: 'None',
        distributor: 'Test',
        description: 'Only used by product rating tests',
        categoryId: category.id,
      },
    });
    productIds.push(created.id);
    return created;
  }

  //makes a throwaway customer
  async function createUser() {
    const user = await prisma.user.create({
      data: {
        name: 'Product',
        lastname: 'Rating',
        email: `product-rating-test-${Date.now()}-${Math.random()}@x.com`,
        passwordHash: 'not-a-real-hash',
      },
    });
    userIds.push(user.id);
    return user.id;
  }

  beforeAll(async () => {
    //load prisma only when the tests really run, so a skipped run never touches the database
    prisma = require('../src/config/prisma');
    productService = require('../src/modules/products/product.service');

    //one record rated 5 and 4, and one record nobody rated
    rated = await createProduct();
    unrated = await createProduct();
    const first = await createUser();
    const second = await createUser();
    await prisma.rating.create({ data: { userId: first, productId: rated.id, value: 5 } });
    await prisma.rating.create({ data: { userId: second, productId: rated.id, value: 4 } });
  });

  afterAll(async () => {
    //ratings are deleted with their user and product (onDelete: Cascade)
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.$disconnect();
  });

  //test 1: the catalog list has the average and count of each record
  it('returns the rating fields in the product list', async () => {
    const products = await productService.getProducts();

    //find by id, because other test files add products at the same time
    const ratedRow = products.find((p) => p.id === rated.id);
    const unratedRow = products.find((p) => p.id === unrated.id);
    expect(ratedRow).toMatchObject({ averageRating: 4.5, ratingCount: 2 });
    expect(unratedRow).toMatchObject({ averageRating: null, ratingCount: 0 });
  });

  //test 2: the product page has the same values as the list
  it('returns the same rating fields on the product page', async () => {
    expect(await productService.getProductById(rated.id)).toMatchObject({
      averageRating: 4.5,
      ratingCount: 2,
    });
    expect(await productService.getProductById(unrated.id)).toMatchObject({
      averageRating: null,
      ratingCount: 0,
    });
  });
});
