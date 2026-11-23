//tests for saving a comment with a fake database, so no docker is needed
//the real database test (comment.db.test.js) checks the delivered order rule and double clicks for real

//replace prisma with fake functions
jest.mock('../src/config/prisma', () => ({
  $transaction: jest.fn(),
  comment: { findMany: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
}));

const prisma = require('../src/config/prisma');
const {
  createComment,
  listPendingComments,
  reviewComment,
} = require('../src/modules/reviews/comment.service');

const createdAt = new Date('2026-11-23T10:00:00Z');

//a fake transaction object, every test changes the parts it needs
let tx;

beforeEach(() => {
  jest.resetAllMocks();
  //by default the customer has a delivered order with the record and no pending comment on it
  tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 7 }]),
    product: { findUnique: jest.fn().mockResolvedValue({ id: 5 }) },
    order: { findFirst: jest.fn().mockResolvedValue({ id: 42 }) },
    comment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ id: 1, createdAt, ...data })),
    },
  };
  //run the transaction callback with the fake tx, like prisma does
  prisma.$transaction.mockImplementation((callback) => callback(tx));
});

describe('create comment service', () => {
  //test 1: a delivered customer's comment is saved as pending and returned
  it('saves the comment as pending', async () => {
    const result = await createComment(7, 5, 'Great pressing');
    expect(result).toEqual({
      id: 1,
      productId: 5,
      content: 'Great pressing',
      status: 'PENDING',
      createdAt,
    });
    expect(tx.comment.create).toHaveBeenCalledWith({
      data: { userId: 7, productId: 5, content: 'Great pressing', status: 'PENDING' },
    });
  });

  //test 2: only a delivered order of this customer with this record counts
  it('looks for a delivered order of this customer containing the record', async () => {
    await createComment(7, 5, 'Great pressing');
    expect(tx.order.findFirst).toHaveBeenCalledWith({
      where: { userId: 7, status: 'DELIVERED', items: { some: { productId: 5 } } },
      select: { id: true },
    });
  });

  //test 3: the customer's row is locked first, so two requests at once cannot both save
  it("locks the customer's row before checking", async () => {
    await createComment(7, 5, 'Great pressing');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.order.findFirst.mock.invocationCallOrder[0]
    );
  });

  //test 4: a customer who received the record needs no extra product lookup
  it('does not look up the product when the record was delivered', async () => {
    await createComment(7, 5, 'Great pressing');
    expect(tx.product.findUnique).not.toHaveBeenCalled();
  });

  //test 5: a customer without a delivered order gets 403 and nothing is saved
  it('rejects a customer whose order was not delivered', async () => {
    tx.order.findFirst.mockResolvedValue(null);
    await expect(createComment(7, 5, 'Great pressing')).rejects.toMatchObject({
      status: 403,
      message: 'You can only comment on records that have been delivered to you',
    });
    expect(tx.comment.create).not.toHaveBeenCalled();
  });

  //test 6: a record that does not exist gets 404
  it('returns 404 for a record that does not exist', async () => {
    tx.order.findFirst.mockResolvedValue(null);
    tx.product.findUnique.mockResolvedValue(null);
    await expect(createComment(7, 999, 'Great pressing')).rejects.toMatchObject({
      status: 404,
      message: 'Product not found',
    });
    expect(tx.comment.create).not.toHaveBeenCalled();
  });

  //test 7: a second comment while the first is still pending is rejected
  it('rejects a new comment while one is still pending on the record', async () => {
    tx.comment.findFirst.mockResolvedValue({ id: 3 });
    await expect(createComment(7, 5, 'Another one')).rejects.toMatchObject({
      status: 409,
      message: 'You already have a comment waiting for approval on this record',
    });
    expect(tx.comment.findFirst).toHaveBeenCalledWith({
      where: { userId: 7, productId: 5, status: 'PENDING' },
      select: { id: true },
    });
    expect(tx.comment.create).not.toHaveBeenCalled();
  });
});

describe('pending comments service', () => {
  //test 1: pending comments come oldest first, with the record name and the author
  it('lists pending comments oldest first with the record and author', async () => {
    prisma.comment.findMany.mockResolvedValue([
      {
        id: 3,
        productId: 5,
        content: 'Warm sound',
        status: 'PENDING',
        createdAt,
        product: { id: 5, name: 'Blue Train' },
        user: { id: 7, name: 'Ada', lastname: 'Lovelace' },
      },
    ]);

    const result = await listPendingComments();

    expect(result).toEqual([
      {
        id: 3,
        productId: 5,
        content: 'Warm sound',
        status: 'PENDING',
        createdAt,
        productName: 'Blue Train',
        author: { id: 7, name: 'Ada Lovelace' },
      },
    ]);
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    );
  });

  //test 2: no pending comments gives an empty list
  it('returns an empty list when nothing is pending', async () => {
    prisma.comment.findMany.mockResolvedValue([]);
    expect(await listPendingComments()).toEqual([]);
  });
});

describe('review comment service', () => {
  //test 1: a pending comment is approved and returned with its new status
  it('approves a pending comment', async () => {
    prisma.comment.updateMany.mockResolvedValue({ count: 1 });
    prisma.comment.findUnique.mockResolvedValue({
      id: 3,
      productId: 5,
      content: 'Warm sound',
      status: 'APPROVED',
      createdAt,
    });

    const result = await reviewComment(3, 'APPROVED');

    expect(result).toEqual({
      id: 3,
      productId: 5,
      content: 'Warm sound',
      status: 'APPROVED',
      createdAt,
    });
  });

  //test 2: the status only changes while the comment is pending, in one step
  it('changes the status only while the comment is pending', async () => {
    prisma.comment.updateMany.mockResolvedValue({ count: 1 });
    prisma.comment.findUnique.mockResolvedValue({ id: 3, status: 'REJECTED' });

    await reviewComment(3, 'REJECTED');

    expect(prisma.comment.updateMany).toHaveBeenCalledWith({
      where: { id: 3, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });
  });

  //test 3: a comment that was already reviewed gets 409 with its current status
  it('rejects a comment that was already reviewed', async () => {
    prisma.comment.updateMany.mockResolvedValue({ count: 0 });
    prisma.comment.findUnique.mockResolvedValue({ id: 3, status: 'APPROVED' });

    await expect(reviewComment(3, 'REJECTED')).rejects.toMatchObject({
      status: 409,
      message: 'This comment was already reviewed, it is APPROVED',
    });
  });

  //test 4: a comment that does not exist gets 404
  it('returns 404 for a comment that does not exist', async () => {
    prisma.comment.updateMany.mockResolvedValue({ count: 0 });
    prisma.comment.findUnique.mockResolvedValue(null);

    await expect(reviewComment(999, 'APPROVED')).rejects.toMatchObject({
      status: 404,
      message: 'Comment not found',
    });
  });
});
