const cartService = require('./cart.service');

//each function reads the request, calls the service, and sends the result
//errors go to next(err) so the error handler formats them

//GET /api/cart
async function getCart(req, res, next) {
  try {
    //req.user is set by the authenticate middleware from the jwt
    const cart = await cartService.getCart(req.user.id);
    res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
}

//POST /api/cart/items
async function addItem(req, res, next) {
  try {
    //quantity is optional, an "add to cart" click adds 1
    const { productId, quantity = 1 } = req.body;
    const cart = await cartService.addItem(req.user.id, productId, quantity);
    res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
}

//PATCH /api/cart/items/:productId
async function updateItem(req, res, next) {
  try {
    const cart = await cartService.updateItem(req.user.id, req.params.productId, req.body.quantity);
    res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
}

//DELETE /api/cart/items/:productId
async function removeItem(req, res, next) {
  try {
    const cart = await cartService.removeItem(req.user.id, req.params.productId);
    res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
}

//POST /api/cart/merge
async function mergeCart(req, res, next) {
  try {
    const result = await cartService.mergeCart(req.user.id, req.body.items);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { getCart, addItem, updateItem, removeItem, mergeCart };