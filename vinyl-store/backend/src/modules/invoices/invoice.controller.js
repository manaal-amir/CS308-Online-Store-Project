const { buildInvoice } = require('./invoice.service');
const { generatePdf } = require('./invoice.pdf');
const { sendInvoiceEmail } = require('./invoice.email');
const prisma = require('../../config/prisma');

async function getInvoice(req, res, next) {
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId) || orderId < 1) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const invoice = await buildInvoice(orderId);
    const pdfBuffer = await generatePdf(invoice);

    // Send email only once — if not already sent
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