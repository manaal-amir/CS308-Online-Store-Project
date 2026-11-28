//these tests send real http requests to the genre routes, but with a fake service
//they check that only product managers get in and that the name, description and id are checked

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

//replace the genre service with fake functions, so no database is needed
jest.mock('../src/modules/genres/genre.service', () => ({
  createGenre: jest.fn(),
  deleteGenre: jest.fn(),
}));
const genreService = require('../src/modules/genres/genre.service');
const genreRoutes = require('../src/modules/genres/genre.routes');
const errorHandler = require('../src/middlewares/errorHandler');

//the auth middleware checks tokens with this secret
process.env.JWT_SECRET = 'test-secret';

//a small app mounted on the same path as app.js, with the error handler
const app = express();
app.use(express.json());
app.use('/api/genres', genreRoutes);
app.use(errorHandler);

//makes a token like the login route does
function tokenFor(role) {
  return jwt.sign({ id: 3, role }, process.env.JWT_SECRET);
}
const manager = `Bearer ${tokenFor('PRODUCT_MANAGER')}`;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('POST /api/genres', () => {
  //test 1: a product manager adds a genre, the trimmed values reach the service
  it('creates a genre for a product manager', async () => {
    const genre = { id: 7, name: 'Blues', description: 'Twelve bars' };
    genreService.createGenre.mockResolvedValue(genre);

    const res = await request(app)
      .post('/api/genres')
      .set('Authorization', manager)
      .send({ name: '  Blues ', description: ' Twelve bars ' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(genre);
    expect(genreService.createGenre).toHaveBeenCalledWith({
      name: 'Blues',
      description: 'Twelve bars',
    });
  });

  //test 2: guests cannot add genres
  it('rejects a request without a token', async () => {
    const res = await request(app).post('/api/genres').send({ name: 'Blues' });
    expect(res.status).toBe(401);
    expect(genreService.createGenre).not.toHaveBeenCalled();
  });

  //test 3: customers and other staff cannot add genres
  it.each(['CUSTOMER', 'SALES_MANAGER', 'SUPPORT_AGENT'])('rejects %s', async (role) => {
    const res = await request(app)
      .post('/api/genres')
      .set('Authorization', `Bearer ${tokenFor(role)}`)
      .send({ name: 'Blues' });
    expect(res.status).toBe(403);
    expect(genreService.createGenre).not.toHaveBeenCalled();
  });

  //test 4: a bad name or description is rejected before the service runs
  it.each([
    ['a missing name', {}],
    ['a name of only spaces', { name: '   ' }],
    ['a name that is not text', { name: 123 }],
    ['a name longer than 50 characters', { name: 'a'.repeat(51) }],
    ['a description longer than 1000 characters', { name: 'Blues', description: 'a'.repeat(1001) }],
  ])('rejects %s', async (label, body) => {
    const res = await request(app).post('/api/genres').set('Authorization', manager).send(body);
    expect(res.status).toBe(400);
    expect(genreService.createGenre).not.toHaveBeenCalled();
  });

  //test 5: a duplicate name comes back as 409 with the service's message
  it('returns 409 for a name that already exists', async () => {
    const err = new Error('A genre with this name already exists');
    err.status = 409;
    genreService.createGenre.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/genres')
      .set('Authorization', manager)
      .send({ name: 'blues' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'A genre with this name already exists' });
  });
});

describe('DELETE /api/genres/:id', () => {
  //test 1: a product manager removes a genre
  it('removes a genre for a product manager', async () => {
    genreService.deleteGenre.mockResolvedValue({ id: 7, removed: true });

    const res = await request(app).delete('/api/genres/7').set('Authorization', manager);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 7, removed: true });
    expect(genreService.deleteGenre).toHaveBeenCalledWith(7);
  });

  //test 2: guests cannot remove genres
  it('rejects a request without a token', async () => {
    const res = await request(app).delete('/api/genres/7');
    expect(res.status).toBe(401);
    expect(genreService.deleteGenre).not.toHaveBeenCalled();
  });

  //test 3: customers and other staff cannot remove genres
  it.each(['CUSTOMER', 'SALES_MANAGER', 'SUPPORT_AGENT'])('rejects %s', async (role) => {
    const res = await request(app)
      .delete('/api/genres/7')
      .set('Authorization', `Bearer ${tokenFor(role)}`);
    expect(res.status).toBe(403);
    expect(genreService.deleteGenre).not.toHaveBeenCalled();
  });

  //test 4: the id must be a whole number that fits in the database
  it.each(['abc', '0', '-1', '1.5', '2147483648'])('rejects id %s', async (id) => {
    const res = await request(app).delete(`/api/genres/${id}`).set('Authorization', manager);
    expect(res.status).toBe(400);
    expect(genreService.deleteGenre).not.toHaveBeenCalled();
  });

  //test 5: a missing genre comes back as 404
  it('returns 404 when the genre does not exist', async () => {
    const err = new Error('Genre not found');
    err.status = 404;
    genreService.deleteGenre.mockRejectedValue(err);

    const res = await request(app).delete('/api/genres/7').set('Authorization', manager);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Genre not found' });
  });
});
