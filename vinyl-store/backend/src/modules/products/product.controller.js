const productService = require('./product.service');

//GET /api/products
async function getProducts(req, res, next) {
  try {
    const { genre } = req.query;
    const products = await productService.getProducts({ genre });
    res.status(200).json(products);
  } catch (err) {
    next(err);
  }
}

module.exports = { getProducts };