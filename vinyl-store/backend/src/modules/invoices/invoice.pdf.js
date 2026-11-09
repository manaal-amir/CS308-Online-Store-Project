const PDFDocument = require('pdfkit');

function generatePdf(invoice) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const customer = invoice.customer || {};
      const customerName = [customer.name, customer.lastname].filter(Boolean).join(' ') || 'Customer';
      const customerEmail = customer.email || '';

      doc.fontSize(20).text('VINYL STORE', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Invoice: ${invoice.invoiceNumber}`, { align: 'center' });
      doc.text(`Date: ${new Date(invoice.issuedAt).toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(11).text('Bill to:');
      doc.fontSize(10).text(customerName);
      if (customerEmail) doc.text(customerEmail);
      doc.text(invoice.deliveryAddress || '');
      doc.moveDown(1);

      doc.fontSize(11).text('Items:', { underline: true });
      doc.moveDown(0.5);

      const items = invoice.items || [];
      if (items.length === 0) {
        doc.fontSize(10).text('(no items)');
      } else {
        items.forEach((item) => {
          doc.fontSize(10).text(
            `${item.productName || 'Product'} (${item.model || ''}) x${item.quantity} — ${Number(item.lineTotal || 0).toFixed(2)} TRY`
          );
        });
      }

      doc.moveDown(1);
      doc.fontSize(12).text(`Total: ${Number(invoice.totalAmount || 0).toFixed(2)} TRY`, {
        align: 'right',
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
module.exports = { generatePdf };