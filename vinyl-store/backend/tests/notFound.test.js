//import the middleware we are testing
const notFound = require('../src/middlewares/notFound');

describe('notFound middleware', () => {
  //test 1: unknown routes produce a 404 error that names the route
  it('passes a 404 error with the method and url to next', () => {
    const next = jest.fn();
    notFound({ method: 'GET', originalUrl: '/api/blah' }, {}, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(404);
    expect(err.message).toBe('Route not found: GET /api/blah');
  });
});