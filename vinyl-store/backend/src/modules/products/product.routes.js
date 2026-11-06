const express = require('express');
const productController = require('./product.controller');
const validate = require('../../middlewares/validate');

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
      enum: ['price_asc', 'price_desc', 'newest', 'featured'],
    },
  },
};

//The storefront catalog is public; write operations require separate authorization.
router.get('/', validate(listRules), productController.getProducts);
router.get('/:id', validate(idRule), productController.getProductById);

module.exports = router;