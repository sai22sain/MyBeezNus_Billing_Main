import React from 'react';
import { calculatePaymentStatus, getPaymentBalance } from '../../utils/paymentStatus';
import { getAccentTextColor, normalizeInvoiceAccent, normalizeInvoiceTemplate } from './invoiceTemplates';

const formatMoney = (value, currency = '₹') => `${currency || '₹'}${Number(value || 0).toFixed(2)}`;

const formatBillDate = value => value
  ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const clean = value => String(value || '').trim();

function BillDocument({ bill, customer, profile }) {
  const template = normalizeInvoiceTemplate(profile?.invoiceTemplate);
  const accent = normalizeInvoiceAccent(profile?.invoiceAccentColor);
  const accentText = getAccentTextColor(accent);
  const currency = profile?.currency || '₹';
  const items = Array.isArray(bill.items) ? bill.items : [];
  const status = calculatePaymentStatus(bill.finalAmount, bill.paidAmount, bill.dueDate);
  const balance = getPaymentBalance(bill.finalAmount, bill.paidAmount);
  const address = [profile?.address, profile?.area, profile?.city, profile?.state, profile?.pincode]
    .map(clean)
    .filter(Boolean)
    .join(', ');
  const businessContact = [profile?.phone, profile?.email].map(clean).filter(Boolean).join(' · ');
  const customerName = clean(customer?.name || bill.customerName) || 'Walk-in Customer';
  const customerMobile = clean(customer?.mobile || bill.customerMobile);
  const customerAddress = clean(customer?.address);
  const footer = clean(profile?.billFooter) || 'Thank you for your business.';

  return (
    <article className={`bill-document bill-document--${template}`} style={{ '--invoice-accent': accent, '--invoice-accent-text': accentText }}>
      <header className="bill-document-header">
        <div className="bill-document-brand">
          <div className="bill-document-kicker">MyBeezNus Billing</div>
          <h1>{clean(profile?.businessName) || 'MyBeezNus'}</h1>
          {address && <p>{address}</p>}
          {businessContact && <p>{businessContact}</p>}
          {profile?.showGstOnBill && clean(profile?.gstNumber) && <p>GSTIN: {profile.gstNumber}</p>}
        </div>
        <div className="bill-document-title">
          <span>{template === 'service' ? 'Service bill' : 'Bill'}</span>
          <strong>{bill.billNumber}</strong>
          <small>{formatBillDate(bill.createdAt)}</small>
        </div>
      </header>

      <section className="bill-document-customer">
        <div>
          <span className="bill-document-label">Billed to</span>
          <strong>{customerName}</strong>
          {customerMobile && <span>{customerMobile}</span>}
          {customer?.email && <span>{customer.email}</span>}
          {customerAddress && <span>{customerAddress}</span>}
        </div>
        {bill.dueDate && <div className="bill-document-due"><span className="bill-document-label">Due date</span><strong>{formatBillDate(bill.dueDate)}</strong></div>}
      </section>

      {template === 'modern' && <div className="bill-document-modern-note"><span>Invoice prepared for</span><strong>{customerName}</strong></div>}
      {template === 'professional' && <div className="bill-document-meta-band"><span>Document type <strong>Business bill</strong></span><span>Payment terms <strong>{bill.dueDate ? `Due ${formatBillDate(bill.dueDate)}` : 'Due on receipt'}</strong></span></div>}

      <table className="bill-document-items">
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Rate</th><th>Tax</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {items.length ? items.map((item, index) => {
            const lineAmount = Number(item.lineTotal ?? item.amount ?? (Number(item.price || 0) * Number(item.quantity || 0)));
            return <tr key={`${item.name || 'item'}-${index}`}>
              <td>{item.name || 'Unnamed item'}</td>
              <td>{item.quantity ?? 0}{item.unit ? ` ${item.unit}` : ''}</td>
              <td>{formatMoney(item.price, currency)}</td>
              <td>{item.tax ? `${item.tax}%` : '—'}</td>
              <td>{formatMoney(lineAmount, currency)}</td>
            </tr>;
          }) : <tr><td colSpan="5">No items recorded for this bill.</td></tr>}
        </tbody>
      </table>

      <section className="bill-document-summary">
        <div className="bill-document-totals">
          <div><span>Subtotal</span><strong>{formatMoney(bill.totalAmount, currency)}</strong></div>
          {Number(bill.discount || 0) > 0 && <div><span>Discount</span><strong>-{formatMoney(bill.discount, currency)}</strong></div>}
          {profile?.showTaxOnBill !== false && Number(bill.tax || 0) > 0 && <div><span>Tax</span><strong>{formatMoney(bill.tax, currency)}</strong></div>}
          <div className="bill-document-total"><span>Total</span><strong>{formatMoney(bill.finalAmount, currency)}</strong></div>
        </div>
      </section>

      <section className="bill-document-payment">
        <div><span>Amount paid</span><strong>{formatMoney(bill.paidAmount, currency)}</strong></div>
        <div><span>Balance due</span><strong>{formatMoney(balance, currency)}</strong></div>
        <div><span>Payment status</span><strong>{status.replace('_', ' ')}</strong></div>
        <div><span>Payment method</span><strong>{bill.paymentMode || 'Not specified'}</strong></div>
      </section>

      {template === 'professional' && <div className="bill-document-signature"><span>Authorized signature</span><i></i></div>}

      <footer className="bill-document-footer">
        <strong>{footer}</strong>
        <span>{clean(profile?.businessName) || 'MyBeezNus'} · Bill {bill.billNumber}</span>
      </footer>
    </article>
  );
}

export default BillDocument;
