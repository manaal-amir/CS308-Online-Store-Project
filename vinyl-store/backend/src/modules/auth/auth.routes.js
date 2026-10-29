const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const validate = require('../../middlewares/validate');

//bcrypt only uses the first 72 bytes of a password, so longer ones are rejected
const MAX_PASSWORD_LENGTH = 72;

//rules for registering, all fields are required for customers (requirement 10)
//text is trimmed by the validator, so values made of only spaces count as missing
const registerRules = {
  body: {
    name: { required: true, type: 'string', maxLength: 100 },
    lastname: { required: true, type: 'string', maxLength: 100 },
    email: { required: true, type: 'email', maxLength: 254 },
    //trim is off because spaces in a password are on purpose
    password: { required: true, type: 'string', minLength: 8, maxLength: MAX_PASSWORD_LENGTH, trim: false },
    taxId: { required: true, type: 'string', maxLength: 20 },
    homeAddress: { required: true, type: 'string', maxLength: 300 },
  },
};

//rules for logging in, only the format is checked here, the password itself is checked by bcrypt
const loginRules = {
  body: {
    email: { required: true, type: 'email', maxLength: 254 },
    password: { required: true, type: 'string', maxLength: MAX_PASSWORD_LENGTH, trim: false },
  },
};

router.post('/logout', authController.logout);

router.post('/register', validate(registerRules), authController.register);
router.post('/login', validate(loginRules), authController.login);

module.exports = router;