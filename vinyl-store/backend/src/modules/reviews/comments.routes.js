const express = require('express');
const commentController = require('./comment.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');

//routes under /api/comments, product managers review comments here (requirement 5)
const router = express.Router();

//largest number a postgres Int column can hold, bigger ids would crash the query
const MAX_INT = 2147483647;

//every route here is for product managers only
router.use(authenticate, authorize('PRODUCT_MANAGER'));

//a manager can only approve or reject, a comment never goes back to pending
const reviewRules = {
  params: { id: { required: true, type: 'integer', min: 1, max: MAX_INT } },
  body: { status: { required: true, type: 'string', enum: ['APPROVED', 'REJECTED'] } },
};

router.get('/pending', commentController.listPending);
router.patch('/:id', validate(reviewRules), commentController.review);

module.exports = router;
