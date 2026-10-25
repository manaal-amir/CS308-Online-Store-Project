const express = require('express');
const authRoutes = require('./modules/auth/auth.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'vinyl-store-backend' });
});

// Routes
app.use('/api/auth', authRoutes);

// Error handler must be last
app.use(errorHandler);

module.exports = app;