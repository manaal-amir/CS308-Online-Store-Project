//these tests send real http requests to the auth routes, but with a fake service
//they check that bad input is stopped with a 400 before it reaches the service (SCRUM-96, SCRUM-97)
const express = require('express');
const request = require('supertest');

//replace the service with fake functions, so no database is needed
jest.mock('../src/modules/auth/auth.service', () => ({
  register: jest.fn(),
  login: jest.fn(),
}));
const authService = require('../src/modules/auth/auth.service');
const authRoutes = require('../src/modules/auth/auth.routes');
const errorHandler = require('../src/middlewares/errorHandler');

//a small app with only the auth routes and the error handler
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

//a valid registration, each test changes one field
const validUser = {
  name: 'Ayesha',
  lastname: 'Musharaf',
  email: 'ayesha@example.com',
  password: 'Vinyl1234!',
  taxId: '12345678901',
  homeAddress: 'Orta Mahalle, Tuzla, Istanbul',
};

//sends a registration with some fields replaced
function register(changes) {
  return request(app).post('/api/auth/register').send({ ...validUser, ...changes });
}

beforeEach(() => {
  jest.resetAllMocks();
  authService.register.mockResolvedValue({ id: 1, email: validUser.email, role: 'CUSTOMER' });
  authService.login.mockResolvedValue({ token: 'abc', user: { id: 1 } });
});

describe('POST /api/auth/register', () => {
  //test 1: a valid registration reaches the service and returns 201
  it('accepts a valid registration', async () => {
    const res = await register({});
    expect(res.status).toBe(201);
    expect(authService.register).toHaveBeenCalledWith(validUser);
  });

  //test 2: an invalid email format is rejected (SCRUM-96)
  it('rejects an invalid email', async () => {
    const res = await register({ email: 'notanemail' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'email must be a valid email' });
    expect(authService.register).not.toHaveBeenCalled();
  });

  //test 3: a password shorter than 8 characters is rejected (SCRUM-96)
  it('rejects a short password', async () => {
    const res = await register({ password: 'a' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'password must be at least 8 characters' });
  });

  //test 4: a password longer than bcrypt can use is rejected
  it('rejects a password longer than 72 characters', async () => {
    const res = await register({ password: 'a'.repeat(73) });
    expect(res.status).toBe(400);
  });

  //test 5: a number as the password gives 400, not a 500 crash (SCRUM-97)
  it('rejects a number as the password', async () => {
    const res = await register({ password: 12345678 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'password must be a string' });
    expect(authService.register).not.toHaveBeenCalled();
  });

  //test 6: fields made of only spaces count as missing (SCRUM-96)
  it('rejects tax id and address made of only spaces', async () => {
    const res = await register({ taxId: '   ', homeAddress: '  ' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'taxId is required, homeAddress is required' });
  });

  //test 7: every missing field is listed in one message
  it('lists all missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      'name is required, lastname is required, email is required, password is required, taxId is required, homeAddress is required'
    );
  });

  //test 8: text is trimmed, but spaces inside the password are kept
  it('trims text fields but not the password', async () => {
    await register({ name: '  Ayesha ', password: ' Vinyl1234! ' });
    expect(authService.register).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ayesha', password: ' Vinyl1234! ' })
    );
  });
});

describe('POST /api/auth/login', () => {
  //test 9: a valid login reaches the service
  it('accepts a valid login', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'whatever1' });
    expect(res.status).toBe(200);
    expect(authService.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'whatever1' });
  });

  //test 10: a number as the password gives 400, not a 500 crash (SCRUM-97)
  it('rejects a number as the password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 123 });
    expect(res.status).toBe(400);
    expect(authService.login).not.toHaveBeenCalled();
  });

  //test 11: an object instead of an email is rejected before reaching the database
  it('rejects an email that is not text', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { contains: '@' }, password: 'x' });
    expect(res.status).toBe(400);
    expect(authService.login).not.toHaveBeenCalled();
  });
});

describe('password size and invalid json', () => {
  //test 12: a password under 72 characters but over 72 bytes is rejected, bcrypt would cut it off
  it('rejects a password longer than 72 bytes', async () => {
    const res = await register({ password: 'ğ'.repeat(40) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'password is too long' });
    expect(authService.register).not.toHaveBeenCalled();
  });

  //test 13: invalid json gets a clean 400 through the error handler
  it('rejects invalid json with a clean message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.com",}');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON body' });
  });
});