const express = require('express');
const cors = require('cors');
const authRoutes = require('./modules/auth/auth.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const productRoutes = require('./modules/products/product.routes');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');
const invoiceRoutes = require('./modules/invoices/invoice.routes');
const orderRoutes = require('./modules/orders/orders.routes');



const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

app.use('/api/invoices', invoiceRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'vinyl-store-backend' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
//cart routes, only for logged in customers
app.use('/api/cart', cartRoutes);
//order routes: checkout, cancel, history and status updates
app.use('/api/orders', orderRoutes);

//any request that didn't match a route above becomes a 404
app.use(notFound);

// Error handler must be last
app.use(errorHandler);

module.exports = app;