const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/modules/users/user.service', () => ({ getMe: jest.fn() }));
const userService = require('../src/modules/users/user.service');

function tokenFor(role = 'CUSTOMER', id = 1) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET);
}

beforeEach(() => jest.resetAllMocks());

describe('GET /api/users/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('returns the logged-in user with role', async () => {
    userService.getMe.mockResolvedValue({
      id: 1,
      name: 'Test',
      lastname: 'Customer',
      email: 'customer@vinylstore.test',
      homeAddress: 'Test St',
      role: 'CUSTOMER',
    });
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${tokenFor()}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('customer@vinylstore.test');
    expect(res.body.role).toBe('CUSTOMER');
    expect(userService.getMe).toHaveBeenCalledWith(1);
  });

  it('returns 404 if the user is missing', async () => {
    userService.getMe.mockRejectedValue(
      Object.assign(new Error('User not found'), { status: 404 })
    );
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${tokenFor()}`);
    expect(res.status).toBe(404);
  });
});
