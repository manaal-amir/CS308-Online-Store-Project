const express = require('express');
const router = express.Router();
const checkoutController = require('./checkout.controller');
const cancelController = require('./cancel.controller');
const statusController = require('./status.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');

//all order routes are shared by the team, each route keeps its own controller file:
//checkout and cancel (ayesha), history (sedra), status updates (manaal)

//every order route needs a logged in user (requirement 4)
//guests get 401 here and the frontend sends them to sign in
router.use(authenticate);

//roles are checked per route, not here, because customers and product managers use different routes
const customerOnly = authorize('CUSTOMER');
const productManagerOnly = authorize('PRODUCT_MANAGER');

//largest number a postgres Int column can hold, bigger ids would crash the query
const MAX_INT = 2147483647;

//an order id in the url, e.g. /api/orders/42/cancel
const orderIdParam = { params: { id: { required: true, type: 'integer', min: 1, max: MAX_INT } } };

//the customer enters card details to buy (requirement 15)
//they are checked here so the service only gets clean values
//cardNumber and cvv are text, not numbers, so leading zeros are kept
//expiryYear must have 4 digits, e.g. 2030 not 30
const checkoutRules = {
  body: {
    cardNumber: {
      required: true,
      type: 'string',
      pattern: /^\d{13,19}$/,
      patternMessage: 'cardNumber must be 13 to 19 digits with no spaces',
    },
    cardHolder: { required: true, type: 'string', maxLength: 100 },
    expiryMonth: { required: true, type: 'integer', min: 1, max: 12 },
    expiryYear: { required: true, type: 'integer', min: 2000, max: 2100 },
    cvv: {
      required: true,
      type: 'string',
      pattern: /^\d{3,4}$/,
      patternMessage: 'cvv must be 3 or 4 digits',
    },
    //optional, the customer's home address is used if it is empty
    deliveryAddress: { type: 'string', maxLength: 300 },
  },
};

// VS-35: product manager updates an order's status
const statusBody = {
  body: {
    status: {
      required: true,
      type: 'string',
      enum: ['PROCESSING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'],
    },
  },
};

//checkout: turns the customer's cart into a paid order
router.post('/', customerOnly, validate(checkoutRules), checkoutController.checkout);

//cancel: only while the order is processing, gives the stock back (requirement 14)
router.post('/:id/cancel', customerOnly, validate(orderIdParam), cancelController.cancel);

//status: product manager updates an order's status (VS-35)
router.patch(
  '/:id/status',
  productManagerOnly,
  validate(orderIdParam),
  validate(statusBody),
  statusController.updateStatus
);

module.exports = router;