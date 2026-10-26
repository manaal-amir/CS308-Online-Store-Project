//simple email pattern: something@something.something with no spaces
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//plain decimal numbers only, e.g. "5", "-2", "19.99" (blocks things like "0x10" or "1e3")
const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

//checks one value against its rules, returns an error message or null if it is valid
function checkField(name, value, rules) {
  //treat undefined, null and empty strings as missing
  const missing = value === undefined || value === null || value === '';

  if (missing) {
    //missing is only a problem if the field is required
    return rules.required ? `${name} is required` : null;
  }

  //check the type first, other rules only make sense if the type is right
  if (rules.type === 'string' && typeof value !== 'string') {
    return `${name} must be a string`;
  }
  if (rules.type === 'integer' && !Number.isInteger(value)) {
    return `${name} must be an integer`;
  }
  if (rules.type === 'number' && (typeof value !== 'number' || Number.isNaN(value))) {
    return `${name} must be a number`;
  }
  if (rules.type === 'boolean' && typeof value !== 'boolean') {
    return `${name} must be true or false`;
  }
  if (rules.type === 'email' && (typeof value !== 'string' || !EMAIL_PATTERN.test(value))) {
    return `${name} must be a valid email`;
  }

  //number limits, e.g. quantity must be at least 1
  if (rules.min !== undefined && value < rules.min) {
    return `${name} must be at least ${rules.min}`;
  }
  if (rules.max !== undefined && value > rules.max) {
    return `${name} must be at most ${rules.max}`;
  }

  //value must be one of a fixed list, e.g. sort must be 'price' or 'popularity'
  if (rules.enum && !rules.enum.includes(value)) {
    return `${name} must be one of: ${rules.enum.join(', ')}`;
  }

  //value must match a custom pattern, e.g. taxId must be 10 or 11 digits
  if (rules.pattern && (typeof value !== 'string' || !rules.pattern.test(value))) {
    return rules.patternMessage || `${name} has an invalid format`;
  }

  //string length limits, e.g. password must be at least 8 characters
  if (rules.minLength !== undefined && value.length < rules.minLength) {
    return `${name} must be at least ${rules.minLength} characters`;
  }
  if (rules.maxLength !== undefined && value.length > rules.maxLength) {
    return `${name} must be at most ${rules.maxLength} characters`;
  }

  //every rule passed
  return null;
}

//cleans a value before checking it
function prepare(value, rules) {
  //remove spaces at the start and end, so "  " counts as missing and " a@b.com" becomes "a@b.com"
  //set trim: false for fields like passwords where spaces are on purpose
  if (typeof value === 'string' && rules.trim !== false) {
    value = value.trim();
  }

  //url params and query values always arrive as text, e.g. "5", so turn numeric text into numbers
  const wantsNumber = rules.type === 'integer' || rules.type === 'number';
  if (wantsNumber && typeof value === 'string' && NUMBER_PATTERN.test(value)) {
    return Number(value);
  }

  //query values like ?inStock=true also arrive as text
  if (rules.type === 'boolean' && (value === 'true' || value === 'false')) {
    return value === 'true';
  }

  return value;
}

//builds a middleware from a schema like { body: { quantity: { type: 'integer', min: 1 } } }
//schema can have body, params and query sections
function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    //go through each part of the request that the schema mentions
    for (const location of ['body', 'params', 'query']) {
      const fields = schema[location];
      if (!fields) continue;

      //req.body can be missing if no json was sent, so default to an empty object
      const source = req[location] || {};

      for (const [name, rules] of Object.entries(fields)) {
        //trim text and convert "5" to 5 where a number is expected
        const value = prepare(source[name], rules);
        const message = checkField(name, value, rules);

        if (message) {
          errors.push(message);
        } else if (value !== undefined) {
          //save the cleaned value so the controller gets trimmed text and real numbers
          source[name] = value;
        }
      }

      //put the object back in case it was missing before
      req[location] = source;
    }

    //if anything failed, send one 400 error listing all problems to the error handler
    if (errors.length > 0) {
      const err = new Error(errors.join(', '));
      err.status = 400;
      return next(err);
    }

    //all good, continue to the controller
    next();
  };
}

module.exports = validate;