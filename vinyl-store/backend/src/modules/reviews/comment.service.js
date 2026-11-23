const prisma = require('../../config/prisma');
const { httpError, ensureProductExists, hasDeliveredOrder } = require('./reviews.common');

//turns a saved comment into a simple object for the frontend
function formatComment(comment) {
  return {
    id: comment.id,
    productId: comment.productId,
    content: comment.content,
    status: comment.status,
    createdAt: comment.createdAt,
  };
}

//saves a comment on a record the customer received (requirement 5)
//it stays pending until a product manager approves it, so nobody else sees it yet
//a customer can only have one pending comment per record, so the pending list is not spammed
async function createComment(userId, productId, content) {
  return prisma.$transaction(async (tx) => {
    //lock this customer's row until the transaction ends, so a double click waits here
    //and then finds the first comment, instead of both requests saving one
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;

    //checked first because a customer who received the record needs only this one query
    if (!(await hasDeliveredOrder(tx, userId, productId))) {
      //a missing record gets 404, an existing one the customer did not receive gets 403
      await ensureProductExists(tx, productId);
      throw httpError(403, 'You can only comment on records that have been delivered to you');
    }

    const pending = await tx.comment.findFirst({
      where: { userId, productId, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw httpError(409, 'You already have a comment waiting for approval on this record');
    }

    const comment = await tx.comment.create({
      data: { userId, productId, content, status: 'PENDING' },
    });
    return formatComment(comment);
  });
}

module.exports = { createComment, formatComment };
