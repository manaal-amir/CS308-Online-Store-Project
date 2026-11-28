const express = require('express');
const productController = require('./product.controller');
const validate = require('../../middlewares/validate');
const { authenticate, authorize } = require('../../middlewares/auth');

const router = express.Router();

const idRule = {
  params: {
    id: { required: true, type: 'integer', min: 1, max: 2147483647 },
  },
};

const listRules = {
  query: {
    genre: { type: 'string' },
    search: { type: 'string' },
    sort: {
      type: 'string',
      enum: ['price_asc', 'price_desc', 'newest', 'featured', 'popularity'],
    },
  },
};

//quantity is the new total stock, 0 means sold out (requirement 12)
const stockRules = {
  ...idRule,
  body: {
    quantity: { required: true, type: 'integer', min: 0, max: 2147483647 },
  },
};

//The storefront catalog is public; write operations require separate authorization.
router.get('/', validate(listRules), productController.getProducts);
router.get('/:id', validate(idRule), productController.getProductById);

//only product managers can change stock, the auth is on this route only so the catalog stays public
router.patch(
  '/:id/stock',
  authenticate,
  authorize('PRODUCT_MANAGER'),
  validate(stockRules),
  productController.updateStock
);

module.exports = router;
