const productService = require('./product.service');

//GET /api/products
async function getProducts(req, res, next) {
  try {
    const products = await productService.getProducts();
    res.status(200).json(products);
  } catch (err) {
    next(err);
  }
}

module.exports = { getProducts };