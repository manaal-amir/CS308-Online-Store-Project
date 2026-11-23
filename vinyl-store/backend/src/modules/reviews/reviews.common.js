//shared checks for ratings and comments (requirement 5)

//creates an error with a status so the error handler sends the right response
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

//throws 404 if the record does not exist
//db is prisma or a transaction, so the check can run inside one
async function ensureProductExists(db, productId) {
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) {
    throw httpError(404, 'Product not found');
  }
}

//true if the customer has at least one delivered order with this record
//only delivered orders count, processing, in transit and cancelled ones do not
async function hasDeliveredOrder(db, userId, productId) {
  const order = await db.order.findFirst({
    where: { userId, status: 'DELIVERED', items: { some: { productId } } },
    select: { id: true },
  });
  return order !== null;
}

//average stars and number of ratings of one record, average rounded to 1 decimal (e.g. 4.3)
//a record with no ratings yet has averageRating null, so the frontend can show "no ratings"
async function getRatingSummary(db, productId) {
  const result = await db.rating.aggregate({
    where: { productId },
    _avg: { value: true },
    _count: { _all: true },
  });
  const average = result._avg.value;
  return {
    averageRating: average === null ? null : Math.round(average * 10) / 10,
    ratingCount: result._count._all,
  };
}

module.exports = { httpError, ensureProductExists, hasDeliveredOrder, getRatingSummary };
