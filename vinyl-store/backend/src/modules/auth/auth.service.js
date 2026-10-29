const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');

//emails are not case sensitive, so "Person@x.com" and "person@x.com" must be the same account
//every email is saved and looked up in lowercase
function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

async function register({ name, lastname, email, password, taxId, homeAddress }) {
  
  email = normalizeEmail(email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, lastname, email, passwordHash, taxId, homeAddress },
    select: { id: true, email: true, role: true },
  });
  return user;
}

async function login({ email, password }) {
  
  email = normalizeEmail(email);
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

module.exports = { register, login };