const ratingService = require('./rating.service');

//reads the request, calls the service, and sends the result
//errors go to next(err) so the error handler formats them

//POST /api/products/:id/ratings
async function rate(req, res, next) {
  try {
    //req.params.id and req.body.value are already numbers, the validate middleware checked them
    const result = await ratingService.rateProduct(req.user.id, req.params.id, req.body.value);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

//GET /api/products/:id/reviews/me
async function getMine(req, res, next) {
  try {
    const result = await ratingService.getMyReview(req.user.id, req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { rate, getMine };
