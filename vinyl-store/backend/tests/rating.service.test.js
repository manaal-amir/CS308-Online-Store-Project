//tests for rating a record with a fake database, so no docker is needed
//the real database test (rating.db.test.js) checks the upsert and the average for real

//replace prisma with fake functions
jest.mock('../src/config/prisma', () => ({
  product: { findUnique: jest.fn() },
  order: { findFirst: jest.fn() },
  rating: { upsert: jest.fn(), aggregate: jest.fn(), findUnique: jest.fn() },
  comment: { findFirst: jest.fn() },
}));

const prisma = require('../src/config/prisma');
const { rateProduct, getMyReview } = require('../src/modules/reviews/rating.service');

//makes an error like prisma's unique rule error
function uniqueError() {
  const err = new Error('Unique constraint failed');
  err.code = 'P2002';
  return err;
}

beforeEach(() => {
  jest.resetAllMocks();
  //by default the record exists, the customer received it, and two ratings average 4.25
  prisma.product.findUnique.mockResolvedValue({ id: 5 });
  prisma.order.findFirst.mockResolvedValue({ id: 42 });
  prisma.rating.upsert.mockResolvedValue({ id: 1 });
  prisma.rating.aggregate.mockResolvedValue({ _avg: { value: 4.25 }, _count: { _all: 2 } });
});

describe('rate product service', () => {
  //test 1: the rating is saved and the new average is returned, rounded to 1 decimal
  it('saves the rating and returns the new average', async () => {
    const result = await rateProduct(7, 5, 4);
    expect(result).toEqual({ productId: 5, value: 4, averageRating: 4.3, ratingCount: 2 });
  });

  //test 2: rating again changes the same row instead of adding a second one
  it('creates the rating or updates the existing one in one step', async () => {
    await rateProduct(7, 5, 4);
    expect(prisma.rating.upsert).toHaveBeenCalledWith({
      where: { userId_productId: { userId: 7, productId: 5 } },
      create: { userId: 7, productId: 5, value: 4 },
      update: { value: 4 },
    });
  });

  //test 3: only a delivered order of this customer with this record counts
  it('looks for a delivered order of this customer containing the record', async () => {
    await rateProduct(7, 5, 4);
    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 7,
        status: 'DELIVERED',
        items: { some: { productId: 5, product: { isHidden: false } } },
      },
      select: { id: true },
    });
    //a customer who received the record needs no extra product lookup
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });

  //test 4: a customer without a delivered order gets 403 and nothing is saved
  it('rejects a customer whose order was not delivered', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(rateProduct(7, 5, 4)).rejects.toMatchObject({
      status: 403,
      message: 'You can only rate records that have been delivered to you',
    });
    expect(prisma.rating.upsert).not.toHaveBeenCalled();
  });

  //test 5: a record that does not exist gets 404
  it('returns 404 for a record that does not exist', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(rateProduct(7, 999, 4)).rejects.toMatchObject({ status: 404 });
    expect(prisma.rating.upsert).not.toHaveBeenCalled();
  });

  //test 6: two first ratings at the same moment, the loser tries again and updates
  it('retries once when a double click hits the unique rule', async () => {
    prisma.rating.upsert.mockRejectedValueOnce(uniqueError()).mockResolvedValueOnce({ id: 1 });
    const result = await rateProduct(7, 5, 4);
    expect(prisma.rating.upsert).toHaveBeenCalledTimes(2);
    expect(result.value).toBe(4);
  });

  //test 7: other database errors are not hidden by the retry
  it('does not retry other errors', async () => {
    prisma.rating.upsert.mockRejectedValue(new Error('db down'));
    await expect(rateProduct(7, 5, 4)).rejects.toThrow('db down');
    expect(prisma.rating.upsert).toHaveBeenCalledTimes(1);
  });

  //test 8: the average is null when there are no ratings, so the page can show "no ratings yet"
  it('returns a null average when there are no ratings', async () => {
    prisma.rating.aggregate.mockResolvedValue({ _avg: { value: null }, _count: { _all: 0 } });
    const result = await rateProduct(7, 5, 4);
    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBe(0);
  });
});

describe('my review service', () => {
  //test 9: a customer who received the record and rated it 5, with a comment waiting
  it('returns what the customer can do on the record', async () => {
    prisma.rating.findUnique.mockResolvedValue({ value: 5 });
    prisma.comment.findFirst.mockResolvedValue({ id: 3 });

    const result = await getMyReview(7, 5);

    expect(result).toEqual({ productId: 5, canReview: true, rating: 5, hasPendingComment: true });
    expect(prisma.comment.findFirst).toHaveBeenCalledWith({
      where: { userId: 7, productId: 5, status: 'PENDING' },
      select: { id: true },
    });
  });

  //test 10: a customer who never received the record cannot review it
  it('says the customer cannot review a record that was not delivered', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.rating.findUnique.mockResolvedValue(null);
    prisma.comment.findFirst.mockResolvedValue(null);

    const result = await getMyReview(7, 5);

    expect(result).toEqual({
      productId: 5,
      canReview: false,
      rating: null,
      hasPendingComment: false,
    });
  });

  //test 11: a record that does not exist gets 404
  it('returns 404 for a record that does not exist', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(getMyReview(7, 999)).rejects.toMatchObject({ status: 404 });
  });
});

//SCRUM-158 (requirement 12): a record removed by a product manager cannot get new ratings
describe('rating a hidden record', () => {
  //a delivered order of a hidden record does not count, and the record itself is not found
  beforeEach(() => {
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.product.findUnique.mockResolvedValue(null);
  });

  //test 1: rating a hidden record gets 404, nothing is saved
  it('returns 404 and saves nothing', async () => {
    await expect(rateProduct(7, 5, 4)).rejects.toMatchObject({
      status: 404,
      message: 'Product not found',
    });
    expect(prisma.product.findUnique).toHaveBeenCalledWith({
      where: { id: 5, isHidden: false },
      select: { id: true },
    });
    expect(prisma.rating.upsert).not.toHaveBeenCalled();
  });

  //test 2: the product page check gets 404 as well
  it('returns 404 for my review', async () => {
    await expect(getMyReview(7, 5)).rejects.toMatchObject({ status: 404 });
  });
});
