//these tests save real comments in the real database (docker must be running)
//they check what fake tests cannot: the delivered order rule and the new status column

//load DATABASE_URL from .env so this file knows whether a database is available
require('dotenv').config();

//skip these tests where there is no database
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

//database calls are slower than fake ones, so allow up to 20 seconds per test
jest.setTimeout(20000);

describeIfDb('create comment with the real database', () => {
  let prisma;
  let commentService;
  let product;
  const userIds = [];

  //makes a throwaway customer, with an order of the test product in the given status
  //status null means the customer never ordered it
  async function customerWithOrder(status) {
    const user = await prisma.user.create({
      data: {
        name: 'Comment',
        lastname: 'Test',
        email: `comment-test-${Date.now()}-${Math.random()}@x.com`,
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
            create: { productId: product.id, quantity: 1, unitPrice: '100.00', unitCost: '50.00' },
          },
        },
      });
    }
    return user.id;
  }

  beforeAll(async () => {
    //load prisma only when the tests really run, so a skipped run never touches the database
    prisma = require('../src/config/prisma');
    commentService = require('../src/modules/reviews/comment.service');

    //a test product of our own, so other test files using seeded products are not affected
    const category = await prisma.category.findFirst();
    product = await prisma.product.create({
      data: {
        name: 'Comment Test Record',
        model: 'Test',
        serialNumber: `COMMENT-TEST-${Date.now()}`,
        quantity: 10,
        price: '100.00',
        warrantyStatus: 'None',
        distributor: 'Test',
        description: 'Only used by comment tests',
        categoryId: category.id,
      },
    });
  });

  afterAll(async () => {
    //comments are deleted with their user and product (onDelete: Cascade)
    //orders must go before users and the product they point to
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.$disconnect();
  });

  //test 1: a customer whose order was delivered can comment, it is saved as pending
  it('saves a pending comment for a delivered order', async () => {
    const userId = await customerWithOrder('DELIVERED');

    const result = await commentService.createComment(userId, product.id, 'Lovely pressing');

    expect(result).toMatchObject({ productId: product.id, status: 'PENDING' });
    const saved = await prisma.comment.findUnique({ where: { id: result.id } });
    expect(saved).toMatchObject({ userId, content: 'Lovely pressing', status: 'PENDING' });
  });

  //test 2: an order that is still on its way does not count
  it('rejects a customer whose order is in transit', async () => {
    const userId = await customerWithOrder('IN_TRANSIT');
    await expect(
      commentService.createComment(userId, product.id, 'Too early')
    ).rejects.toMatchObject({ status: 403 });
    expect(await prisma.comment.count({ where: { userId } })).toBe(0);
  });

  //test 3: a customer who never bought the record cannot comment
  it('rejects a customer who never ordered the record', async () => {
    const userId = await customerWithOrder(null);
    await expect(
      commentService.createComment(userId, product.id, 'Never had it')
    ).rejects.toMatchObject({ status: 403 });
  });

  //test 4: a cancelled order does not count either
  it('rejects a customer whose order was cancelled', async () => {
    const userId = await customerWithOrder('CANCELLED');
    await expect(
      commentService.createComment(userId, product.id, 'Cancelled')
    ).rejects.toMatchObject({ status: 403 });
  });

  //test 5: a second comment waits until the first one is approved or rejected
  it('allows a new comment only after the pending one is reviewed', async () => {
    const userId = await customerWithOrder('DELIVERED');
    const first = await commentService.createComment(userId, product.id, 'First');

    await expect(commentService.createComment(userId, product.id, 'Second')).rejects.toMatchObject({
      status: 409,
    });

    await prisma.comment.update({ where: { id: first.id }, data: { status: 'APPROVED' } });
    const second = await commentService.createComment(userId, product.id, 'Second');
    expect(second.status).toBe('PENDING');
  });

  //test 6: a double click sends the comment twice, only one is saved
  it('saves only one comment when sent twice at the same moment', async () => {
    const userId = await customerWithOrder('DELIVERED');

    const results = await Promise.allSettled([
      commentService.createComment(userId, product.id, 'Double click'),
      commentService.createComment(userId, product.id, 'Double click'),
    ]);

    const outcomes = results
      .map((r) => (r.status === 'fulfilled' ? 'ok' : `${r.reason.status}`))
      .sort();
    expect(outcomes).toEqual(['409', 'ok']);
    expect(await prisma.comment.count({ where: { userId } })).toBe(1);
  });
});
