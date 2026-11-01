const productService = require('./product.service');

//GET /api/products
async function getProducts(req, res, next) {
  try {
    const { genre, search } = req.query;
    const products = await productService.getProducts({ genre, search });
    res.status(200).json(products);
  } catch (err) {
    next(err);
  }
}

//GET /api/products/:id
async function getProductById(req, res, next) {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      const err = new Error('Product not found');
      err.status = 404;
      return next(err);
    }
    res.status(200).json(product);
  } catch (err) {
    next(err);
  }
}

module.exports = { getProducts, getProductById };