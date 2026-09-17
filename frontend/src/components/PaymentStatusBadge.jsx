import React from 'react';
import { calculatePaymentStatus } from '../utils/paymentStatus';

function PaymentStatusBadge({ status, totalAmount, paidAmount, dueDate }) {
  const resolvedStatus = status || calculatePaymentStatus(totalAmount, paidAmount, dueDate);
  const label = resolvedStatus.replace('_', ' ');

  return <span className={`payment-status-badge payment-status-${resolvedStatus.toLowerCase().replace('_', '-')}`} role="status">{label}</span>;
}

export default PaymentStatusBadge;
