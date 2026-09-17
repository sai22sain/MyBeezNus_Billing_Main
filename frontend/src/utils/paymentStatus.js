export const PAYMENT_STATUSES = Object.freeze({
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
});

const toAmount = value => Math.max(0, Number(value) || 0);

const startOfLocalDay = value => {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const calculatePaymentStatus = (totalAmount, paidAmount, dueDate, today = new Date()) => {
  const total = toAmount(totalAmount);
  const paid = Math.min(toAmount(paidAmount), total);
  const balance = Math.max(0, total - paid);
  const due = startOfLocalDay(dueDate);
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (balance > 0 && due && due < currentDay) return PAYMENT_STATUSES.OVERDUE;
  if (paid <= 0) return PAYMENT_STATUSES.UNPAID;
  if (balance > 0) return PAYMENT_STATUSES.PARTIALLY_PAID;
  return PAYMENT_STATUSES.PAID;
};

export const getPaymentBalance = (totalAmount, paidAmount) =>
  Math.max(0, toAmount(totalAmount) - Math.min(toAmount(paidAmount), toAmount(totalAmount)));
