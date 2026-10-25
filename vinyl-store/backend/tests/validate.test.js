//import the middleware we are testing
const validate = require('../src/middlewares/validate');

//runs a validator on a fake request and returns what was passed to next()
function run(schema, req) {
  const next = jest.fn();
  validate(schema)(req, {}, next);
  //next() with no argument means valid, next(err) means invalid
  return next.mock.calls[0][0];
}

//schema similar to what the cart add route will use
const cartSchema = {
  body: {
    productId: { required: true, type: 'integer', min: 1 },
    quantity: { required: true, type: 'integer', min: 1 },
  },
};

describe('validate middleware', () => {
  //test 1: valid input should go straight to the controller
  it('calls next() with no error for valid input', () => {
    const err = run(cartSchema, { body: { productId: 3, quantity: 2 } });
    expect(err).toBeUndefined();
  });

  //test 2: a missing required field gives a 400
  it('rejects a missing required field', () => {
    const err = run(cartSchema, { body: { quantity: 2 } });
    expect(err.status).toBe(400);
    expect(err.message).toBe('productId is required');
  });

  //test 3: all problems are listed together, not just the first one
  it('lists every invalid field in one message', () => {
    const err = run(cartSchema, { body: {} });
    expect(err.message).toBe('productId is required, quantity is required');
  });

  //test 4: a missing body is treated as empty instead of crashing
  it('handles a request with no body', () => {
    const err = run(cartSchema, {});
    expect(err.status).toBe(400);
  });

  //test 5: decimals are not accepted where an integer is expected
  it('rejects a decimal where an integer is required', () => {
    const err = run(cartSchema, { body: { productId: 3, quantity: 1.5 } });
    expect(err.message).toBe('quantity must be an integer');
  });

  //test 6: numbers below the minimum are rejected
  it('rejects a value below min', () => {
    const err = run(cartSchema, { body: { productId: 3, quantity: 0 } });
    expect(err.message).toBe('quantity must be at least 1');
  });

  //test 7: numbers above the maximum are rejected
  it('rejects a value above max', () => {
    const schema = { body: { rating: { type: 'integer', min: 1, max: 5 } } };
    const err = run(schema, { body: { rating: 6 } });
    expect(err.message).toBe('rating must be at most 5');
  });

  //test 8: url params arrive as text and are converted to numbers
  it('converts numeric params to numbers', () => {
    const req = { params: { id: '42' } };
    const err = run({ params: { id: { required: true, type: 'integer' } } }, req);
    expect(err).toBeUndefined();
    expect(req.params.id).toBe(42);
  });

  //test 9: text that is not a number is rejected
  it('rejects non numeric params', () => {
    const err = run({ params: { id: { required: true, type: 'integer' } } }, { params: { id: 'abc' } });
    expect(err.message).toBe('id must be an integer');
  });

  //test 10: emails must have a valid format
  it('rejects an invalid email', () => {
    const err = run({ body: { email: { required: true, type: 'email' } } }, { body: { email: 'not-an-email' } });
    expect(err.message).toBe('email must be a valid email');
  });

  //test 11: strings shorter than minLength are rejected
  it('rejects a string shorter than minLength', () => {
    const schema = { body: { password: { required: true, type: 'string', minLength: 8 } } };
    const err = run(schema, { body: { password: 'abc' } });
    expect(err.message).toBe('password must be at least 8 characters');
  });

  //test 12: optional fields can be left out
  it('allows optional fields to be missing', () => {
    const schema = { query: { sort: { type: 'string' } } };
    const err = run(schema, { query: {} });
    expect(err).toBeUndefined();
  });

  //test 13: text with only spaces counts as missing
  it('treats whitespace only text as missing', () => {
    const schema = { body: { name: { required: true, type: 'string' } } };
    const err = run(schema, { body: { name: '   ' } });
    expect(err.message).toBe('name is required');
  });

  //test 14: text is trimmed before it reaches the controller
  it('trims text values', () => {
    const req = { body: { email: '  a@b.com ' } };
    const err = run({ body: { email: { required: true, type: 'email' } } }, req);
    expect(err).toBeUndefined();
    expect(req.body.email).toBe('a@b.com');
  });

  //test 15: trim can be turned off, e.g. for passwords
  it('does not trim when trim is false', () => {
    const req = { body: { password: ' secret12 ' } };
    run({ body: { password: { type: 'string', trim: false } } }, req);
    expect(req.body.password).toBe(' secret12 ');
  });

  //test 16: values outside an allowed list are rejected
  it('rejects a value not in enum', () => {
    const schema = { query: { sort: { type: 'string', enum: ['price', 'popularity'] } } };
    const err = run(schema, { query: { sort: 'name' } });
    expect(err.message).toBe('sort must be one of: price, popularity');
  });

  //test 17: values must match a custom pattern
  it('rejects a value that does not match pattern', () => {
    const schema = {
      body: { taxId: { required: true, type: 'string', pattern: /^\d{10,11}$/, patternMessage: 'taxId must be 10 or 11 digits' } },
    };
    const err = run(schema, { body: { taxId: '12ab' } });
    expect(err.message).toBe('taxId must be 10 or 11 digits');
  });

  //test 18: hex or scientific notation is not accepted as a number
  it('rejects unusual number formats like hex', () => {
    const err = run({ params: { id: { required: true, type: 'integer' } } }, { params: { id: '0x10' } });
    expect(err.message).toBe('id must be an integer');
  });

  //test 19: "true" and "false" in the query become real booleans
  it('converts boolean text in the query', () => {
    const req = { query: { inStock: 'true' } };
    const err = run({ query: { inStock: { type: 'boolean' } } }, req);
    expect(err).toBeUndefined();
    expect(req.query.inStock).toBe(true);
  });
});