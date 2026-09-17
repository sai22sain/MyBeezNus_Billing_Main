import { isValidEmail } from '../utils/validation';

const encode = value => encodeURIComponent(String(value || ''));

export const buildInvoiceEmailSubject = bill =>
  `Your Bill from MyBeezNus • ${bill.billNumber}`;

export const buildInvoiceEmailBody = (bill, customer) => {
  const billDate = new Date(bill.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const totalAmount = `₹${Number(bill.finalAmount || 0).toFixed(2)}`;
  return `MYBEEZNUS\nBilling\n\n────────────────────────────────\n\nYOUR BILL\n${bill.billNumber}\n\nHello ${customer.name},\n\nThank you for your business.\n\nBILL SUMMARY\n────────────────────────────────\nBill Number    ${bill.billNumber}\nBill Date      ${billDate}\nTotal Amount   ${totalAmount}\n────────────────────────────────\n\nThank you for choosing MyBeezNus.\n\nMyBeezNus Billing`;
};

export const buildGmailWebComposeUrl = ({ to, subject, body }) =>
  `https://mail.google.com/mail/?view=cm&to=${encode(to)}&su=${encode(subject)}&body=${encode(body)}`;

const buildGmailMobileComposeUrl = ({ to, subject, body }) =>
  `googlegmail:///co?to=${encode(to)}&subject=${encode(subject)}&body=${encode(body)}`;

const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const openGmailCompose = ({ to, subject, body }) => {
  if (!isValidEmail(to)) return false;
  const webUrl = buildGmailWebComposeUrl({ to, subject, body });
  if (!isMobileDevice()) {
    window.open(webUrl, '_blank', 'noopener,noreferrer');
    return true;
  }

  const mobileUrl = buildGmailMobileComposeUrl({ to, subject, body });
  const startedAt = Date.now();
  window.location.href = mobileUrl;
  window.setTimeout(() => {
    if (document.visibilityState === 'visible' && Date.now() - startedAt >= 900) window.open(webUrl, '_blank', 'noopener,noreferrer');
  }, 1000);
  return true;
};