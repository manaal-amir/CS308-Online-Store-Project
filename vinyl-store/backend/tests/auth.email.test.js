//checks that emails are saved and looked up in lowercase (SCRUM-98)
//prisma is replaced with fake functions, so no database is needed

jest.mock('../src/config/prisma', () => ({
  user: { findUnique: jest.fn(), create: jest.fn() },
}));

const bcrypt = require('bcrypt');
const prisma = require('../src/config/prisma');
const authService = require('../src/modules/auth/auth.service');

process.env.JWT_SECRET = 'test-secret';

beforeEach(() => {
  jest.resetAllMocks();
});

describe('email normalization', () => {
  //test 1: a new account is saved with a lowercase email
  it('saves the email in lowercase when registering', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }) => ({ id: 1, email: data.email, role: 'CUSTOMER' }));

    await authService.register({
      name: 'A', lastname: 'B', email: 'Ayesha@Example.COM', password: 'Vinyl1234!', taxId: '1', homeAddress: 'x',
    });

    expect(prisma.user.create.mock.calls[0][0].data.email).toBe('ayesha@example.com');
  });

  //test 2: the duplicate check uses the lowercase email, so a second account with other capitals is blocked
  it('blocks a duplicate account that only differs in capitals', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'ayesha@example.com' });

    await expect(
      authService.register({
        name: 'A', lastname: 'B', email: 'AYESHA@example.com', password: 'Vinyl1234!', taxId: '1', homeAddress: 'x',
      })
    ).rejects.toMatchObject({ status: 409 });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'ayesha@example.com' } });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  //test 3: logging in with different capitals finds the same account
  it('logs in with an email typed in different capitals', async () => {
    const passwordHash = await bcrypt.hash('Vinyl1234!', 4);
    prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'ayesha@example.com', role: 'CUSTOMER', passwordHash });

    const result = await authService.login({ email: 'Ayesha@Example.com', password: 'Vinyl1234!' });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'ayesha@example.com' } });
    expect(result.token).toBeDefined();
  });
});