const express = require('express');
const cors = require('cors');
const authRoutes = require('./modules/auth/auth.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const productRoutes = require('./modules/products/product.routes');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');
const invoiceRoutes = require('./modules/invoices/invoice.routes');
const orderRoutes = require('./modules/orders/orders.routes');
const deliveryRoutes = require('./modules/deliveries/delivery.routes');
const productReviewRoutes = require('./modules/reviews/reviews.routes');
const commentRoutes = require('./modules/reviews/comments.routes');
const userRoutes = require('./modules/users/user.routes');
const wishlistRoutes = require('./modules/wishlist/wishlist.routes');
const genreRoutes = require('./modules/genres/genre.routes');

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());

app.use('/api/invoices', invoiceRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'vinyl-store-backend' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
//ratings and comments of one record, e.g. /api/products/5/comments
app.use('/api/products/:id', productReviewRoutes);
//comment approval, only for product managers
app.use('/api/comments', commentRoutes);
//cart routes, only for logged in customers
app.use('/api/cart', cartRoutes);
//order routes: checkout, cancel, history and status updates
app.use('/api/orders', orderRoutes);
//delivery list, only for product managers
app.use('/api/deliveries', deliveryRoutes);
//user profile, e.g. /api/users/me
app.use('/api/users', userRoutes);

app.use('/api/wishlist', wishlistRoutes);
//add and remove genres, only for product managers
app.use('/api/genres', genreRoutes);

//any request that didn't match a route above becomes a 404
app.use(notFound);

// Error handler must be last
app.use(errorHandler);

module.exports = app;
