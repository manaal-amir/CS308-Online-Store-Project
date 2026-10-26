const authService = require('./auth.service');

async function register(req, res, next) {
  try {
    const { name, lastname, email, password, taxId, homeAddress } = req.body;
    if (!name || !lastname || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!taxId || !homeAddress) {
      return res.status(400).json({ error: 'taxId and homeAddress are required' });
    }
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
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
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