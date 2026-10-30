//import the error handler we are testing
const errorHandler = require('../src/middlewares/errorHandler');

//creates a fake express response object so we can test without running a server
function mockRes() {
  //headersSent is false by default, like a fresh response
  const res = { headersSent: false };
  //jest.fn() records calls, mockReturnValue(res) allows chaining like res.status().json()
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

//creates an error with a given message and status
function makeError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

//groups all error handler tests together
describe('errorHandler', () => {
  //before each test, silence console.error so the test output stays clean
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  //after each test, restore console.error to normal
  afterEach(() => jest.restoreAllMocks());

  //test 1: a 404 error should return 404 with its real message
  it('uses err.status and message for client errors', () => {
    const res = mockRes();
    errorHandler(makeError('Product not found', 404), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Product not found' });
  });

  //test 2: an error with no status should become a 500 and hide its message
  it('defaults to 500 and hides details', () => {
    const res = mockRes();
    errorHandler(new Error('DB password wrong'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  //test 3: server errors should be logged for debugging
  it('logs server errors', () => {
    const res = mockRes();
    errorHandler(new Error('crash'), {}, res, jest.fn());
    expect(console.error).toHaveBeenCalled();
  });

  //test 4: client errors should not be logged, they are expected behaviour
  it('does not log client errors', () => {
    const res = mockRes();
    errorHandler(makeError('Invalid input', 400), {}, res, jest.fn());
    expect(console.error).not.toHaveBeenCalled();
  });

  //test 5: errors that use statusCode instead of status should still work
  it('reads err.statusCode when err.status is missing', () => {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    const res = mockRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  //test 6: a status that is not an error code should become 500
  it('treats invalid status codes as 500', () => {
    const res = mockRes();
    errorHandler(makeError('weird', 200), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  //test 7: a client error with an empty message gets a fallback message
  it('uses a fallback message when the message is empty', () => {
    const res = mockRes();
    errorHandler(makeError('', 400), {}, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({ error: 'Request failed' });
  });

  //test 8: if a response was already started, pass the error to express instead
  it('calls next(err) if headers were already sent', () => {
    const res = mockRes();
    res.headersSent = true;
    const next = jest.fn();
    const err = new Error('late error');
    errorHandler(err, {}, res, next);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });

  //test 9: a prisma duplicate error (P2002) becomes 409 and is not logged
  it('turns a prisma duplicate error into 409', () => {
    const err = Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), { code: 'P2002' });
    const res = mockRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'This record already exists' });
    expect(console.error).not.toHaveBeenCalled();
  });

  //test 10: a prisma record not found error (P2025) becomes 404
  it('turns a prisma not found error into 404', () => {
    const err = Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
    const res = mockRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Record not found' });
  });

  //test 11: other prisma errors are still hidden as 500
  it('keeps unknown prisma errors as 500', () => {
    const err = Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' });
    const res = mockRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  //test 12: broken json in the request body gives a clean message instead of the parser's text
  it('gives a clean message for invalid json', () => {
    const err = Object.assign(new SyntaxError('Expected double-quoted property name in JSON at position 20'), {
      type: 'entity.parse.failed',
      status: 400,
    });
    const res = mockRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid JSON body' });
  });
});
