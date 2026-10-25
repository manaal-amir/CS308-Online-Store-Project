const express = require('express');
const authRoutes = require('./modules/auth/auth.routes');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');

const app = express();

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'vinyl-store-backend' });
});

// Routes
app.use('/api/auth', authRoutes);

//any request that didn't match a route above becomes a 404
app.use(notFound);

// Error handler must be last
app.use(errorHandler);

module.exports = app;