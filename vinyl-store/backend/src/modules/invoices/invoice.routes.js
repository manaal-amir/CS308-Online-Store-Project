const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { getInvoice, list } = require('./invoice.controller');

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorize('PRODUCT_MANAGER', 'SALES_MANAGER'),
  list
);

router.get(
  '/:orderId',
  authenticate,
  validate({
    params: {
      orderId: { required: true, type: 'integer', min: 1, max: 2147483647 },
    },
  }),
  getInvoice
);

module.exports = router;
