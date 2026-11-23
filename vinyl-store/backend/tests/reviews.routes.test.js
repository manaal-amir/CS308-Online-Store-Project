//these tests send real http requests to the review routes, but with fake services
//they check that login, roles, the product id, the stars and the comment text are checked before the service

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

//replace the review services with fake functions, so no database is needed
jest.mock('../src/modules/reviews/comment.service', () => ({
  createComment: jest.fn(),
  listApprovedComments: jest.fn(),
}));
jest.mock('../src/modules/reviews/rating.service', () => ({
  rateProduct: jest.fn(),
  getMyReview: jest.fn(),
}));
const commentService = require('../src/modules/reviews/comment.service');
const ratingService = require('../src/modules/reviews/rating.service');
const productReviewRoutes = require('../src/modules/reviews/reviews.routes');
const errorHandler = require('../src/middlewares/errorHandler');

//the auth middleware checks tokens with this secret
process.env.JWT_SECRET = 'test-secret';

//a small app mounted on the same path as app.js, with the error handler
const app = express();
app.use(express.json());
app.use('/api/products/:id', productReviewRoutes);
app.use(errorHandler);

//makes a token like the login route does
function tokenFor(role) {
  return jwt.sign({ id: 7, role }, process.env.JWT_SECRET);
}
const customer = `Bearer ${tokenFor('CUSTOMER')}`;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('POST /api/products/:id/comments', () => {
  //test 1: guests cannot comment
  it('rejects a request without a token', async () => {
    const res = await request(app).post('/api/products/5/comments').send({ content: 'Nice' });
    expect(res.status).toBe(401);
    expect(commentService.createComment).not.toHaveBeenCalled();
  });

  //test 2: staff accounts cannot comment
  it('rejects users who are not customers', async () => {
    const res = await request(app)
      .post('/api/products/5/comments')
      .set('Authorization', `Bearer ${tokenFor('PRODUCT_MANAGER')}`)
      .send({ content: 'Nice' });
    expect(res.status).toBe(403);
    expect(commentService.createComment).not.toHaveBeenCalled();
  });

  //test 3: a valid comment returns 201, the id is a number and the text is trimmed
  it('saves the comment for a customer', async () => {
    const saved = { id: 1, productId: 5, content: 'Nice', status: 'PENDING' };
    commentService.createComment.mockResolvedValue(saved);

    const res = await request(app)
      .post('/api/products/5/comments')
      .set('Authorization', customer)
      .send({ content: '  Nice  ' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(saved);
    expect(commentService.createComment).toHaveBeenCalledWith(7, 5, 'Nice');
  });

  //test 4: an empty or blank comment is rejected
  it('rejects a blank comment', async () => {
    const res = await request(app)
      .post('/api/products/5/comments')
      .set('Authorization', customer)
      .send({ content: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('content is required');
    expect(commentService.createComment).not.toHaveBeenCalled();
  });

  //test 5: very long comments are rejected
  it('rejects a comment longer than 1000 characters', async () => {
    const res = await request(app)
      .post('/api/products/5/comments')
      .set('Authorization', customer)
      .send({ content: 'a'.repeat(1001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('content must be at most 1000 characters');
  });

  //test 6: the comment must be text
  it('rejects a comment that is not text', async () => {
    const res = await request(app)
      .post('/api/products/5/comments')
      .set('Authorization', customer)
      .send({ content: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('content must be a string');
  });

  //test 7: the product id must be a valid number
  it('rejects an invalid product id', async () => {
    const res = await request(app)
      .post('/api/products/abc/comments')
      .set('Authorization', customer)
      .send({ content: 'Nice' });
    expect(res.status).toBe(400);
    expect(commentService.createComment).not.toHaveBeenCalled();
  });

  //test 8: errors from the service, like 403 for an undelivered record, reach the client
  it('passes service errors to the error handler', async () => {
    const err = new Error('You can only comment on records that have been delivered to you');
    err.status = 403;
    commentService.createComment.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/products/5/comments')
      .set('Authorization', customer)
      .send({ content: 'Nice' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(err.message);
  });
});

describe('POST /api/products/:id/ratings', () => {
  //test 1: guests cannot rate
  it('rejects a request without a token', async () => {
    const res = await request(app).post('/api/products/5/ratings').send({ value: 4 });
    expect(res.status).toBe(401);
    expect(ratingService.rateProduct).not.toHaveBeenCalled();
  });

  //test 2: staff accounts cannot rate
  it('rejects users who are not customers', async () => {
    const res = await request(app)
      .post('/api/products/5/ratings')
      .set('Authorization', `Bearer ${tokenFor('SALES_MANAGER')}`)
      .send({ value: 4 });
    expect(res.status).toBe(403);
  });

  //test 3: a valid rating returns 200 with the new average, the ids and stars are numbers
  it('saves the rating for a customer', async () => {
    const saved = { productId: 5, value: 4, averageRating: 4.3, ratingCount: 2 };
    ratingService.rateProduct.mockResolvedValue(saved);

    const res = await request(app)
      .post('/api/products/5/ratings')
      .set('Authorization', customer)
      .send({ value: 4 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(saved);
    expect(ratingService.rateProduct).toHaveBeenCalledWith(7, 5, 4);
  });

  //test 4: stars outside 1 to 5, half stars and missing stars are rejected
  it.each([
    [0, 'value must be at least 1'],
    [6, 'value must be at most 5'],
    [4.5, 'value must be an integer'],
    [undefined, 'value is required'],
  ])('rejects value %p', async (value, message) => {
    const res = await request(app)
      .post('/api/products/5/ratings')
      .set('Authorization', customer)
      .send({ value });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
    expect(ratingService.rateProduct).not.toHaveBeenCalled();
  });

  //test 5: errors from the service, like 403 for an undelivered record, reach the client
  it('passes service errors to the error handler', async () => {
    const err = new Error('You can only rate records that have been delivered to you');
    err.status = 403;
    ratingService.rateProduct.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/products/5/ratings')
      .set('Authorization', customer)
      .send({ value: 4 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(err.message);
  });
});

describe('GET /api/products/:id/reviews/me', () => {
  //test 1: guests get 401, so the frontend simply hides the review controls
  it('rejects a request without a token', async () => {
    const res = await request(app).get('/api/products/5/reviews/me');
    expect(res.status).toBe(401);
  });

  //test 2: returns what the customer can do on the record
  it("returns the customer's review state", async () => {
    const state = { productId: 5, canReview: true, rating: 4, hasPendingComment: false };
    ratingService.getMyReview.mockResolvedValue(state);

    const res = await request(app).get('/api/products/5/reviews/me').set('Authorization', customer);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(state);
    expect(ratingService.getMyReview).toHaveBeenCalledWith(7, 5);
  });

  //test 3: the product id must be a valid number
  it('rejects an invalid product id', async () => {
    const res = await request(app).get('/api/products/0/reviews/me').set('Authorization', customer);
    expect(res.status).toBe(400);
    expect(ratingService.getMyReview).not.toHaveBeenCalled();
  });
});

describe('GET /api/products/:id/comments', () => {
  //test 1: anyone can read approved comments, no token needed
  it('returns approved comments without a token', async () => {
    const comments = [{ id: 4, content: 'Warm sound', authorName: 'Ada L.' }];
    commentService.listApprovedComments.mockResolvedValue(comments);

    const res = await request(app).get('/api/products/5/comments');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(comments);
    expect(commentService.listApprovedComments).toHaveBeenCalledWith(5);
  });

  //test 2: the product id must be a valid number
  it('rejects an invalid product id', async () => {
    const res = await request(app).get('/api/products/abc/comments');
    expect(res.status).toBe(400);
    expect(commentService.listApprovedComments).not.toHaveBeenCalled();
  });

  //test 3: a missing record gives 404
  it('passes a 404 from the service to the client', async () => {
    const err = new Error('Product not found');
    err.status = 404;
    commentService.listApprovedComments.mockRejectedValue(err);

    const res = await request(app).get('/api/products/999/comments');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Product not found');
  });
});
