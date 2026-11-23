const prisma = require('../../config/prisma');

function generateInvoiceNumber(orderId) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `INV-${date}-${String(orderId).padStart(5, '0')}`;
}

//used by checkout to create the invoice if it doesn't exist yet
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

  // Ownership check: customer can only see own orders; staff roles allowed
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

//read-only version used by GET /api/invoices/:orderId — does not create the invoice
//404 if the invoice does not exist yet (checkout creates it)
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
    items: (invoice.order.items || []).map((item) => ({
      productName: item.product?.name,
      model: item.product?.model,
      serialNumber: item.product?.serialNumber,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.unitPrice) * item.quantity,
    })),
  };
}

//parses a date string from the query — throws 400 if invalid
function parseDate(value, name) {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    const err = new Error(`${name} must be a valid date (YYYY-MM-DD)`);
    err.status = 400;
    throw err;
  }
  return d;
}

//lists all invoices — used by the product manager / sales manager (VS-47)
//optional ?from=YYYY-MM-DD&to=YYYY-MM-DD filters by issue date
//the to date includes the whole last day (23:59:59.999 UTC)
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
