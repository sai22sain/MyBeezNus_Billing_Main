const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateBillPDF = (billData, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text(process.env.BUSINESS_NAME || process.env.SALON_NAME || 'Business Name', { align: 'center' });
      doc.fontSize(10).text(process.env.BUSINESS_ADDRESS || process.env.SALON_ADDRESS || '', { align: 'center' });
      doc.text(process.env.BUSINESS_PHONE || process.env.SALON_PHONE || '', { align: 'center' });
      doc.moveDown();

      // Bill details
      doc.fontSize(12).text(`Bill No: ${billData.bill_number}`, { align: 'left' });
      doc.text(`Date: ${new Date(billData.created_at).toLocaleString()}`, { align: 'left' });
      doc.moveDown();

      // Customer details
      doc.text(`Customer: ${billData.customer_name}`);
      doc.text(`Mobile: ${billData.customer_mobile}`);
      doc.moveDown();

      // Table header
      const tableTop = doc.y;
      doc.fontSize(10).text('Item', 50, tableTop, { width: 200 });
      doc.text('Qty', 250, tableTop, { width: 50 });
      doc.text('Price', 300, tableTop, { width: 80 });
      doc.text('Total', 380, tableTop, { width: 100 });
      
      doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();
      
      let yPosition = tableTop + 25;

      // Items
      billData.items.forEach(item => {
        doc.text(item.item_name, 50, yPosition, { width: 200 });
        doc.text(item.quantity.toString(), 250, yPosition, { width: 50 });
        doc.text(`₹${item.price.toFixed(2)}`, 300, yPosition, { width: 80 });
        doc.text(`₹${item.subtotal.toFixed(2)}`, 380, yPosition, { width: 100 });
        yPosition += 20;
      });

      doc.moveTo(50, yPosition).lineTo(500, yPosition).stroke();
      yPosition += 10;

      // Totals
      doc.text(`Subtotal: ₹${billData.total_amount.toFixed(2)}`, 350, yPosition, { width: 150 });
      yPosition += 20;
      
      if (billData.discount > 0) {
        doc.text(`Discount: -₹${billData.discount.toFixed(2)}`, 350, yPosition, { width: 150 });
        yPosition += 20;
      }
      
      if (billData.tax > 0) {
        doc.text(`Tax: ₹${billData.tax.toFixed(2)}`, 350, yPosition, { width: 150 });
        yPosition += 20;
      }

      doc.fontSize(12).text(`Final Total: ₹${billData.final_amount.toFixed(2)}`, 350, yPosition, { width: 150 });
      yPosition += 20;
      doc.fontSize(10).text(`Payment Mode: ${billData.payment_mode}`, 350, yPosition, { width: 150 });

      // Footer
      doc.moveDown(3);
      doc.fontSize(10).text('Thank you for your visit!', { align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateBillPDF };
