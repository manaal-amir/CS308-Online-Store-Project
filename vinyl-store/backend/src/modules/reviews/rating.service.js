const prisma = require('../../config/prisma');
const {
  httpError,
  ensureProductExists,
  hasDeliveredOrder,
  getRatingSummary,
} = require('./reviews.common');

//saves the stars in one step: creates the rating, or changes it if the customer rated before
//the table allows one rating per customer per record, so duplicates cannot happen
function saveRating(userId, productId, value) {
  return prisma.rating.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, value },
    update: { value },
  });
}

//rates a record the customer received, 1 to 5 stars (requirement 5)
//ratings need no approval, so the new average is returned for the page to show straight away
async function rateProduct(userId, productId, value) {
  //checked first because a customer who received the record needs only this one query
  if (!(await hasDeliveredOrder(prisma, userId, productId))) {
    //a missing record gets 404, an existing one the customer did not receive gets 403
    await ensureProductExists(prisma, productId);
    throw httpError(403, 'You can only rate records that have been delivered to you');
  }

  try {
    await saveRating(userId, productId, value);
  } catch (err) {
    //a double click can make two first ratings race, one of them hits the unique rule (P2002)
    //by then the rating exists, so trying once more simply updates it
    if (err.code !== 'P2002') throw err;
    await saveRating(userId, productId, value);
  }

  const summary = await getRatingSummary(prisma, productId);
  return { productId, value, ...summary };
}

//tells the product page what this customer can do on a record
//canReview: they received it, so the stars and the comment form can be shown
//rating: their current stars or null, hasPendingComment: show "waiting for approval" instead of the form
async function getMyReview(userId, productId) {
  await ensureProductExists(prisma, productId);

  const [canReview, rating, pending] = await Promise.all([
    hasDeliveredOrder(prisma, userId, productId),
    prisma.rating.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { value: true },
    }),
    prisma.comment.findFirst({
      where: { userId, productId, status: 'PENDING' },
      select: { id: true },
    }),
  ]);

  return {
    productId,
    canReview,
    rating: rating ? rating.value : null,
    hasPendingComment: pending !== null,
  };
}

module.exports = { rateProduct, getMyReview };
