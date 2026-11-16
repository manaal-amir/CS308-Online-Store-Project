const deliveryService = require('./delivery.service');

//reads the request, calls the service, and sends the result
//errors go to next(err) so the error handler formats them

//GET /api/deliveries
async function listDeliveries(req, res, next) {
  try {
    //completed is optional, the validate middleware already turned "true"/"false" into a boolean
    const deliveries = await deliveryService.listDeliveries({ completed: req.query.completed });
    res.status(200).json(deliveries);
  } catch (err) {
    next(err);
  }
}

module.exports = { listDeliveries };