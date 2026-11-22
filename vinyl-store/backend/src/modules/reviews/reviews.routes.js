const express = require('express');
const commentController = require('./comment.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');

//routes under /api/products/:id for ratings and comments (requirement 5)
//kept apart from product.routes.js so the catalogue and reviews never edit the same file
//mergeParams lets this router read :id from the path it is mounted on
const router = express.Router({ mergeParams: true });

//largest number a postgres Int column can hold, bigger ids would crash the query
const MAX_INT = 2147483647;

const productIdParam = { id: { required: true, type: 'integer', min: 1, max: MAX_INT } };

const commentRules = {
  params: productIdParam,
  body: { content: { required: true, type: 'string', maxLength: 1000 } },
};

//only customers who received the record can comment, product managers review comments elsewhere
router.post(
  '/comments',
  authenticate,
  authorize('CUSTOMER'),
  validate(commentRules),
  commentController.create
);

module.exports = router;
