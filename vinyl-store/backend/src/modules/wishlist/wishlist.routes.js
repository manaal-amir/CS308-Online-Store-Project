const express = require('express')
const router = express.Router()
const { authenticate, authorize } = require('../../middlewares/auth')
const validate = require('../../middlewares/validate')
const wishlistController = require('./wishlist.controller')

const customerOnly = authorize('CUSTOMER')

const productIdParam = {
  params: {
    productId: { required: true, type: 'integer', min: 1, max: 2147483647 },
  },
}

router.use(authenticate, customerOnly)

router.get('/', wishlistController.list)
router.post('/:productId', validate(productIdParam), wishlistController.add)
router.delete('/:productId', validate(productIdParam), wishlistController.remove)

module.exports = router