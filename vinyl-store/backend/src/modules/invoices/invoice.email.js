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

jest.mock('../src/config/prisma', () => ({
  order: { findUnique: jest.fn() },
  invoice: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
}));
jest.mock('../src/modules/invoices/invoice.email', () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue({ sent: false }),
}));

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_secret';

function customerToken(id = 2) {
  return jwt.sign({ id, role: 'CUSTOMER' }, 'test_secret');
}

beforeEach(() => jest.resetAllMocks());

describe('GET /api/invoices/:orderId', () => {
  it('returns 200 for own order', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 1,
      userId: 2,
      totalPrice: 1650,
      deliveryAddress: 'Test St',
      user: { name: 'T', lastname: 'U', email: 't@x.com', homeAddress: 'H' },
      items: [{ quantity: 1, unitPrice: 1650, product: { name: 'P', model: 'M', serialNumber: 'S' } }],
    });
    prisma.invoice.findUnique.mockResolvedValue({
      id: 10, invoiceNumber: 'INV-X', totalAmount: 1650, issuedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/invoices/1')
      .set('Authorization', `Bearer ${customerToken(2)}`);

    expect(res.status).toBe(200);
    expect(res.body.invoiceNumber).toBe('INV-X');
    expect(res.body.items.length).toBe(1);
  });

  it("returns 404 for another user's order", async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 1, userId: 999, totalPrice: 1650, deliveryAddress: 'X',
      user: { name: 'T', lastname: 'U', email: 't@x.com', homeAddress: 'H' },
      items: [],
    });

    const res = await request(app)
      .get('/api/invoices/1')
      .set('Authorization', `Bearer ${customerToken(2)}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const res = await request(app)
      .get('/api/invoices/abc')
      .set('Authorization', `Bearer ${customerToken(2)}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/invoices/1');
    expect(res.status).toBe(401);
  });
});

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