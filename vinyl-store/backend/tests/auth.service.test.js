const authService = require('../src/modules/auth/auth.service');
const prisma = require('../src/config/prisma');

describe('auth service', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('logs in a seeded customer', async () => {
    const result = await authService.login({
      email: 'customer@vinylstore.test',
      password: 'Test1234!',
    });
    expect(result.token).toBeDefined();
    expect(result.user.role).toBe('CUSTOMER');
  });

  it('rejects wrong password with generic error', async () => {
    await expect(
      authService.login({ email: 'customer@vinylstore.test', password: 'wrong' })
    ).rejects.toThrow('Invalid credentials');
  });

  it('rejects unknown email', async () => {
    await expect(
      authService.login({ email: 'nobody@x.com', password: 'x' })
    ).rejects.toThrow('Invalid credentials');
  });

  it('registers a new user', async () => {
    const email = `test-${Date.now()}@x.com`;
    const user = await authService.register({
      name: 'Test', lastname: 'User', email,
      password: 'Pass1234!',
      taxId: '12345678901', homeAddress: 'Test St',
    });
    expect(user.email).toBe(email);
    expect(user.role).toBe('CUSTOMER');
    await prisma.user.delete({ where: { email } }); // cleanup
  });

  it('rejects duplicate email', async () => {
    await expect(
      authService.register({
        name: 'X', lastname: 'Y',
        email: 'customer@vinylstore.test',
        password: 'Pass1234!',
      })
    ).rejects.toThrow('Email already registered');
  });
});