//these tests approve and reject real comments in the real database (docker must be running)
//they check what fake tests cannot: the pending list order, two managers deciding at once,
//and that only approved comments reach the product page

//load DATABASE_URL from .env so this file knows whether a database is available
require('dotenv').config();

//skip these tests where there is no database
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

//database calls are slower than fake ones, so allow up to 20 seconds per test
jest.setTimeout(20000);

describeIfDb('review comments with the real database', () => {
  let prisma;
  let commentService;
  let product;
  let userId;

  //saves a pending comment straight in the database, createdAt set so the order is known
  function pendingComment(content, createdAt) {
    return prisma.comment.create({
      data: { userId, productId: product.id, content, status: 'PENDING', createdAt },
    });
  }

  beforeAll(async () => {
    //load prisma only when the tests really run, so a skipped run never touches the database
    prisma = require('../src/config/prisma');
    commentService = require('../src/modules/reviews/comment.service');

    //a test product and customer of our own, so other test files are not affected
    const category = await prisma.category.findFirst();
    product = await prisma.product.create({
      data: {
        name: 'Review Test Record',
        model: 'Test',
        serialNumber: `REVIEW-TEST-${Date.now()}`,
        quantity: 10,
        price: '100.00',
        warrantyStatus: 'None',
        distributor: 'Test',
        description: 'Only used by comment review tests',
        categoryId: category.id,
      },
    });
    const user = await prisma.user.create({
      data: {
        name: 'Review',
        lastname: 'Test',
        email: `review-test-${Date.now()}@x.com`,
        passwordHash: 'not-a-real-hash',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    //comments are deleted with their user and product (onDelete: Cascade)
    await prisma.user.delete({ where: { id: userId } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.$disconnect();
  });

  //test 1: the pending list is oldest first and leaves out reviewed comments
  it('lists pending comments oldest first without reviewed ones', async () => {
    const newer = await pendingComment('Newer', new Date('2026-11-22T12:00:00Z'));
    const older = await pendingComment('Older', new Date('2026-11-21T12:00:00Z'));
    const reviewed = await pendingComment('Reviewed', new Date('2026-11-20T12:00:00Z'));
    await prisma.comment.update({ where: { id: reviewed.id }, data: { status: 'REJECTED' } });

    const list = await commentService.listPendingComments();
    //other test files may have pending comments too, so only look at this file's ones
    const mine = list.filter((comment) => comment.productId === product.id);

    expect(mine.map((comment) => comment.id)).toEqual([older.id, newer.id]);
    expect(mine[0]).toMatchObject({
      productName: 'Review Test Record',
      author: { id: userId, name: 'Review Test' },
    });
  });

  //test 2: an approved comment is saved as approved and leaves the pending list
  it('approves a comment and removes it from the pending list', async () => {
    const comment = await pendingComment('Approve me', new Date());

    const result = await commentService.reviewComment(comment.id, 'APPROVED');

    expect(result.status).toBe('APPROVED');
    const list = await commentService.listPendingComments();
    expect(list.some((c) => c.id === comment.id)).toBe(false);
  });

  //test 3: two managers deciding at the same moment, only the first decision counts
  it('keeps only one decision when two managers review at the same moment', async () => {
    const comment = await pendingComment('Race', new Date());

    const results = await Promise.allSettled([
      commentService.reviewComment(comment.id, 'APPROVED'),
      commentService.reviewComment(comment.id, 'REJECTED'),
    ]);

    const outcomes = results.map((r) => (r.status === 'fulfilled' ? 'ok' : r.reason.status)).sort();
    expect(outcomes).toEqual([409, 'ok']);
    //the saved status is the decision of the request that succeeded
    const winner = results.find((r) => r.status === 'fulfilled').value.status;
    const saved = await prisma.comment.findUnique({ where: { id: comment.id } });
    expect(saved.status).toBe(winner);
  });

  //test 4: a rejected comment cannot be approved later
  it('does not change a comment that was already rejected', async () => {
    const comment = await pendingComment('Rejected', new Date());
    await commentService.reviewComment(comment.id, 'REJECTED');

    await expect(commentService.reviewComment(comment.id, 'APPROVED')).rejects.toMatchObject({
      status: 409,
    });
    const saved = await prisma.comment.findUnique({ where: { id: comment.id } });
    expect(saved.status).toBe('REJECTED');
  });

  //test 5: the product page only shows approved comments, newest first
  it('shows only approved comments of the record, newest first', async () => {
    //a fresh record, so the comments of the other tests do not count
    const category = await prisma.category.findFirst();
    const record = await prisma.product.create({
      data: {
        name: 'Approved Comments Record',
        model: 'Test',
        serialNumber: `APPROVED-TEST-${Date.now()}`,
        quantity: 1,
        price: '100.00',
        warrantyStatus: 'None',
        distributor: 'Test',
        description: 'Only used by comment review tests',
        categoryId: category.id,
      },
    });
    //deleted at the end even if a check fails, its comments go with it (onDelete: Cascade)
    try {
      const make = (content, status, createdAt) =>
        prisma.comment.create({
          data: { userId, productId: record.id, content, status, createdAt },
        });
      const older = await make('Older', 'APPROVED', new Date('2026-11-20T12:00:00Z'));
      const newer = await make('Newer', 'APPROVED', new Date('2026-11-22T12:00:00Z'));
      await make('Waiting', 'PENDING', new Date('2026-11-23T12:00:00Z'));
      await make('Rejected', 'REJECTED', new Date('2026-11-23T12:00:00Z'));

      const list = await commentService.listApprovedComments(record.id);

      expect(list.map((comment) => comment.id)).toEqual([newer.id, older.id]);
      expect(list[0].authorName).toBe('Review T.');
    } finally {
      await prisma.product.delete({ where: { id: record.id } });
    }
  });
});
