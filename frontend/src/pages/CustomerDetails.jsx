import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { billAPI, customerAPI } from '../utils/firestoreAPI';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../services/notificationService';
import ResponsiveFormModal from '../components/ui/ResponsiveFormModal';
import CustomerForm from '../components/CustomerForm';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import { calculatePaymentStatus, getPaymentBalance, PAYMENT_STATUSES } from '../utils/paymentStatus';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import { openWhatsApp } from '../utils/whatsapp';
import { buildInvoiceEmailBody, buildInvoiceEmailSubject, openGmailCompose } from '../services/gmailComposeService';
import { isValidEmail, isValidMobile } from '../utils/validation';

const money = value => `₹${Number(value || 0).toFixed(2)}`;

const matchesDateRange = (value, from, to) => {
  if (!value) return false;
  const date = String(value).slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
};

function CustomerDetails() {
  const { user, profile } = useAuth();
  const { customerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedBills, setExpandedBills] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ billId: '', amount: '', paymentMode: 'Cash', paymentDate: new Date().toLocaleDateString('en-CA'), notes: '' });
  const [billFilters, setBillFilters] = useState({ search: '', status: 'ALL', from: '', to: '' });
  const [paymentFilters, setPaymentFilters] = useState({ method: 'ALL', from: '', to: '' });
  const [timelineFilters, setTimelineFilters] = useState({ type: 'ALL', from: '', to: '' });

  const loadDetails = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const nextDetails = await customerAPI.getDetails(user.uid, customerId);
      if (!nextDetails.customer) {
        setDetails(null);
      } else {
        setDetails(nextDetails);
      }
    } catch (error) {
      console.error('Load customer details failed:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.uid && customerId) loadDetails();
  }, [user?.uid, customerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (details?.customer && location.state?.openPayment && !loading) {
      openPaymentModal();
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [details, loading, location.pathname, location.state, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const outstandingBills = useMemo(() => (details?.bills || []).filter(bill => getPaymentBalance(bill.finalAmount, bill.paidAmount) > 0), [details]);

  const filteredBills = useMemo(() => (details?.bills || []).filter(bill => {
    const search = billFilters.search.trim().toLowerCase();
    const searchMatch = !search || String(bill.billNumber || '').toLowerCase().includes(search);
    const statusMatch = billFilters.status === 'ALL' || calculatePaymentStatus(bill.finalAmount, bill.paidAmount, bill.dueDate) === billFilters.status;
    return searchMatch && statusMatch && matchesDateRange(bill.createdAt, billFilters.from, billFilters.to);
  }), [details, billFilters]);

  const filteredPayments = useMemo(() => (details?.payments || []).filter(payment => (
    (paymentFilters.method === 'ALL' || payment.paymentMode === paymentFilters.method) &&
    matchesDateRange(payment.paymentDate || payment.createdAt, paymentFilters.from, paymentFilters.to)
  )), [details, paymentFilters]);

  const timelineEvents = useMemo(() => {
    const events = [
      ...(details?.bills || []).map(bill => ({ id: `bill-${bill.id}`, date: bill.createdAt, type: 'BILL', title: 'Bill created', detail: `${bill.billNumber} · ${money(bill.finalAmount)}`, icon: 'fa-receipt' })),
      ...(details?.payments || []).map(payment => ({ id: `payment-${payment.id}`, date: payment.createdAt || payment.paymentDate, type: 'PAYMENT', title: 'Payment received', detail: `${money(payment.amount)} · ${payment.paymentMode}`, icon: 'fa-hand-holding-usd' }))
    ];
    return events.filter(event => timelineFilters.type === 'ALL' || event.type === timelineFilters.type)
      .filter(event => matchesDateRange(event.date, timelineFilters.from, timelineFilters.to))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [details, timelineFilters]);

  const openPaymentModal = () => {
    const firstBill = outstandingBills[0];
    setPaymentForm({ billId: firstBill?.id || '', amount: '', paymentMode: 'Cash', paymentDate: new Date().toLocaleDateString('en-CA'), notes: '' });
    setShowPaymentModal(true);
  };

  const selectedPaymentBill = outstandingBills.find(bill => bill.id === paymentForm.billId);
  const selectedBalance = selectedPaymentBill ? getPaymentBalance(selectedPaymentBill.finalAmount, selectedPaymentBill.paidAmount) : 0;

  const savePayment = async event => {
    event.preventDefault();
    const amount = Number(paymentForm.amount);
    if (!selectedPaymentBill || !Number.isFinite(amount) || amount <= 0 || amount > selectedBalance) {
      showToast({ type: 'warning', message: `Payment must be greater than zero and no more than ${money(selectedBalance)}.` });
      return;
    }
    setPaymentSaving(true);
    try {
      await billAPI.recordPayment(user.uid, selectedPaymentBill.id, { ...paymentForm, amount });
      setShowPaymentModal(false);
      await loadDetails();
      showToast({ type: 'success', message: 'Payment recorded successfully.' });
    } catch (error) {
      showToast({ type: 'error', message: error?.message?.includes('outstanding') ? 'Payment exceeds the outstanding balance.' : 'Unable to record payment. Please try again.' });
    } finally {
      setPaymentSaving(false);
    }
  };

  const shareWhatsApp = () => {
    if (!isValidMobile(details.customer.mobile)) return showToast({ type: 'warning', message: "This customer doesn't have a valid WhatsApp number." });
    const message = `Hello ${details.customer.name},\n\nThank you for your business.\nOutstanding balance: ${money(details.summary.outstanding)}\n\nMyBeezNus Billing`;
    if (openWhatsApp(details.customer.mobile, message)) showToast({ type: 'info', message: 'WhatsApp opened with the customer message ready to send.' });
    else showToast({ type: 'warning', message: "WhatsApp isn't available on this device." });
  };

  const composeEmail = () => {
    if (!details.customer.email) return showToast({ type: 'warning', message: "This customer doesn't have an email address." });
    if (!isValidEmail(details.customer.email)) return showToast({ type: 'warning', message: 'This customer has an invalid email address.' });
    const latestBill = details.bills[0];
    const opened = latestBill
      ? openGmailCompose({ to: details.customer.email, subject: buildInvoiceEmailSubject(latestBill), body: buildInvoiceEmailBody(latestBill, details.customer) })
      : openGmailCompose({ to: details.customer.email, subject: `Hello from ${profile?.businessName || 'MyBeezNus Billing'}`, body: `Hello ${details.customer.name},\n\nThank you for being our customer.` });
    if (opened) showToast({ type: 'info', message: 'Gmail opened with the customer details ready to send.' });
  };

  const toggleBill = id => setExpandedBills(current => ({ ...current, [id]: !current[id] }));

  if (loading) return <div className="bill-detail-state"><i className="fas fa-circle-notch fa-spin"></i><h2>Loading customer details...</h2></div>;
  if (loadError) return <div className="bill-detail-state"><i className="fas fa-users"></i><h2>Unable to load customer details.</h2><button className="btn btn-primary" onClick={loadDetails}>Retry</button></div>;
  if (!details?.customer) return <div className="bill-detail-state"><i className="fas fa-user-slash"></i><h2>Customer not found.</h2><Link className="btn btn-primary" to="/customers">Back to Customers</Link></div>;

  const { customer, bills, payments, summary } = details;

  const renderBill = bill => {
    const balance = getPaymentBalance(bill.finalAmount, bill.paidAmount);
    return <article className="customer-history-bill" key={bill.id}>
      <div className="customer-history-bill-main"><div><Link to={`/bills/${bill.id}`} className="customer-history-bill-number">{bill.billNumber}</Link><small>{formatDate(bill.createdAt)}</small></div><div className="customer-history-bill-values"><strong>{money(bill.finalAmount)}</strong><span>Paid {money(bill.paidAmount)} · Due {money(balance)}</span></div><PaymentStatusBadge totalAmount={bill.finalAmount} paidAmount={bill.paidAmount} dueDate={bill.dueDate} /><button type="button" className="btn btn-ghost" onClick={() => toggleBill(bill.id)} aria-expanded={Boolean(expandedBills[bill.id])}>{expandedBills[bill.id] ? 'Hide items' : 'View items'}</button></div>
      {expandedBills[bill.id] && <div className="customer-history-items">{(bill.items || []).length === 0 ? <span>No items recorded</span> : <div className="customer-history-items-grid">{bill.items.map((item, index) => <div key={`${bill.id}-${index}`}><strong>{item.name}</strong><span>{item.quantity} {item.unit || ''}</span><span>{money(Number(item.price || 0) * Number(item.quantity || 0))}</span></div>)}</div>}</div>}
    </article>;
  };

  return <div className="customer-details-page">
    <div className="customer-details-header"><div><Link className="bill-back-link" to="/customers"><i className="fas fa-arrow-left"></i> Customers</Link><span className="billing-eyebrow">Customer Details</span><h1>{customer.name}</h1><div className="customer-details-contact"><span>{customer.mobile}</span>{customer.email && <span>{customer.email}</span>}{customer.address && <span>{customer.address}</span>}</div></div><div className="customer-details-actions"><button className="btn btn-primary" onClick={() => navigate('/new-bill', { state: { customer } })}><i className="fas fa-plus"></i> New bill</button><button className="btn btn-ghost" onClick={openPaymentModal} disabled={outstandingBills.length === 0}><i className="fas fa-hand-holding-usd"></i> Receive payment</button><button className="btn btn-ghost" onClick={shareWhatsApp} title="WhatsApp customer"><i className="fab fa-whatsapp"></i><span className="customer-action-label">WhatsApp</span></button><button className="btn btn-ghost" onClick={composeEmail} title="Email customer"><i className="fas fa-envelope"></i><span className="customer-action-label">Email</span></button><button className="btn btn-ghost" onClick={() => setEditing(true)} title="Edit customer"><i className="fas fa-edit"></i><span className="customer-action-label">Edit</span></button></div></div>
    <div className="customer-summary-grid">{[['Total bills', summary.totalBills, ''], ['Total spent', money(summary.totalSpent), ''], ['Total paid', money(summary.totalPaid), ''], ['Outstanding', money(summary.outstanding), summary.outstanding > 0 ? 'is-warning' : ''], ['Overdue', money(summary.overdue), summary.overdue > 0 ? 'is-danger' : '']].map(([label, value, className]) => <div className={`customer-summary-metric ${className}`} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="customer-details-tabs" role="tablist" aria-label="Customer history sections">{['overview', 'bills', 'payments', 'timeline'].map(tab => <button type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)} key={tab}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}</div>
    {activeTab === 'overview' && <div className="customer-history-columns"><section className="customer-history-section"><div className="customer-history-section-heading"><h2>Outstanding bills</h2>{summary.outstanding > 0 && <button className="billing-text-button" onClick={() => setActiveTab('bills')}>View all</button>}</div>{outstandingBills.length === 0 ? <p className="customer-history-empty">Nothing outstanding</p> : outstandingBills.slice(0, 5).map(renderBill)}</section><section className="customer-history-section"><div className="customer-history-section-heading"><h2>Recent bills</h2><button className="billing-text-button" onClick={() => setActiveTab('bills')}>View all</button></div>{bills.length === 0 ? <p className="customer-history-empty">No bills yet</p> : bills.slice(0, 5).map(renderBill)}<h2 className="customer-history-subheading">Recent payments</h2>{payments.length === 0 ? <p className="customer-history-empty">No payments recorded</p> : payments.slice(0, 5).map(payment => <div className="customer-payment-row" key={payment.id}><span>{formatDate(payment.paymentDate)}</span><strong>{money(payment.amount)}</strong><small>{payment.paymentMode}{payment.notes ? ` · ${payment.notes}` : ''}</small></div>)}</section></div>}
    {activeTab === 'bills' && <section className="customer-history-section"><div className="customer-history-section-heading"><h2>All bills</h2><span>{filteredBills.length} of {bills.length} bill{bills.length === 1 ? '' : 's'}</span></div><div className="customer-history-filters"><label>Search<input type="search" placeholder="Bill number" value={billFilters.search} onChange={event => setBillFilters({ ...billFilters, search: event.target.value })} /></label><label>Status<select value={billFilters.status} onChange={event => setBillFilters({ ...billFilters, status: event.target.value })}><option value="ALL">All statuses</option>{Object.values(PAYMENT_STATUSES).map(status => <option value={status} key={status}>{status.replace('_', ' ')}</option>)}</select></label><label>From<input type="date" value={billFilters.from} onChange={event => setBillFilters({ ...billFilters, from: event.target.value })} /></label><label>To<input type="date" value={billFilters.to} onChange={event => setBillFilters({ ...billFilters, to: event.target.value })} /></label><button type="button" className="billing-text-button" onClick={() => setBillFilters({ search: '', status: 'ALL', from: '', to: '' })}>Reset</button></div>{filteredBills.length === 0 ? <p className="customer-history-empty">No bills match these filters</p> : filteredBills.map(renderBill)}</section>}
    {activeTab === 'payments' && <section className="customer-history-section"><div className="customer-history-section-heading"><h2>Payment history</h2><span>{filteredPayments.length} of {payments.length} payment{payments.length === 1 ? '' : 's'}</span></div><div className="customer-history-filters"><label>Method<select value={paymentFilters.method} onChange={event => setPaymentFilters({ ...paymentFilters, method: event.target.value })}><option value="ALL">All methods</option>{[...new Set(payments.map(payment => payment.paymentMode).filter(Boolean))].map(method => <option value={method} key={method}>{method}</option>)}</select></label><label>From<input type="date" value={paymentFilters.from} onChange={event => setPaymentFilters({ ...paymentFilters, from: event.target.value })} /></label><label>To<input type="date" value={paymentFilters.to} onChange={event => setPaymentFilters({ ...paymentFilters, to: event.target.value })} /></label><button type="button" className="billing-text-button" onClick={() => setPaymentFilters({ method: 'ALL', from: '', to: '' })}>Reset</button></div>{filteredPayments.length === 0 ? <p className="customer-history-empty">No payments match these filters</p> : filteredPayments.map(payment => <div className="customer-payment-row customer-payment-row-wide" key={payment.id}><span>{formatDate(payment.paymentDate)}</span><Link to={`/bills/${payment.billId}`}>{bills.find(bill => bill.id === payment.billId)?.billNumber || 'View bill'}</Link><strong>{money(payment.amount)}</strong><small>{payment.paymentMode}{payment.notes ? ` · ${payment.notes}` : ''}</small></div>)}</section>}
    {activeTab === 'timeline' && <section className="customer-history-section"><div className="customer-history-section-heading"><h2>Activity timeline</h2><span>{timelineEvents.length} of {bills.length + payments.length} events</span></div><div className="customer-history-filters"><label>Event<select value={timelineFilters.type} onChange={event => setTimelineFilters({ ...timelineFilters, type: event.target.value })}><option value="ALL">All activity</option><option value="BILL">Bills</option><option value="PAYMENT">Payments</option></select></label><label>From<input type="date" value={timelineFilters.from} onChange={event => setTimelineFilters({ ...timelineFilters, from: event.target.value })} /></label><label>To<input type="date" value={timelineFilters.to} onChange={event => setTimelineFilters({ ...timelineFilters, to: event.target.value })} /></label><button type="button" className="billing-text-button" onClick={() => setTimelineFilters({ type: 'ALL', from: '', to: '' })}>Reset</button></div>{timelineEvents.length === 0 ? <p className="customer-history-empty">No activity matches these filters</p> : <div className="customer-history-timeline">{timelineEvents.map(event => <div key={event.id}><span><i className={`fas ${event.icon}`}></i></span><div><strong>{event.title}</strong><small>{formatDateTime(event.date)}</small><p>{event.detail}</p></div></div>)}</div>}</section>}
    {editing && <ResponsiveFormModal title="Edit Customer" labelledBy="customer-details-edit-title" onClose={() => setEditing(false)} footer={<><button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={savingCustomer}>Cancel</button><button type="submit" form="customer-details-edit-form" className="btn btn-primary" disabled={savingCustomer}>{savingCustomer ? 'Saving...' : 'Save Changes'}</button></>}><CustomerForm user={user} profile={profile} formId="customer-details-edit-form" showActions={false} editingCustomer={customer} initialValues={customer} onSaved={async () => { setEditing(false); await loadDetails(); showToast({ type: 'success', message: 'Customer updated successfully.' }); }} onCancel={() => setEditing(false)} onBusyChange={setSavingCustomer} /></ResponsiveFormModal>}
    {showPaymentModal && <ResponsiveFormModal title={`Receive payment · ${customer.name}`} labelledBy="customer-payment-title" onClose={() => setShowPaymentModal(false)} footer={<><button type="button" className="btn btn-ghost" onClick={() => setShowPaymentModal(false)} disabled={paymentSaving}>Cancel</button><button type="submit" form="customer-payment-form" className="btn btn-primary" disabled={paymentSaving}>{paymentSaving ? 'Saving...' : 'Save Payment'}</button></>}><form id="customer-payment-form" onSubmit={savePayment}><p className="customer-payment-outstanding">Outstanding: <strong>{money(summary.outstanding)}</strong></p><div className="form-group"><label htmlFor="customer-payment-bill">Bill</label><select id="customer-payment-bill" value={paymentForm.billId} onChange={event => setPaymentForm({ ...paymentForm, billId: event.target.value, amount: '' })}>{outstandingBills.map(bill => <option value={bill.id} key={bill.id}>{bill.billNumber} · Balance {money(getPaymentBalance(bill.finalAmount, bill.paidAmount))}</option>)}</select></div><div className="form-group"><label htmlFor="customer-payment-amount">Amount *</label><input id="customer-payment-amount" type="number" min="0.01" step="0.01" max={selectedBalance} value={paymentForm.amount} onChange={event => setPaymentForm({ ...paymentForm, amount: event.target.value })} autoFocus /></div><div className="form-group"><label htmlFor="customer-payment-mode">Payment method</label><select id="customer-payment-mode" value={paymentForm.paymentMode} onChange={event => setPaymentForm({ ...paymentForm, paymentMode: event.target.value })}><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Other</option></select></div><div className="form-group"><label htmlFor="customer-payment-date">Date</label><input id="customer-payment-date" type="date" value={paymentForm.paymentDate} onChange={event => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} /></div><div className="form-group"><label htmlFor="customer-payment-notes">Notes</label><textarea id="customer-payment-notes" rows="2" value={paymentForm.notes} onChange={event => setPaymentForm({ ...paymentForm, notes: event.target.value })} /></div></form></ResponsiveFormModal>}
  </div>;
}

export default CustomerDetails;
