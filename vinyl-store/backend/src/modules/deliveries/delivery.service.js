const prisma = require('../../config/prisma');

//prisma returns prices as Decimal objects, convert them to normal numbers rounded to 2 decimals
function toMoney(decimal) {
  return Math.round(Number(decimal) * 100) / 100;
}

//which orders belong in the list, cancelled orders are never delivered so they are left out
//completed = true means delivered, false means still waiting (processing or in transit)
function statusFilter(completed) {
  if (completed === true) return 'DELIVERED';
  if (completed === false) return { in: ['PROCESSING', 'IN_TRANSIT'] };
  return { not: 'CANCELLED' };
}

//the delivery list for the product manager (requirement 12)
//one row per product in an order, and the delivery id is the order id, so the manager can
//use the same id to move the order forward with PATCH /api/orders/:id/status (VS-35)
async function listDeliveries({ completed } = {}) {
  const orders = await prisma.order.findMany({
    where: { status: statusFilter(completed) },
    //postgres sorts enums in the order they are declared in schema.prisma
    //(PROCESSING, IN_TRANSIT, DELIVERED), so waiting orders come first, oldest first
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      userId: true,
      status: true,
      deliveryAddress: true,
      createdAt: true,
      items: {
        orderBy: { id: 'asc' },
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  return orders.flatMap((order) =>
    order.items.map((item) => ({
      deliveryId: order.id,
      customerId: order.userId,
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      //price actually paid for this line (discount included), not the current product price
      totalPrice: toMoney((Math.round(Number(item.unitPrice) * 100) * item.quantity) / 100),
      deliveryAddress: order.deliveryAddress,
      status: order.status,
      completed: order.status === 'DELIVERED',
      createdAt: order.createdAt,
    }))
  );
}

module.exports = { listDeliveries };
