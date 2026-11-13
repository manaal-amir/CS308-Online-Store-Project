const prisma = require('../../config/prisma');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const ALLOWED_STATUSES = ['PROCESSING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];

async function updateStatus(orderId, newStatus) {
  if (!ALLOWED_STATUSES.includes(newStatus)) {
    throw httpError(400, `status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!order) {
      throw httpError(404, 'Order not found');
    }

    // Business rule (req 14): can't cancel a delivered order
    if (newStatus === 'CANCELLED' && order.status === 'DELIVERED') {
      throw httpError(409, 'Cannot cancel a delivered order');
    }

    // Business rule: can't un-cancel or un-deliver
    if (order.status === 'CANCELLED' && newStatus !== 'CANCELLED') {
      throw httpError(409, 'Cannot change the status of a cancelled order');
    }
    if (order.status === 'DELIVERED' && newStatus !== 'DELIVERED') {
      throw httpError(409, 'Cannot change the status of a delivered order');
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    return {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  });
}

module.exports = { updateStatus };