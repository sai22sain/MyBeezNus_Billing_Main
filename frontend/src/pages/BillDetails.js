import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { billAPI } from '../utils/firestoreAPI';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/dateFormat';
import { showConfirmation, showToast } from '../services/notificationService';
import { buildBillMessage, openWhatsApp } from '../utils/whatsapp';
import { isValidMobile } from '../utils/validation';

const money = value => `₹${Number(value || 0).toFixed(2)}`;

function BillDetails() {
  const { user } = useAuth();
  const { billId } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadBill = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setBill(await billAPI.getById(user.uid, billId));
    } catch (error) {
      console.error('Load bill failed:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user?.uid && billId) loadBill(); }, [user?.uid, billId]); // eslint-disable-line react-hooks/exhaustive-deps

  const shareWhatsApp = () => {
    if (!isValidMobile(bill.customerMobile)) {
      showToast({ type: 'warning', message: "This customer doesn't have a valid WhatsApp number." });
      return;
    }
    const message = buildBillMessage({
      billNumber: bill.billNumber,
      customerName: bill.customerName,
      total: bill.finalAmount,
      paymentMode: bill.paymentMode,
      items: bill.items,
    });
    if (openWhatsApp(bill.customerMobile, message)) showToast({ type: 'info', message: 'WhatsApp opened with the bill ready to send.' });
    else showToast({ type: 'warning', message: "WhatsApp isn't available on this device." });
  };

  const deleteBill = () => showConfirmation({
    title: 'Delete Bill?',
    message: `Are you sure you want to delete ${bill.billNumber}? This action cannot be undone.`,
    confirmText: 'Delete Bill',
    destructive: true,
    onConfirm: async () => {
      try {
        await billAPI.delete(user.uid, bill.id);
        showToast({ type: 'success', message: 'Bill deleted successfully.' });
        navigate('/bills');
      } catch {
        showToast({ type: 'error', message: 'Unable to delete the bill. Please try again.' });
      }
    },
  });

  if (loading) return <div className="bill-detail-state"><i className="fas fa-spinner fa-spin"></i><p>Loading bill details...</p></div>;
  if (loadError || !bill) return <div className="bill-detail-state"><i className="fas fa-receipt"></i><h2>Unable to load this bill.</h2><button className="btn btn-primary" onClick={loadBill}>Retry</button></div>;

  const items = bill.items || [];
  const actions = [
    { label: 'Edit', icon: 'fa-edit', onClick: () => navigate('/bills', { state: { editBillId: bill.id } }) },
    { label: 'WhatsApp', icon: 'fa-whatsapp', brand: true, onClick: shareWhatsApp },
    { label: 'Mail', icon: 'fa-envelope', disabled: true, onClick: () => showToast({ type: 'info', message: 'Email sharing is coming soon.' }) },
    { label: 'PDF / Print', icon: 'fa-file-pdf', disabled: true, onClick: () => showToast({ type: 'info', message: 'PDF and print are coming soon.' }) },
  ];

  return (
    <div className="bill-detail-page">
      <div className="bill-detail-header">
        <div className="bill-detail-heading">
          <Link className="bill-back-link" to="/bills"><i className="fas fa-arrow-left"></i> Bills</Link>
          <div className="bill-detail-title-row"><h1>{bill.billNumber}</h1><span className="bill-recorded-badge">Payment: {bill.paymentMode || 'Not specified'}</span></div>
          <p>{bill.customerName || 'Customer-less bill'}{bill.customerMobile ? ` · ${bill.customerMobile}` : ''}</p>
        </div>
        <div className="bill-detail-actions">
          {actions.map(action => <button key={action.label} className={`btn ${action.disabled ? 'btn-ghost bill-action-disabled' : 'btn-ghost'}`} onClick={action.onClick} disabled={false} title={action.disabled ? `${action.label} coming soon` : action.label}><i className={`${action.brand ? 'fab' : 'fas'} ${action.icon}`}></i><span>{action.label}</span>{action.disabled && <small>Coming soon</small>}</button>)}
          <button className="btn btn-ghost bill-delete-action" onClick={deleteBill} title="Delete bill"><i className="fas fa-trash"></i><span>Delete</span></button>
        </div>
      </div>

      <div className="bill-detail-layout">
        <article className="invoice-document">
          <div className="invoice-document-head">
            <div><div className="invoice-kicker">MyBeezNus Billing</div><h2>Bill / Invoice</h2></div>
            <div className="invoice-meta"><span>Invoice number</span><strong>{bill.billNumber}</strong><span>Date</span><strong>{formatDateTime(bill.createdAt)}</strong></div>
          </div>
          <div className="invoice-customer-block"><span className="invoice-section-label">Billed to</span><strong>{bill.customerName || 'Customer-less bill'}</strong>{bill.customerMobile && <span>{bill.customerMobile}</span>}</div>
          <div className="invoice-section-label invoice-items-label">Items</div>
          <div className="invoice-items-table invoice-items-table-head"><span>Item</span><span>Qty</span><span>Rate</span><span>Amount</span></div>
          {items.length ? items.map((item, index) => <div className="invoice-items-table invoice-item-row" key={`${item.name}-${index}`}><span>{item.name || 'Unnamed item'}</span><span>{item.quantity}</span><span>{money(item.price)}</span><strong>{money(Number(item.price) * Number(item.quantity))}</strong></div>) : <div className="invoice-empty-items">No items recorded for this bill.</div>}
          <div className="invoice-total-block">
            <div><span>Subtotal</span><strong>{money(bill.totalAmount)}</strong></div>
            <div><span>Tax</span><strong>{money(bill.tax)}</strong></div>
            <div><span>Discount</span><strong>{bill.discount ? `-${money(bill.discount)}` : money(0)}</strong></div>
            <div className="invoice-grand-total"><span>Total</span><strong>{money(bill.finalAmount)}</strong></div>
          </div>
          <div className="invoice-payment-strip"><span>Payment method</span><strong>{bill.paymentMode || 'Not specified'}</strong></div>
        </article>

        <aside className="bill-supporting-info">
          <section className="bill-info-section"><div className="bill-info-section-heading"><i className="fas fa-user"></i><h2>Customer</h2></div><strong>{bill.customerName || 'Customer-less bill'}</strong>{bill.customerMobile ? <span>{bill.customerMobile}</span> : <span>No mobile number recorded</span>}{bill.customerId && <Link to={`/customers?customer=${bill.customerId}`} className="bill-text-link">View customer</Link>}</section>
          <section className="bill-info-section"><div className="bill-info-section-heading"><i className="fas fa-wallet"></i><h2>Payment summary</h2></div><div className="bill-summary-line"><span>Method</span><strong>{bill.paymentMode || 'Not specified'}</strong></div><div className="bill-summary-line"><span>Total</span><strong>{money(bill.finalAmount)}</strong></div><p className="bill-data-note">Payment status is not stored for this bill.</p></section>
          <section className="bill-info-section bill-next-actions"><div className="bill-info-section-heading"><i className="fas fa-bolt"></i><h2>Actions</h2></div><button className="btn btn-primary" onClick={shareWhatsApp}><i className="fab fa-whatsapp"></i> Share via WhatsApp</button><button className="btn btn-ghost" onClick={() => navigate('/bills', { state: { editBillId: bill.id } })}><i className="fas fa-edit"></i> Edit bill</button></section>
        </aside>
      </div>
    </div>
  );
}

export default BillDetails;