const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { getInvoice, list } = require('./invoice.controller');

const router = express.Router();

//list all invoices — product manager or sales manager (VS-47)
//must come before /:orderId, otherwise "GET /" matches /:orderId with an empty id
router.get(
  '/',
  authenticate,
  authorize('PRODUCT_MANAGER', 'SALES_MANAGER'),
  list
);

//single invoice — the owner or staff
//read-only: 404 if the invoice does not exist yet (checkout creates it)
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