const prisma = require('../../config/prisma');

function generateInvoiceNumber(orderId) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `INV-${date}-${String(orderId).padStart(5, '0')}`;
}

async function buildInvoice(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true, lastname: true, email: true, homeAddress: true } },
      items: {
        include: {
          product: { select: { name: true, model: true, serialNumber: true } },
        },
      },
    },
  });

  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  let invoice = await prisma.invoice.findUnique({ where: { orderId } });
  if (!invoice) {
    invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(order.id),
        totalAmount: order.totalPrice,
        orderId: order.id,
      },
    });
  }

  return {
    ...invoice,
    customer: order.user,
    deliveryAddress: order.deliveryAddress,
    items: (order.items || []).map((item) => ({
      productName: item.product?.name,
      model: item.product?.model,
      serialNumber: item.product?.serialNumber,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.unitPrice) * item.quantity,
    })),
  };
}

module.exports = { buildInvoice, generateInvoiceNumber };