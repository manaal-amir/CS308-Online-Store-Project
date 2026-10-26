const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');

//every cart route needs a logged in customer, guests keep their cart in the browser
//managers and support agents do not shop, so their roles are blocked (requirement 17)
router.use(authenticate, authorize('CUSTOMER'));

//largest number a postgres Int column can hold, bigger values would crash prisma
const MAX_INT = 2147483647;

//reusable rules for ids and quantities
const idRule = { required: true, type: 'integer', min: 1, max: MAX_INT };
const quantityRule = { type: 'integer', min: 1, max: MAX_INT };
const productIdParam = { params: { productId: idRule } };

//view the cart
router.get('/', cartController.getCart);

//add a product, quantity defaults to 1
router.post(
  '/items',
  validate({
    body: {
      productId: idRule,
      quantity: quantityRule,
    },
  }),
  cartController.addItem
);

//change the quantity of a product already in the cart, use delete to remove it
router.patch(
  '/items/:productId',
  validate({ ...productIdParam, body: { quantity: { ...quantityRule, required: true } } }),
  cartController.updateItem
);

//remove a product from the cart
router.delete('/items/:productId', validate(productIdParam), cartController.removeItem);

//merge the browser cart into the database cart after login
router.post('/merge', cartController.mergeCart);

module.exports = router;