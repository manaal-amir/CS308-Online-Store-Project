jest.mock('../src/config/prisma', () => ({ user: { findUnique: jest.fn() } }));
const prisma = require('../src/config/prisma');
const { getMe } = require('../src/modules/users/user.service');

beforeEach(() => jest.resetAllMocks());

describe('user service getMe', () => {
  it('returns the selected fields (no passwordHash)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      name: 'Test',
      lastname: 'C',
      email: 't@x.com',
      homeAddress: 'St',
      role: 'CUSTOMER',
    });
    const user = await getMe(1);
    expect(user.email).toBe('t@x.com');
    expect(user).not.toHaveProperty('passwordHash');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: {
        id: true,
        name: true,
        lastname: true,
        email: true,
        homeAddress: true,
        role: true,
      },
    });
  });

  it('throws 404 if not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(getMe(999)).rejects.toMatchObject({ status: 404 });
  });
});
