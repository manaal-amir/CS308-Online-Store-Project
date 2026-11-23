//these tests send real http requests to the comment approval routes, but with a fake service
//they check that only product managers get in and that the comment id and status are checked

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

//replace the comment service with fake functions, so no database is needed
jest.mock('../src/modules/reviews/comment.service', () => ({
  listPendingComments: jest.fn(),
  reviewComment: jest.fn(),
}));
const commentService = require('../src/modules/reviews/comment.service');
const commentRoutes = require('../src/modules/reviews/comments.routes');
const errorHandler = require('../src/middlewares/errorHandler');

//the auth middleware checks tokens with this secret
process.env.JWT_SECRET = 'test-secret';

//a small app mounted on the same path as app.js, with the error handler
const app = express();
app.use(express.json());
app.use('/api/comments', commentRoutes);
app.use(errorHandler);

//makes a token like the login route does
function tokenFor(role) {
  return jwt.sign({ id: 3, role }, process.env.JWT_SECRET);
}
const manager = `Bearer ${tokenFor('PRODUCT_MANAGER')}`;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('GET /api/comments/pending', () => {
  //test 1: guests cannot see pending comments
  it('rejects a request without a token', async () => {
    const res = await request(app).get('/api/comments/pending');
    expect(res.status).toBe(401);
    expect(commentService.listPendingComments).not.toHaveBeenCalled();
  });

  //test 2: customers and other staff cannot see pending comments
  it.each(['CUSTOMER', 'SALES_MANAGER', 'SUPPORT_AGENT'])('rejects %s', async (role) => {
    const res = await request(app)
      .get('/api/comments/pending')
      .set('Authorization', `Bearer ${tokenFor(role)}`);
    expect(res.status).toBe(403);
    expect(commentService.listPendingComments).not.toHaveBeenCalled();
  });

  //test 3: a product manager gets the pending list
  it('returns the pending comments to a product manager', async () => {
    const pending = [{ id: 3, status: 'PENDING', content: 'Warm sound' }];
    commentService.listPendingComments.mockResolvedValue(pending);

    const res = await request(app).get('/api/comments/pending').set('Authorization', manager);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(pending);
  });
});

describe('PATCH /api/comments/:id', () => {
  //test 1: customers cannot approve comments
  it('rejects users who are not product managers', async () => {
    const res = await request(app)
      .patch('/api/comments/3')
      .set('Authorization', `Bearer ${tokenFor('CUSTOMER')}`)
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(403);
    expect(commentService.reviewComment).not.toHaveBeenCalled();
  });

  //test 2: approving returns the comment, the id is a number
  it.each(['APPROVED', 'REJECTED'])('lets a product manager set %s', async (status) => {
    commentService.reviewComment.mockResolvedValue({ id: 3, status });

    const res = await request(app)
      .patch('/api/comments/3')
      .set('Authorization', manager)
      .send({ status });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 3, status });
    expect(commentService.reviewComment).toHaveBeenCalledWith(3, status);
  });

  //test 3: a comment cannot be set back to pending or to an unknown status
  it.each(['PENDING', 'approved', undefined])('rejects status %p', async (status) => {
    const res = await request(app)
      .patch('/api/comments/3')
      .set('Authorization', manager)
      .send({ status });
    expect(res.status).toBe(400);
    expect(commentService.reviewComment).not.toHaveBeenCalled();
  });

  //test 4: the comment id must be a valid number
  it('rejects an invalid comment id', async () => {
    const res = await request(app)
      .patch('/api/comments/abc')
      .set('Authorization', manager)
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(400);
  });

  //test 5: errors from the service, like 409 for an already reviewed comment, reach the client
  it('passes service errors to the error handler', async () => {
    const err = new Error('This comment was already reviewed, it is APPROVED');
    err.status = 409;
    commentService.reviewComment.mockRejectedValue(err);

    const res = await request(app)
      .patch('/api/comments/3')
      .set('Authorization', manager)
      .send({ status: 'REJECTED' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(err.message);
  });
});
