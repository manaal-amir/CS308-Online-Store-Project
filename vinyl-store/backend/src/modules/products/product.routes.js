const express = require('express');
const productController = require('./product.controller');
const validate = require('../../middlewares/validate');

const router = express.Router();

const idRule = { params: { id: { required: true, type: 'integer', min: 1 } } };

//The storefront catalog is public; write operations require separate authorization.
router.get('/', productController.getProducts);
router.get('/:id', validate(idRule), productController.getProductById);

module.exports = router;