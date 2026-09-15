import React, { useState, useEffect } from 'react';
import { customerAPI, billAPI } from '../utils/firestoreAPI';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatDate } from '../utils/dateFormat';
import { showToast, showConfirmation } from '../services/notificationService';
import CustomerForm from '../components/CustomerForm';
import ResponsiveFormModal from '../components/ui/ResponsiveFormModal';

function Customers() {
  const { user, profile } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showBillDetailModal, setShowBillDetailModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [customerSaving, setCustomerSaving] = useState(false);

  useEffect(() => { loadCustomers(); }, []); // eslint-disable-line

  const loadCustomers = async () => { setCustomers(await customerAPI.getAll(user.uid)); };

  const handleSearch = async () => {
    if (!searchQuery) { loadCustomers(); return; }
    setCustomers(await customerAPI.search(user.uid, searchQuery));
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setShowModal(true);
  };

  const openEditModal = (c) => {
    setEditingCustomer(c);
    setShowModal(true);
  };

  const openHistoryModal = async (c) => {
    setSelectedCustomer(c);
    setCustomerHistory(await customerAPI.getHistory(user.uid, c.id));
    setShowHistoryModal(true);
  };

  const openBillFromHistory = async (billId) => {
    setSelectedBill(await billAPI.getById(user.uid, billId));
    setShowHistoryModal(false);
    setShowBillDetailModal(true);
  };

  const handleCustomerSaved = () => {
    setShowModal(false);
    loadCustomers();
    showToast({ type: 'success', message: editingCustomer ? 'Customer updated successfully.' : 'Customer added successfully.' });
  };

  const deleteCustomer = async (id) => {
    await showConfirmation({
      title: 'Delete this customer?',
      message: 'The customer and associated record will be permanently removed.',
      confirmText: 'Delete Customer',
      destructive: true,
      onConfirm: async () => {
        try {
          await customerAPI.delete(user.uid, id);
          loadCustomers();
          showToast({ type: 'success', message: 'Customer deleted successfully.' });
        } catch {
          showToast({ type: 'error', message: 'Unable to delete the customer. Please try again.' });
        }
      },
    });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Customers</h1>
        <button className="btn btn-primary" onClick={openAddModal}>
          <i className="fas fa-user-plus"></i> Add Customer
        </button>
      </div>

      <div className="search-box">
        <input type="text" placeholder="Search by name or mobile..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} onKeyUp={handleSearch} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr auto', gap: 16 }}>
          {['Customer', 'Contact', 'Gender', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)' }}>{h}</span>
          ))}
        </div>

        {customers.length === 0 ? (
          <div className="empty-state"><i className="fas fa-users"></i><p>No customers found</p></div>
        ) : customers.map(c => (
          <div key={c.id} className="customer-row">
            <div>
              <div className="customer-name">{c.name}</div>
              <div className="customer-id">{c.customerId}</div>
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{c.mobile}</div>
              {c.dob && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>DOB: {formatDate(c.dob)}</div>}
            </div>
            <div>
              {c.gender ? <span className="badge badge-primary">{c.gender}</span> : <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>—</span>}
            </div>
            <div className="row-actions">
              <button className="btn btn-ghost" onClick={() => openEditModal(c)} title="Edit"><i className="fas fa-edit"></i></button>
              <button className="btn btn-ghost" onClick={() => openHistoryModal(c)} title="History" style={{ color: '#6366f1' }}><i className="fas fa-history"></i></button>
              <button className="btn btn-ghost" onClick={() => deleteCustomer(c.id)} title="Delete" style={{ color: 'var(--color-danger)' }}><i className="fas fa-trash"></i></button>
            </div>
          </div>
        ))}
      </div>

      {showModal && <ResponsiveFormModal title={editingCustomer ? 'Edit Customer' : 'Add Customer'} labelledBy="customer-form-title" onClose={() => setShowModal(false)} footer={<><button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={customerSaving}>Cancel</button><button type="submit" form="customer-form" className="btn btn-primary" disabled={customerSaving}><i className={`fas ${customerSaving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i> {customerSaving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Add Customer'}</button></>}>
        <CustomerForm user={user} profile={profile} formId="customer-form" showActions={false} editingCustomer={editingCustomer} initialValues={editingCustomer || undefined} onSaved={handleCustomerSaved} onCancel={() => setShowModal(false)} onBusyChange={setCustomerSaving} />
      </ResponsiveFormModal>}

      {showHistoryModal && selectedCustomer && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <h2>Visit History — {selectedCustomer.name}</h2>
              <button className="close-btn" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            {customerHistory.length === 0 ? (
              <div className="empty-state"><i className="fas fa-history"></i><p>No visit history yet</p></div>
            ) : customerHistory.map(bill => (
              <div key={bill.id} onClick={() => openBillFromHistory(bill.id)}
                style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 10, cursor: 'pointer', transition: 'all 0.15s', background: 'white' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.transform = 'none'; }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{bill.billNumber}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{formatDateTime(bill.createdAt)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>₹{bill.finalAmount?.toFixed(2)}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{bill.paymentMode}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showBillDetailModal && selectedBill && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <h2>Bill — {selectedBill.billNumber}</h2>
              <button className="close-btn" onClick={() => { setShowBillDetailModal(false); setShowHistoryModal(true); }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#f8fafc', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20, fontSize: 13 }}>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Customer: </span><strong>{selectedBill.customerName}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Mobile: </span><strong>{selectedBill.customerMobile}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Date: </span><strong>{formatDateTime(selectedBill.createdAt)}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Payment: </span><strong>{selectedBill.paymentMode}</strong></div>
            </div>
            <table>
              <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead>
              <tbody>
                {(selectedBill.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td>₹{item.price?.toFixed(2)}</td>
                    <td>{item.quantity}</td>
                    <td>₹{(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: '2px solid var(--color-border)', paddingTop: 14, marginTop: 14, textAlign: 'right', fontSize: 13 }}>
              <div style={{ marginBottom: 4 }}>Subtotal: <strong>₹{selectedBill.totalAmount?.toFixed(2)}</strong></div>
              <div style={{ marginBottom: 4 }}>Tax: <strong>₹{selectedBill.tax?.toFixed(2)}</strong></div>
              {selectedBill.discount > 0 && <div style={{ marginBottom: 4 }}>Discount: <strong>-₹{selectedBill.discount?.toFixed(2)}</strong></div>}
              <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 8 }}>Total: ₹{selectedBill.finalAmount?.toFixed(2)}</div>
            </div>
            <button className="btn btn-ghost" style={{ marginTop: 16 }}
              onClick={() => { setShowBillDetailModal(false); setShowHistoryModal(true); }}>
              <i className="fas fa-arrow-left"></i> Back to History
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;
