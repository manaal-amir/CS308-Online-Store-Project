//shared checks for ratings and comments (requirement 5)

//creates an error with a status so the error handler sends the right response
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

//throws 404 if the record does not exist or was removed from the shop
//db is prisma or a transaction, so the check can run inside one
async function ensureProductExists(db, productId) {
  const product = await db.product.findUnique({
    where: { id: productId, isHidden: false },
    select: { id: true },
  });
  if (!product) {
    throw httpError(404, 'Product not found');
  }
}

//true if the customer has at least one delivered order with this record
//only delivered orders count, processing, in transit and cancelled ones do not
//a removed record never counts, so a new rating or comment on it gets 404 from ensureProductExists
async function hasDeliveredOrder(db, userId, productId) {
  const order = await db.order.findFirst({
    where: {
      userId,
      status: 'DELIVERED',
      items: { some: { productId, product: { isHidden: false } } },
    },
    select: { id: true },
  });
  return order !== null;
}

//turns an average and a count into the summary the API sends, average rounded to 1 decimal (e.g. 4.3)
//a record with no ratings yet has averageRating null, so the frontend can show "no ratings"
function toRatingSummary(average, count) {
  return {
    averageRating: average === null ? null : Math.round(average * 10) / 10,
    ratingCount: count,
  };
}

//average stars and number of ratings of one record
async function getRatingSummary(db, productId) {
  const result = await db.rating.aggregate({
    where: { productId },
    _avg: { value: true },
    _count: { _all: true },
  });
  return toRatingSummary(result._avg.value, result._count._all);
}

//average stars and number of ratings of many records in one query, for the catalog list
//returns a Map of productId -> summary, records with no ratings are not in the Map
async function getRatingSummaries(db, productIds) {
  if (productIds.length === 0) {
    return new Map();
  }
  const rows = await db.rating.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds } },
    _avg: { value: true },
    _count: { _all: true },
  });
  return new Map(
    rows.map((row) => [row.productId, toRatingSummary(row._avg.value, row._count._all)])
  );
}

module.exports = {
  httpError,
  ensureProductExists,
  hasDeliveredOrder,
  getRatingSummary,
  getRatingSummaries,
};
