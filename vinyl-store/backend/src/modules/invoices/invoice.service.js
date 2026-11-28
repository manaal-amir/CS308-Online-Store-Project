const prisma = require('../../config/prisma');

function generateInvoiceNumber(orderId) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `INV-${date}-${String(orderId).padStart(5, '0')}`;
}

//turns order items into invoice lines (name, quantity, unit price, line total)
function mapInvoiceItems(items) {
  return (items || []).map((item) => ({
    productName: item.product?.name,
    model: item.product?.model,
    serialNumber: item.product?.serialNumber,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    lineTotal: Number(item.unitPrice) * item.quantity,
  }));
}

async function buildInvoice(orderId, user) {
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

  const isOwner = order.userId === user.id;
  const isStaff = ['SALES_MANAGER', 'PRODUCT_MANAGER', 'SUPPORT_AGENT'].includes(user.role);
  // 404, not 403 — don't leak existence
  if (!isOwner && !isStaff) {
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
    items: mapInvoiceItems(order.items),
  };
}

//finds an existing invoice for GET /api/invoices/:orderId, never creates one
//owner and staff can see it, anyone else gets 404
async function getInvoiceForRead(orderId, user) {
  const invoice = await prisma.invoice.findUnique({
    where: { orderId },
    include: {
      order: {
        select: {
          userId: true,
          deliveryAddress: true,
          user: { select: { name: true, lastname: true, email: true, homeAddress: true } },
          items: {
            include: {
              product: { select: { name: true, model: true, serialNumber: true } },
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    const err = new Error('Invoice not found');
    err.status = 404;
    throw err;
  }

  const isOwner = invoice.order.userId === user.id;
  const isStaff = ['SALES_MANAGER', 'PRODUCT_MANAGER', 'SUPPORT_AGENT'].includes(user.role);
  // 404, not 403 — don't leak existence
  if (!isOwner && !isStaff) {
    const err = new Error('Invoice not found');
    err.status = 404;
    throw err;
  }

  return {
    ...invoice,
    customer: invoice.order.user,
    deliveryAddress: invoice.order.deliveryAddress,
    items: mapInvoiceItems(invoice.order.items),
  };
}

//turns a from/to query value into a Date, invalid text gives a 400 instead of a 500
function parseDate(value, name) {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    const err = new Error(`${name} must be a valid date (YYYY-MM-DD)`);
    err.status = 400;
    throw err;
  }
  return d;
}

//all invoices for product and sales managers, newest first, optional from/to date range
async function listInvoices({ from, to } = {}) {
  const where = {};
  if (from || to) {
    where.issuedAt = {};
    if (from) where.issuedAt.gte = parseDate(from, 'from');
    if (to) {
      const toDate = parseDate(to, 'to');
      toDate.setUTCHours(23, 59, 59, 999);
      where.issuedAt.lte = toDate;
    }
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { issuedAt: 'desc' },
    include: {
      order: {
        select: {
          id: true,
          user: { select: { name: true, lastname: true, email: true } },
        },
      },
    },
  });

  return invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    totalAmount: Number(inv.totalAmount),
    issuedAt: inv.issuedAt,
    orderId: inv.orderId,
    customer: inv.order.user,
  }));
}

module.exports = {
  buildInvoice,
  generateInvoiceNumber,
  getInvoiceForRead,
  listInvoices,
};
