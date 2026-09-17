import React, { useEffect, useState } from 'react';
import { customerAPI } from '../utils/firestoreAPI';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import ResponsiveFormModal from './ui/ResponsiveFormModal';
import CustomerForm from './CustomerForm';

const EMPTY_SUMMARY = { totalBills: 0, totalSpent: 0, recentBills: [] };

function CustomerContextPanel({ user, profile, customer, refreshKey, onCustomerUpdated }) {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const customerId = customer?.id;

  useEffect(() => {
    let active = true;
    if (!customerId) {
      setSummary(EMPTY_SUMMARY);
      setExpanded(false);
      return undefined;
    }
    setLoading(true);
    setError(false);
    customerAPI.getSummary(user.uid, customerId)
      .then(nextSummary => { if (active) setSummary(nextSummary); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.uid, customerId, refreshKey]);

  if (!customer) return null;

  const initials = customer.name?.trim()?.charAt(0)?.toUpperCase() || '?';
  const reloadSummary = () => {
    setError(false);
    setLoading(true);
    customerAPI.getSummary(user.uid, customerId)
      .then(setSummary)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <aside className={`customer-context-panel${expanded ? ' is-expanded' : ''}`} aria-label="Customer context">
        <div className="customer-context-header">
          <div className="customer-context-avatar" aria-hidden="true">{initials}</div>
          <div className="customer-context-identity"><span className="billing-eyebrow">Customer context</span><strong>{customer.name}</strong><small>{customer.mobile || 'No mobile number'}</small></div>
          <button type="button" className="customer-context-close" aria-label="Collapse customer context" onClick={() => setExpanded(false)}><i className="fas fa-chevron-right"></i></button>
        </div>
        <div className="customer-context-actions"><button type="button" className="billing-text-button" onClick={() => setEditing(true)}><i className="fas fa-pen"></i> Edit customer</button><button type="button" className="billing-text-button" onClick={() => setExpanded(false)}>Close</button></div>
        <div className="customer-context-content">
          <div className="customer-context-section"><span className="customer-context-section-title">Quick overview</span><div className="customer-context-stats"><div><strong>{summary.totalBills}</strong><small>Total bills</small></div><div><strong>{summary.recentBills[0] ? formatDate(summary.recentBills[0].createdAt) : '—'}</strong><small>Last bill</small></div></div></div>
          {loading && <div className="customer-context-loading"><i className="fas fa-circle-notch fa-spin"></i> Loading bill history...</div>}
          {error && <div className="customer-context-error">Customer details couldn&apos;t be loaded. <button type="button" onClick={reloadSummary}>Retry</button></div>}
          {!loading && !error && <div className="customer-context-section"><span className="customer-context-section-title">Activity timeline</span><div className="customer-context-timeline"><div className="customer-context-event"><span className="customer-context-event-dot"><i className="fas fa-user-plus"></i></span><div><strong>Customer added</strong><small>{customer.createdAt ? formatDateTime(customer.createdAt) : 'Date unavailable'}</small></div></div>{summary.recentBills.map(bill => <div className="customer-context-event" key={bill.id}><span className="customer-context-event-dot"><i className="fas fa-receipt"></i></span><div><strong>Bill {bill.billNumber}</strong><small>{formatDateTime(bill.createdAt)} · ₹{bill.finalAmount.toFixed(2)}</small></div></div>)}</div>{summary.recentBills.length === 0 && <p className="customer-context-empty">No bills recorded yet</p>}</div>}
          {(customer.dob || customer.gender || customer.customerType || customer.address || customer.notes) && <div className="customer-context-section"><span className="customer-context-section-title">Customer details</span>{customer.customerType && <p><strong>Customer type</strong><span>{customer.customerType}</span></p>}{customer.dob && <p><strong>Date of birth</strong><span>{formatDate(customer.dob)}</span></p>}{customer.gender && <p><strong>Gender</strong><span>{customer.gender}</span></p>}{customer.address && <div className="customer-context-detail-block"><strong>Address</strong><span>{customer.address}</span></div>}{customer.notes && <div className="customer-context-detail-block"><strong>Notes</strong><span>{customer.notes}</span></div>}</div>}
        </div>
      </aside>
      <button type="button" className={`customer-context-collapsed${expanded ? ' is-hidden' : ''}`} aria-label={`Open details for ${customer.name}`} onClick={() => setExpanded(true)}><span className="customer-context-avatar" aria-hidden="true">{initials}</span><span><strong>{customer.name}</strong><small>{customer.mobile || 'Customer selected'}</small></span><i className="fas fa-chevron-left"></i></button>
      {editing && <ResponsiveFormModal title="Edit Customer" labelledBy="billing-edit-customer-title" onClose={() => setEditing(false)} footer={<><button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</button><button type="submit" form="billing-edit-customer-form" className="btn btn-primary" disabled={saving}><i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i> {saving ? 'Saving...' : 'Save Changes'}</button></>}><CustomerForm user={user} profile={profile} formId="billing-edit-customer-form" showActions={false} editingCustomer={customer} initialValues={customer} onSaved={updated => { setEditing(false); onCustomerUpdated(updated); }} onCancel={() => setEditing(false)} onBusyChange={setSaving} /></ResponsiveFormModal>}
    </>
  );
}

export default CustomerContextPanel;