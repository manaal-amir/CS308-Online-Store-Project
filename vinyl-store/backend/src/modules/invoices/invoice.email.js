const nodemailer = require('nodemailer');

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

function buildTransport() {
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return nodemailer.createTransport({ jsonTransport: true });
}

const transport = buildTransport();

// Same 4-var check as buildTransport — if any var is missing, we're on jsonTransport
const usingSmtp = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);

async function sendInvoiceEmail(invoice, pdfBuffer) {
  const from = process.env.MAIL_FROM || 'invoices@vinylstore.test';

  const mail = {
    from,
    to: invoice.customer.email,
    subject: `Your Vinyl Store invoice ${invoice.invoiceNumber}`,
    text: `Hi ${invoice.customer.name},\n\nThank you for your order. Your invoice is attached.\n\nTotal: ${Number(invoice.totalAmount).toFixed(2)} TRY`,
    attachments: [
      { filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer },
    ],
  };

  const info = await transport.sendMail(mail);

  if (usingSmtp) {
    console.log(`[invoice-email] Sent to ${invoice.customer.email} via SMTP (${info.messageId})`);
  } else {
    console.log(
      `[invoice-email] NOT SENT — SMTP not configured. Email captured as JSON (to=${invoice.customer.email}, PDF ${pdfBuffer.length} bytes).`
    );
  }

  return { sent: usingSmtp, preview: info.message };
}

module.exports = { sendInvoiceEmail };