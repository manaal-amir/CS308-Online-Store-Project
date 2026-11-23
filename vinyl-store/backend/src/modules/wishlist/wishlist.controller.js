const wishlistService = require('./wishlist.service');

async function add(req, res, next) {
  try {
    const productId = Number(req.params.productId);
    const result = await wishlistService.addToWishList(req.user.id, productId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const productId = Number(req.params.productId);
    const result = await wishlistService.removeFromWishList(req.user.id, productId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await wishlistService.getWishList(req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { add, remove, list };
