const prisma = require('../../config/prisma')

//creates an error with a status so the error handler sends the right response
function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

//the only moves a product manager can make: forward only
//CANCELLED is not here because cancelling restores stock and refunds
//customers cancel through POST /:id/cancel instead
const ALLOWED_MOVES = {
  PROCESSING: ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

async function updateStatus(orderId, newStatus) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    })

    if (!order) {
      throw httpError(404, 'Order not found')
    }

    const allowed = ALLOWED_MOVES[order.status] || []
    if (!allowed.includes(newStatus)) {
      const allowedText = allowed.length ? allowed.join(', ') : 'none'
      throw httpError(
        409,
        `Cannot move order from ${order.status} to ${newStatus}. Allowed: ${allowedText}`
      )
    }

    //conditional update: only succeeds if the status is still what we just read
    //this closes the race with a customer cancelling at the same moment
    //if the row changed between findUnique and updateMany, count is 0 and we return 409
    const changed = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: newStatus },
    })

    if (changed.count === 0) {
      throw httpError(409, 'Order status changed at the same time, please try again')
    }

    const updated = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, updatedAt: true },
    })

    return {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt,
    }
  })
}

module.exports = { updateStatus }