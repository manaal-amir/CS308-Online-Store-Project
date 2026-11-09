const express = require('express');
const { authenticate } = require('../../middlewares/auth');
const { getInvoice } = require('./invoice.controller');

const router = express.Router();

router.get('/:orderId', authenticate, getInvoice);

module.exports = router;