const express = require('express');
const router = express.Router();
const checkoutController = require('./checkout.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');

//all order routes are shared by the team, each route keeps its own controller file:
//checkout and cancel (ayesha), history (sedra), status updates (manaal)

//every order route needs a logged in user (requirement 4)
//guests get 401 here and the frontend sends them to sign in
router.use(authenticate);

//roles are checked per route, not here, because customers and product managers use different routes
const customerOnly = authorize('CUSTOMER');

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

//checkout: turns the customer's cart into a paid order
router.post('/', customerOnly, validate(checkoutRules), checkoutController.checkout);

module.exports = router;
