const prisma = require('../../config/prisma');

async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      lastname: true,
      email: true,
      homeAddress: true,
      role: true,
    },
  });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return user;
}

module.exports = { getMe };
