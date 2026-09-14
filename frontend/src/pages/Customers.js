import React, { useState, useEffect } from 'react';
import { customerAPI, billAPI } from '../utils/firestoreAPI';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatDate } from '../utils/dateFormat';
import { normalizeMobile, isValidMobile, isValidName, isValidDob } from '../utils/validation';

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
  const [formData, setFormData] = useState({ name: '', mobile: '', dob: '', gender: '', address: '', notes: '' });

  useEffect(() => { loadCustomers(); }, []); // eslint-disable-line

  const loadCustomers = async () => { setCustomers(await customerAPI.getAll(user.uid)); };

  const handleSearch = async () => {
    if (!searchQuery) { loadCustomers(); return; }
    setCustomers(await customerAPI.search(user.uid, searchQuery));
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({ name: '', mobile: '', dob: '', gender: '', address: '', notes: '' });
    setShowModal(true);
  };

  const openEditModal = (c) => {
    setEditingCustomer(c);
    setFormData({ name: c.name, mobile: c.mobile, dob: c.dob || '', gender: c.gender || '', address: c.address || '', notes: c.notes || '' });
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

  const handleSubmit = async () => {
    // ---- validation ----
    if (!isValidName(formData.name)) {
      return alert('Please enter a valid name (2–60 characters).');
    }
    if (!formData.mobile || !isValidMobile(formData.mobile)) {
      return alert('Please enter a valid 10-digit mobile number starting with 6-9 (e.g. 9876543210).');
    }
    if (!isValidDob(formData.dob)) {
      return alert('Date of birth cannot be in the future.');
    }
    const payload = { ...formData, mobile: normalizeMobile(formData.mobile) };
    try {
      if (editingCustomer) await customerAPI.update(user.uid, editingCustomer.id, payload);
      else await customerAPI.create(
        user.uid, payload, { customerPrefix: profile?.customerPrefix }
      );
      setShowModal(false);
      loadCustomers();
    } catch (e) {
      console.error('Save customer failed:', e);
      alert(`Error saving customer${e?.message ? ` — ${e.message}` : ''}`);
    }
  };

  const deleteCustomer = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    await customerAPI.delete(user.uid, id);
    loadCustomers();
  };

  const field = (key) => (
    <div className="form-group" key={key}>
      <label>{key === 'dob' ? 'Date of Birth' : key === 'mobile' ? 'Mobile Number' : key.charAt(0).toUpperCase() + key.slice(1)}{['name','mobile'].includes(key) ? ' *' : ''}</label>
      {['address','notes'].includes(key)
        ? <textarea value={formData[key]} onChange={e => setFormData({ ...formData, [key]: e.target.value })} />
        : key === 'mobile'
        ? <input type="tel" inputMode="numeric" maxLength={12} placeholder="10-digit mobile"
            value={formData[key]} onChange={e => setFormData({ ...formData, [key]: e.target.value.replace(/[^0-9+ ]/g, '') })} />
        : key === 'dob'
        ? <input type="date" max={new Date().toISOString().slice(0, 10)}
            value={formData[key]} onChange={e => setFormData({ ...formData, [key]: e.target.value })} />
        : <input type="text" maxLength={60} value={formData[key]} onChange={e => setFormData({ ...formData, [key]: e.target.value })} />}
    </div>
  );

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

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            {['name', 'mobile', 'address', 'notes'].map(field)}
            <div className="form-group">
              <label>Date of Birth</label>
              <input type="date" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                <option value="">Select</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editingCustomer ? 'Update' : 'Add'} Customer
            </button>
          </div>
        </div>
      )}

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
