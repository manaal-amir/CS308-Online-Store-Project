//these tests send real http requests to the review routes, but with fake services
//they check that login, roles, the product id and the comment text are checked before the service

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

//replace the comment service with fake functions, so no database is needed
jest.mock('../src/modules/reviews/comment.service', () => ({ createComment: jest.fn() }));
const commentService = require('../src/modules/reviews/comment.service');
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
