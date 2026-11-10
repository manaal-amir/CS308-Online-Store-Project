const nodemailer = require('nodemailer');

function buildTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  // Fallback: no SMTP configured — capture the email as JSON and log it.
  // This does NOT send anything. Use only for local dev without SMTP.
  return nodemailer.createTransport({ jsonTransport: true });
}

const transport = buildTransport();
const usingSmtp = Boolean(process.env.SMTP_HOST);

async function sendInvoiceEmail(invoice, pdfBuffer) {
  const from = process.env.MAIL_FROM || 'invoices@vinylstore.test';

  const mail = {
    from,
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

  if (usingSmtp) {
    console.log(`[invoice-email] Sent to ${invoice.customer.email} via SMTP (${info.messageId})`);
  } else {
    console.log(
      `[invoice-email] NOT SENT — SMTP not configured. Email captured as JSON (to=${invoice.customer.email}, subject="${mail.subject}", PDF ${pdfBuffer.length} bytes). Set SMTP_HOST/PORT/USER/PASS in .env to actually send.`
    );
  }

  return { sent: usingSmtp, preview: info.message };
}

module.exports = { sendInvoiceEmail };