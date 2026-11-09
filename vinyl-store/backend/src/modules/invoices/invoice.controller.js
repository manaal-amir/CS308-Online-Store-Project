const { buildInvoice } = require('./invoice.service');
const { generatePdf } = require('./invoice.pdf');
const { sendInvoiceEmail } = require('./invoice.email');
const prisma = require('../../config/prisma');

async function getInvoice(req, res, next) {
  try {
    const orderId = req.params.orderId;  // already validated + converted to integer
    const invoice = await buildInvoice(orderId, req.user);
    const pdfBuffer = await generatePdf(invoice);

    if (!invoice.emailedAt) {
      await sendInvoiceEmail(invoice, pdfBuffer);
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { emailedAt: new Date() },
      });
    }

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