const express = require('express');
const productController = require('./product.controller');

const router = express.Router();

//The storefront catalog is public; write operations require separate authorization.
router.get('/', productController.getProducts);

module.exports = router;