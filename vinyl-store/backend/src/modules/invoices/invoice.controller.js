const { getInvoiceForRead, listInvoices } = require('./invoice.service');

async function getInvoice(req, res, next) {
  try {
    const orderId = req.params.orderId;
    const invoice = await getInvoiceForRead(orderId, req.user);

    res.status(200).json({
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      totalAmount: Number(invoice.totalAmount),
      customer: invoice.customer,
      deliveryAddress: invoice.deliveryAddress,
      items: invoice.items,
    });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { from, to } = req.query;
    const invoices = await listInvoices({ from, to });
    res.status(200).json(invoices);
  } catch (err) {
    next(err);
  }
}

module.exports = { getInvoice, list };