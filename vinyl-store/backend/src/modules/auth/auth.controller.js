const authService = require('./auth.service');

//the request body is already checked by the validate middleware in auth.routes.js

async function register(req, res, next) {
  try {
    const { name, lastname, email, password, taxId, homeAddress } = req.body;
    const user = await authService.register({
      name, lastname, email, password, taxId, homeAddress,
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  // JWT is stateless — logout is client-side token deletion.
  // This endpoint exists so the frontend has something to call.
  res.status(200).json({ message: 'Logged out' });
}

module.exports = { register, login, logout };