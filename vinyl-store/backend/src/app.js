const express = require('express');
const authRoutes = require('./modules/auth/auth.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
app.use(express.json());
app.get('/', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use(errorHandler);

module.exports = app;