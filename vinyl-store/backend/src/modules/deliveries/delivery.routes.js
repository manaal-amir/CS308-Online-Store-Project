const express = require('express');
const router = express.Router();
const deliveryController = require('./delivery.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');

//the delivery list is only for product managers, they are the delivery department (requirement 12)
router.use(authenticate, authorize('PRODUCT_MANAGER'));

//optional filter: ?completed=true shows delivered orders, ?completed=false shows the ones still waiting
router.get(
  '/',
  validate({ query: { completed: { type: 'boolean' } } }),
  deliveryController.listDeliveries
);

module.exports = router;