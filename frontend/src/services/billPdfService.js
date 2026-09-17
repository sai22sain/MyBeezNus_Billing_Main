import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const safeFilePart = value => String(value || 'bill')
  .trim()
  .replace(/[^a-z0-9._-]+/gi, '-')
  .replace(/^-+|-+$/g, '') || 'bill';

export const getBillPdfFilename = billNumber => `MyBeezNus-${safeFilePart(billNumber)}.pdf`;

export const downloadBillPdf = async (element, billNumber) => {
  if (!element) throw new Error('Bill document is unavailable');

  const canvas = await html2canvas(element, {
    scale: Math.min(window.devicePixelRatio || 1, 2),
    backgroundColor: '#ffffff',
    useCORS: true,
  });
  const imageData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageHeight = (canvas.height * pageWidth) / canvas.width;
  let position = 0;

  pdf.addImage(imageData, 'JPEG', 0, position, pageWidth, imageHeight);
  let remainingHeight = imageHeight - pageHeight;
  while (remainingHeight > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imageData, 'JPEG', 0, position, pageWidth, imageHeight);
    remainingHeight -= pageHeight;
  }

  pdf.save(getBillPdfFilename(billNumber));
};
