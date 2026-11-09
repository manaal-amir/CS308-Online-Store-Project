const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({ jsonTransport: true });

async function sendInvoiceEmail(invoice, pdfBuffer) {
  const mail = {
    from: 'invoices@vinylstore.test',
    to: invoice.customer.email,
    subject: `Your Vinyl Store invoice ${invoice.invoiceNumber}`,
    text: `Hi ${invoice.customer.name},\n\nThank you for your order. Your invoice is attached.\n\nTotal: ${Number(invoice.totalAmount).toFixed(2)} TRY`,
    attachments: [
      {
        filename: `${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  };

  const info = await transport.sendMail(mail);
  console.log(`[invoice-email] Sent to ${invoice.customer.email}, PDF size: ${pdfBuffer.length} bytes`);
  return { sent: true, preview: info.message };
}

module.exports = { sendInvoiceEmail };