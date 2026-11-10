const { buildInvoice } = require('./invoice.service');
const { generatePdf } = require('./invoice.pdf'); 

async function getInvoice(req, res, next) {
  try {
    const invoice = await buildInvoice(orderId, req.user);
  const pdfBuffer = await generatePdf(invoice);  // still generate — for potential download later
// Email is sent by checkout (Ayesha), not here. GET must be side-effect-free.

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