import { normalizeMobile, isValidMobile } from './validation';

export const isMobileDevice = () => /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(navigator.userAgent);

export const buildBillMessage = ({ billNumber, customerName, businessName, total, paymentMode, items }) =>
  `Hello ${customerName || 'there'},\n\nThank you for shopping with ${businessName || 'us'}!\n\nBill No: ${billNumber}\nTotal: ₹${Number(total || 0).toFixed(2)}\nPayment: ${paymentMode}\n\nItems:\n${(items || []).map(item => `- ${item.name} x${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}`).join('\n')}\n\nThank you!`;

export const getWhatsAppTarget = (phone, message) => {
  const normalized = normalizeMobile(phone);
  if (!isValidMobile(normalized)) return null;
  const encodedMessage = encodeURIComponent(message);
  return isMobileDevice()
    ? `whatsapp://send?phone=91${normalized}&text=${encodedMessage}`
    : `https://web.whatsapp.com/send?phone=91${normalized}&text=${encodedMessage}`;
};

export const openWhatsApp = (phone, message) => {
  const target = getWhatsAppTarget(phone, message);
  if (!target) return false;
  const popup = window.open(target, '_blank', 'noopener,noreferrer');
  return Boolean(popup);
};
