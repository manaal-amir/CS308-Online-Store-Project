const { buildInvoice } = require('./invoice.service');

async function getInvoice(req, res, next) {
  try {
    const orderId = req.params.orderId;
    const invoice = await buildInvoice(orderId, req.user);

    // No PDF generation here — checkout generates + emails it.
    // GET must be side-effect-free.

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

module.exports = { getInvoice };
