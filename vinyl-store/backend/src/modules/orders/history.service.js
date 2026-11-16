const prisma = require('../../config/prisma');

//creates an error with a status so the error handler sends the right response
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

//prisma returns prices as Decimal objects, convert them to normal numbers rounded to 2 decimals
function toMoney(decimal) {
  return Math.round(Number(decimal) * 100) / 100;
}

//returns the user's orders, newest first (requirement 3: order history page)
//only the summary is sent here, the items are loaded by getOrder
async function listOrders(userId) {
  const orders = await prisma.order.findMany({
    where: { userId },
    //id breaks ties between orders created in the same millisecond
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, status: true, totalPrice: true, createdAt: true },
  });

  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    total: toMoney(order.totalPrice),
  }));
}

//returns one order with its items, but only if it belongs to this user
async function getOrder(userId, orderId) {
  //the userId is part of the query, so someone else's order is simply "not found"
  //the 404 (instead of 403) also means nobody can find out which order ids exist
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: {
        orderBy: { id: 'asc' },
        include: { product: { include: { artist: true } } },
      },
    },
  });
  if (!order) {
    throw httpError(404, 'Order not found');
  }

  const items = order.items.map((item) => {
    //unitPrice is the price actually paid at checkout, not the current product price
    const unitPrice = toMoney(item.unitPrice);
    return {
      productId: item.productId,
      name: item.product.name,
      artist: item.product.artist ? item.product.artist.name : null,
      imageUrl: item.product.imageUrl,
      unitPrice,
      quantity: item.quantity,
      lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
    };
  });

  //unitCost is left out on purpose, it is the store's cost and customers must not see it
  //only the last 4 card digits are stored, so that is all there is to show
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    deliveryAddress: order.deliveryAddress,
    cardLast4: order.cardLast4,
    total: toMoney(order.totalPrice),
    items,
  };
}

module.exports = { listOrders, getOrder };