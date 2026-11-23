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

//comments waiting for a product manager, oldest first so none waits forever (requirement 5)
//the record and the author are included so the manager can judge the comment
async function listPendingComments() {
  const comments = await prisma.comment.findMany({
    where: { status: 'PENDING' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: {
      product: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, lastname: true } },
    },
  });
  return comments.map((comment) => ({
    ...formatComment(comment),
    productName: comment.product.name,
    author: {
      id: comment.user.id,
      name: `${comment.user.name} ${comment.user.lastname}`,
    },
  }));
}

//a product manager approves or rejects a pending comment (requirement 5)
//approved comments become visible on the product page, rejected ones never do
async function reviewComment(commentId, status) {
  //change the status only if the comment is still pending, in one step
  //so two managers deciding at the same moment cannot both change it
  const changed = await prisma.comment.updateMany({
    where: { id: commentId, status: 'PENDING' },
    data: { status },
  });

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    throw httpError(404, 'Comment not found');
  }
  if (changed.count === 0) {
    throw httpError(409, `This comment was already reviewed, it is ${comment.status}`);
  }
  return formatComment(comment);
}

//shows the author as first name and last initial, e.g. "Ada L.", so full names stay private
function publicAuthorName(user) {
  const initial = user.lastname ? ` ${user.lastname.charAt(0).toUpperCase()}.` : '';
  return `${user.name}${initial}`;
}

//approved comments of one record for the product page, newest first (requirement 5)
//pending and rejected comments are never shown here
async function listApprovedComments(productId) {
  await ensureProductExists(prisma, productId);

  const comments = await prisma.comment.findMany({
    where: { productId, status: 'APPROVED' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { user: { select: { name: true, lastname: true } } },
  });
  return comments.map((comment) => ({
    id: comment.id,
    productId: comment.productId,
    content: comment.content,
    createdAt: comment.createdAt,
    authorName: publicAuthorName(comment.user),
  }));
}

module.exports = {
  createComment,
  formatComment,
  listPendingComments,
  reviewComment,
  listApprovedComments,
};
