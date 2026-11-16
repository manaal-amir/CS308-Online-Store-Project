const historyService = require('./history.service');

//reads the request, calls the service, and sends the result
//errors go to next(err) so the error handler formats them

//GET /api/orders
async function listOrders(req, res, next) {
  try {
    //req.user is set by the authenticate middleware from the jwt
    const orders = await historyService.listOrders(req.user.id);
    res.status(200).json(orders);
  } catch (err) {
    next(err);
  }
}

//GET /api/orders/:id
async function getOrder(req, res, next) {
  try {
    //req.params.id is already a number, the validate middleware converted it
    const order = await historyService.getOrder(req.user.id, req.params.id);
    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
}

module.exports = { listOrders, getOrder };