const checkoutService = require('./checkout.service');

//reads the request, calls the service, and sends the result
//errors go to next(err) so the error handler formats them

//POST /api/orders
async function checkout(req, res, next) {
  try {
    //req.user is set by the authenticate middleware from the jwt
    const order = await checkoutService.checkout(req.user.id, req.body);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

module.exports = { checkout };
