const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth');
const userController = require('./user.controller');

router.get('/me', authenticate, userController.getMe);

module.exports = router;
