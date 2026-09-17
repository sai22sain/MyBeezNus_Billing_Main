import { calculatePaymentStatus, getPaymentBalance, PAYMENT_STATUSES } from './paymentStatus';

describe('calculatePaymentStatus', () => {
  const beforeDueDate = new Date(2026, 8, 16);
  const afterDueDate = new Date(2026, 8, 17);

  test('returns unpaid when nothing is paid', () => {
    expect(calculatePaymentStatus(1000, 0, '', beforeDueDate)).toBe(PAYMENT_STATUSES.UNPAID);
  });

  test('returns partially paid for an incomplete payment', () => {
    expect(calculatePaymentStatus(1000, 500, '', beforeDueDate)).toBe(PAYMENT_STATUSES.PARTIALLY_PAID);
  });

  test('returns paid when the total is paid', () => {
    expect(calculatePaymentStatus(1000, 1000, '2026-09-10', afterDueDate)).toBe(PAYMENT_STATUSES.PAID);
  });

  test('returns overdue for an outstanding past-due balance', () => {
    expect(calculatePaymentStatus(1000, 0, '2026-09-10', afterDueDate)).toBe(PAYMENT_STATUSES.OVERDUE);
    expect(calculatePaymentStatus(1000, 500, '2026-09-10', afterDueDate)).toBe(PAYMENT_STATUSES.OVERDUE);
  });

  test('does not allow the balance to become negative', () => {
    expect(getPaymentBalance(1000, 1200)).toBe(0);
    expect(calculatePaymentStatus(1000, 1200, '', beforeDueDate)).toBe(PAYMENT_STATUSES.PAID);
  });
});
