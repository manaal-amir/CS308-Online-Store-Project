const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');

async function register({ name, email, password, address }) {
  // TODO: uncomment once Prisma schema is migrated
  // const existing = await prisma.user.findUnique({ where: { email } });
  // if (existing) throw { status: 409, message: 'Email already registered' };
  // const passwordHash = await bcrypt.hash(password, 10);
  // return prisma.user.create({ data: { name, email, passwordHash, address } });
  throw new Error('Not implemented — waiting on schema');
}

async function login({ email, password }) {
  // TODO: uncomment once Prisma schema is migrated
  // const user = await prisma.user.findUnique({ where: { email } });
  // if (!user) throw { status: 401, message: 'Invalid credentials' };
  // const ok = await bcrypt.compare(password, user.passwordHash);
  // if (!ok) throw { status: 401, message: 'Invalid credentials' };
  // const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
  // return { token, user: { id: user.id, email: user.email, role: user.role } };
  throw new Error('Not implemented — waiting on schema');
}

module.exports = { register, login };