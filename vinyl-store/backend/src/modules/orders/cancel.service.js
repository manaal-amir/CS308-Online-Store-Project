const prisma = require('../../config/prisma');

//creates an error with a status so the error handler sends the right response
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

//turns the cancelled order into a simple object for the frontend
function formatCancelledOrder(order, items) {
  return {
    id: order.id,
    status: order.status,
    totalPrice: Number(order.totalPrice),
    refundedAmount: Number(order.totalPrice),
    items: items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      quantity: item.quantity,
    })),
  };
}

//explains why an order could not be cancelled
//another customer's order looks the same as a missing one (404), so order ids of others are not revealed
async function cancelError(tx, userId, orderId) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { userId: true, status: true } });
  if (!order || order.userId !== userId) {
    return httpError(404, 'Order not found');
  }
  return httpError(409, `Only orders that are processing can be cancelled, this order is ${order.status}`);
}

//cancels the customer's order while it is still processing (requirement 14)
//the stock is given back and the payment is marked as refunded
//everything happens together in one transaction, or not at all
async function cancelOrder(userId, orderId) {
  return prisma.$transaction(async (tx) => {
    //change the status only if the order is this customer's and still processing, in one step
    //so a double click, or a product manager shipping it at the same moment, cannot cancel it twice
    const changed = await tx.order.updateMany({
      where: { id: orderId, userId, status: 'PROCESSING' },
      data: { status: 'CANCELLED' },
    });
    if (changed.count === 0) {
      throw await cancelError(tx, userId, orderId);
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { select: { name: true } } } } },
    });

    //give the stock back, products in id order like checkout so the two never block each other
    const items = [...order.items].sort((a, b) => a.productId - b.productId);
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity } },
      });
    }

    //the mock bank always accepts refunds, so the payment is marked as refunded straight away
    await tx.payment.updateMany({
      where: { orderId, status: 'SUCCESSFUL' },
      data: { status: 'REFUNDED' },
    });

    return formatCancelledOrder(order, order.items);
  });
}

module.exports = { cancelOrder };
