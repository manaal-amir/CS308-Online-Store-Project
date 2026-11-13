const cancelService = require('./cancel.service');

//reads the request, calls the service, and sends the result
//errors go to next(err) so the error handler formats them

//POST /api/orders/:id/cancel
async function cancel(req, res, next) {
  try {
    //req.params.id is already a number, the validate middleware converted it
    const order = await cancelService.cancelOrder(req.user.id, req.params.id);
    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
}

module.exports = { cancel };
