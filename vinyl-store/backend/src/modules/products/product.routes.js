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

//biggest number an Int column in the database can store
const MAX_INT = 2147483647;

//a new record from the catalogue form (requirements 9, 11, 12)
//cost is optional, an empty cost is saved as null and checkout then uses half the price
const createRules = {
  body: {
    name: { required: true, type: 'string' },
    model: { required: true, type: 'string' },
    serialNumber: { required: true, type: 'string' },
    distributor: { required: true, type: 'string' },
    warrantyStatus: { required: true, type: 'string' },
    description: { required: true, type: 'string' },
    quantity: { required: true, type: 'integer', min: 0, max: MAX_INT },
    price: { required: true, type: 'number', min: 0.01, max: 99999999.99, maxDecimals: 2 },
    categoryId: { required: true, type: 'integer', min: 1, max: MAX_INT },
    artistId: { type: 'integer', min: 1, max: MAX_INT },
    genreId: { type: 'integer', min: 1, max: MAX_INT },
    cost: { type: 'number', min: 0, max: 99999999.99, maxDecimals: 2 },
    //only web links, so a value like javascript:... can never end up in an <img> or link
    imageUrl: {
      type: 'string',
      pattern: /^https?:\/\/\S+$/i,
      patternMessage: 'imageUrl must start with http:// or https://',
    },
  },
};

//The storefront catalog is public; write operations require separate authorization.
router.get('/', validate(listRules), productController.getProducts);

//dropdown choices for the catalogue form, only for product managers
//it must stay above /:id, or "options" would be read as a product id
router.get(
  '/options',
  authenticate,
  authorize('PRODUCT_MANAGER'),
  productController.getProductOptions
);

router.get('/:id', validate(idRule), productController.getProductById);

//only product managers can add records, the auth is on this route only so the catalog stays public
router.post(
  '/',
  authenticate,
  authorize('PRODUCT_MANAGER'),
  validate(createRules),
  productController.createProduct
);

//only product managers can change stock, the auth is on this route only so the catalog stays public
router.patch(
  '/:id/stock',
  authenticate,
  authorize('PRODUCT_MANAGER'),
  validate(stockRules),
  productController.updateStock
);

module.exports = router;
