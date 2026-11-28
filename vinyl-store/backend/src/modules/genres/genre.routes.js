const express = require('express');
const genreController = require('./genre.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');

//routes under /api/genres, product managers add and remove genres here (requirement 12)
//there is no list route, GET /api/products/options already returns the genres
const router = express.Router();

//largest number a postgres Int column can hold, bigger ids would crash the query
const MAX_INT = 2147483647;

//every route here is for product managers only
router.use(authenticate, authorize('PRODUCT_MANAGER'));

//name is trimmed by the validator, so "  " counts as missing
const createRules = {
  body: {
    name: { required: true, type: 'string', maxLength: 50 },
    description: { type: 'string', maxLength: 1000 },
  },
};

const idRule = {
  params: { id: { required: true, type: 'integer', min: 1, max: MAX_INT } },
};

router.post('/', validate(createRules), genreController.create);
router.delete('/:id', validate(idRule), genreController.remove);

module.exports = router;
