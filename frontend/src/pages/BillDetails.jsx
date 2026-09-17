import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { billAPI, customerAPI } from '../utils/firestoreAPI';
import { useAuth } from '../context/AuthContext';
import { showConfirmation, showToast } from '../services/notificationService';
import { buildBillMessage, openWhatsApp } from '../utils/whatsapp';
import { isValidMobile } from '../utils/validation';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import { getPaymentBalance } from '../utils/paymentStatus';
import { buildInvoiceEmailBody, buildInvoiceEmailSubject, openGmailCompose } from '../services/gmailComposeService';
import { isValidEmail } from '../utils/validation';
import BillDocument from '../components/billing/BillDocument';
import { downloadBillPdf } from '../services/billPdfService';
import { normalizeInvoiceAccent, normalizeInvoiceTemplate } from '../components/billing/invoiceTemplates';

const money = value => `₹${Number(value || 0).toFixed(2)}`;

function BillDetails() {
  const { user, profile } = useAuth();
  const { billId } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMode: 'Cash', paymentDate: new Date().toLocaleDateString('en-CA'), notes: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const billDocumentRef = useRef(null);

  const loadBill = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const nextBill = await billAPI.getById(user.uid, billId);
      setBill(nextBill);
      setPayments(nextBill ? await billAPI.getPayments(user.uid, billId) : []);
      if (nextBill?.customerId) {
        try {
          setCustomer(await customerAPI.getById(user.uid, nextBill.customerId));
        } catch {
          setCustomer(null);
        }
      } else {
        setCustomer(null);
      }
    } catch (error) {
      console.error('Load bill failed:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const composeEmail = () => {
    if (!customer?.email) {
      showToast({ type: 'warning', message: 'This customer doesn\'t have an email address.' });
      return;
    }
    if (!isValidEmail(customer.email)) {
      showToast({ type: 'warning', message: 'This customer has an invalid email address. Please update the customer details.' });
      return;
    }
    const opened = openGmailCompose({
      to: customer.email,
      subject: buildInvoiceEmailSubject(bill),
      body: buildInvoiceEmailBody(bill, customer),
    });
    if (opened) showToast({ type: 'info', message: 'Gmail opened with the bill details.' });
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

  const printBill = () => window.print();

  const generatePdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      await downloadBillPdf(billDocumentRef.current, bill.billNumber);
      showToast({ type: 'success', message: 'Bill PDF downloaded successfully.' });
    } catch (error) {
      console.error('Generate bill PDF failed:', error);
      showToast({ type: 'error', message: 'Unable to generate the PDF. Please try again.' });
    } finally {
      setPdfLoading(false);
    }
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

  const openPaymentModal = () => {
    setPaymentForm({ amount: '', paymentMode: bill.paymentMode || 'Cash', paymentDate: new Date().toLocaleDateString('en-CA'), notes: '' });
    setShowPaymentModal(true);
  };

  const savePayment = async (event) => {
    event.preventDefault();
    const amount = Number(paymentForm.amount);
    const balance = getPaymentBalance(bill.finalAmount, payments.reduce((sum, payment) => sum + payment.amount, 0));
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      showToast({ type: 'warning', message: `Payment must be greater than zero and no more than ${money(balance)}.` });
      return;
    }
    setPaymentSaving(true);
    try {
      await billAPI.recordPayment(user.uid, bill.id, { ...paymentForm, amount });
      setShowPaymentModal(false);
      await loadBill();
      showToast({ type: 'success', message: 'Payment recorded successfully.' });
    } catch (error) {
      showToast({ type: 'error', message: error?.message?.includes('outstanding') ? 'Payment exceeds the outstanding balance.' : 'Unable to record the payment.' });
    } finally {
      setPaymentSaving(false);
    }
  };

  if (loading) return null;
  if (loadError || !bill) return <div className="bill-detail-state"><i className="fas fa-receipt"></i><h2>Unable to load this bill.</h2><button className="btn btn-primary" onClick={loadBill}>Retry</button></div>;

  const transactionPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const paymentBalance = getPaymentBalance(bill.finalAmount, transactionPaid || bill.paidAmount);
  const invoiceProfile = {
    ...profile,
    invoiceTemplate: normalizeInvoiceTemplate(profile?.invoiceTemplate),
    invoiceAccentColor: normalizeInvoiceAccent(profile?.invoiceAccentColor),
  };
  const actions = [
    { label: 'Edit', icon: 'fa-edit', onClick: () => navigate('/bills', { state: { editBillId: bill.id } }) },
    { label: 'WhatsApp', icon: 'fa-whatsapp', brand: true, onClick: shareWhatsApp },
    { label: 'Mail', icon: 'fa-envelope', onClick: composeEmail },
    { label: 'Print', icon: 'fa-print', onClick: printBill },
    { label: pdfLoading ? 'Generating...' : 'PDF', icon: pdfLoading ? 'fa-spinner fa-spin' : 'fa-file-pdf', disabled: pdfLoading, onClick: generatePdf },
  ];

  return (
    <div className="bill-detail-page">
      <div className="bill-detail-header">
        <div className="bill-detail-heading">
          <Link className="bill-back-link" to="/bills"><i className="fas fa-arrow-left"></i> Bills</Link>
          <div className="bill-detail-title-row"><h1>{bill.billNumber}</h1><PaymentStatusBadge totalAmount={bill.finalAmount} paidAmount={bill.paidAmount} dueDate={bill.dueDate} /></div>
          <p>{bill.customerName || 'Customer-less bill'}{bill.customerMobile ? ` · ${bill.customerMobile}` : ''}</p>
        </div>
        <div className="bill-detail-actions">
          {actions.map(action => <button key={action.label} className={`btn ${action.disabled ? 'btn-ghost bill-action-disabled' : 'btn-ghost'}`} onClick={action.onClick} disabled={action.disabled} title={action.label}><i className={`${action.brand ? 'fab' : 'fas'} ${action.icon}`}></i><span>{action.label}</span></button>)}
          <button className="btn btn-ghost bill-delete-action" onClick={deleteBill} title="Delete bill"><i className="fas fa-trash"></i><span>Delete</span></button>
        </div>
      </div>

      <div className="bill-detail-layout">
        <BillDocument bill={bill} customer={customer} profile={invoiceProfile} />

        <aside className="bill-supporting-info">
          <section className="bill-info-section"><div className="bill-info-section-heading"><i className="fas fa-user"></i><h2>Customer</h2></div><strong>{bill.customerName || 'Customer-less bill'}</strong>{bill.customerMobile ? <span>{bill.customerMobile}</span> : <span>No mobile number recorded</span>}{customer?.email && <span>{customer.email}</span>}{bill.customerId && <Link to={`/customers?customer=${bill.customerId}`} className="bill-text-link">View customer</Link>}</section>
          <section className="bill-info-section"><div className="bill-info-section-heading"><i className="fas fa-wallet"></i><h2>Payment summary</h2></div><PaymentStatusBadge totalAmount={bill.finalAmount} paidAmount={transactionPaid || bill.paidAmount} dueDate={bill.dueDate} /><div className="bill-summary-line"><span>Total</span><strong>{money(bill.finalAmount)}</strong></div><div className="bill-summary-line"><span>Paid</span><strong>{money(transactionPaid || bill.paidAmount)}</strong></div><div className="bill-summary-line"><span>Balance</span><strong>{money(paymentBalance)}</strong></div><div className="bill-summary-line"><span>Payment method</span><strong>{bill.paymentMode || 'Not specified'}</strong></div><button className="btn btn-primary" onClick={openPaymentModal} disabled={paymentBalance <= 0}><i className="fas fa-hand-holding-usd"></i> Receive payment</button>{payments.length > 0 && <div className="bill-payment-history"><strong>Payment history</strong>{payments.map(payment => <div className="bill-summary-line" key={payment.id}><span>{payment.paymentDate} · {payment.paymentMode}</span><strong>{money(payment.amount)}</strong></div>)}</div>}</section>
          <section className="bill-info-section bill-next-actions"><div className="bill-info-section-heading"><i className="fas fa-bolt"></i><h2>Actions</h2></div><button className="btn btn-primary" onClick={shareWhatsApp}><i className="fab fa-whatsapp"></i> Share via WhatsApp</button><button className="btn btn-ghost" onClick={() => navigate('/bills', { state: { editBillId: bill.id } })}><i className="fas fa-edit"></i> Edit bill</button></section>
        </aside>
      </div>
      <div className="bill-print-host" ref={billDocumentRef} aria-hidden="true">
        <BillDocument bill={bill} customer={customer} profile={invoiceProfile} />
      </div>
      {showPaymentModal && <div className="modal"><div className="modal-content" style={{ maxWidth: 460 }}><div className="modal-header"><h2>Receive payment</h2><button className="close-btn" onClick={() => setShowPaymentModal(false)} disabled={paymentSaving}>×</button></div><form onSubmit={savePayment}><div className="form-group"><label>Amount *</label><input type="number" min="0.01" step="0.01" max={paymentBalance} value={paymentForm.amount} onChange={event => setPaymentForm({ ...paymentForm, amount: event.target.value })} autoFocus /></div><div className="form-group"><label>Payment method</label><select value={paymentForm.paymentMode} onChange={event => setPaymentForm({ ...paymentForm, paymentMode: event.target.value })}><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Other</option></select></div><div className="form-group"><label>Payment date</label><input type="date" value={paymentForm.paymentDate} onChange={event => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} /></div><div className="form-group"><label>Notes</label><textarea rows="2" value={paymentForm.notes} onChange={event => setPaymentForm({ ...paymentForm, notes: event.target.value })} /></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="btn btn-ghost" onClick={() => setShowPaymentModal(false)} disabled={paymentSaving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={paymentSaving}><i className={`fas ${paymentSaving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i> {paymentSaving ? 'Saving...' : 'Record payment'}</button></div></form></div></div>}
    </div>
  );
}

export default BillDetails;