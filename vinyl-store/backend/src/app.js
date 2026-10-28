const express = require('express');
const cors = require('cors');
const authRoutes = require('./modules/auth/auth.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'vinyl-store-backend' });
});

// Routes
app.use('/api/auth', authRoutes);
//cart routes, only for logged in customers
app.use('/api/cart', cartRoutes);

//any request that didn't match a route above becomes a 404
app.use(notFound);

// Error handler must be last
app.use(errorHandler);

module.exports = app;