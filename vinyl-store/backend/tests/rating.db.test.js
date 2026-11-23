//these tests save real ratings in the real database (docker must be running)
//they check what fake tests cannot: one row per customer, the average, and double clicks

//load DATABASE_URL from .env so this file knows whether a database is available
require('dotenv').config();

//skip these tests where there is no database
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

//database calls are slower than fake ones, so allow up to 20 seconds per test
jest.setTimeout(20000);

describeIfDb('rate a record with the real database', () => {
  let prisma;
  let ratingService;
  let product;
  const userIds = [];
  const productIds = [];

  //makes a throwaway record, so each average only depends on the test that uses it
  async function createProduct() {
    const category = await prisma.category.findFirst();
    const created = await prisma.product.create({
      data: {
        name: 'Rating Test Record',
        model: 'Test',
        serialNumber: `RATING-TEST-${Date.now()}-${Math.random()}`,
        quantity: 10,
        price: '100.00',
        warrantyStatus: 'None',
        distributor: 'Test',
        description: 'Only used by rating tests',
        categoryId: category.id,
      },
    });
    productIds.push(created.id);
    return created;
  }

  //makes a throwaway customer, with an order of the record in the given status
  //status null means the customer never ordered it, record defaults to the shared test record
  async function customerWithOrder(status, record = product) {
    const user = await prisma.user.create({
      data: {
        name: 'Rating',
        lastname: 'Test',
        email: `rating-test-${Date.now()}-${Math.random()}@x.com`,
        passwordHash: 'not-a-real-hash',
      },
    });
    userIds.push(user.id);
    if (status) {
      await prisma.order.create({
        data: {
          userId: user.id,
          status,
          totalPrice: '100.00',
          deliveryAddress: 'Test St 1',
          cardLast4: '4242',
          items: {
            create: { productId: record.id, quantity: 1, unitPrice: '100.00', unitCost: '50.00' },
          },
        },
      });
    }
    return user.id;
  }

  beforeAll(async () => {
    //load prisma only when the tests really run, so a skipped run never touches the database
    prisma = require('../src/config/prisma');
    ratingService = require('../src/modules/reviews/rating.service');

    product = await createProduct();
  });

  afterAll(async () => {
    //ratings are deleted with their user and product (onDelete: Cascade)
    //orders must go before users and the product they point to
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.$disconnect();
  });

  //test 1: rating again changes the stars, the customer still has one rating
  it('updates the existing rating instead of adding a second one', async () => {
    const userId = await customerWithOrder('DELIVERED');

    await ratingService.rateProduct(userId, product.id, 2);
    const result = await ratingService.rateProduct(userId, product.id, 5);

    expect(result).toMatchObject({ productId: product.id, value: 5 });
    const rows = await prisma.rating.findMany({ where: { userId, productId: product.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(5);
  });

  //test 2: the average and count include every customer's rating
  it('returns the average of all ratings of the record', async () => {
    //a fresh record, so only these two ratings count
    const record = await createProduct();
    const first = await customerWithOrder('DELIVERED', record);
    const second = await customerWithOrder('DELIVERED', record);

    await ratingService.rateProduct(first, record.id, 5);
    const result = await ratingService.rateProduct(second, record.id, 4);

    expect(result).toMatchObject({ averageRating: 4.5, ratingCount: 2 });
  });

  //test 3: an order that is still on its way does not count
  it('rejects a customer whose order is in transit', async () => {
    const userId = await customerWithOrder('IN_TRANSIT');
    await expect(ratingService.rateProduct(userId, product.id, 3)).rejects.toMatchObject({
      status: 403,
    });
    expect(await prisma.rating.count({ where: { userId } })).toBe(0);
  });

  //test 4: a double click on the stars saves one rating, both requests succeed
  it('keeps one rating when the first rating is sent twice at the same moment', async () => {
    const userId = await customerWithOrder('DELIVERED');

    const results = await Promise.allSettled([
      ratingService.rateProduct(userId, product.id, 3),
      ratingService.rateProduct(userId, product.id, 3),
    ]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(await prisma.rating.count({ where: { userId } })).toBe(1);
  });

  //test 5: the review state tells the product page what to show
  it('returns the review state for the product page', async () => {
    const delivered = await customerWithOrder('DELIVERED');
    await ratingService.rateProduct(delivered, product.id, 4);
    await prisma.comment.create({
      data: { userId: delivered, productId: product.id, content: 'Waiting', status: 'PENDING' },
    });
    const neverOrdered = await customerWithOrder(null);

    expect(await ratingService.getMyReview(delivered, product.id)).toEqual({
      productId: product.id,
      canReview: true,
      rating: 4,
      hasPendingComment: true,
    });
    expect(await ratingService.getMyReview(neverOrdered, product.id)).toEqual({
      productId: product.id,
      canReview: false,
      rating: null,
      hasPendingComment: false,
    });
  });
});
