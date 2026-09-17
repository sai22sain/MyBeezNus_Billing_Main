import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { customerAPI, billAPI } from '../utils/firestoreAPI';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatDate } from '../utils/dateFormat';
import { showToast, showConfirmation } from '../services/notificationService';
import CustomerForm from '../components/CustomerForm';
import ResponsiveFormModal from '../components/ui/ResponsiveFormModal';
import { openWhatsApp } from '../utils/whatsapp';
import { isValidEmail, isValidMobile } from '../utils/validation';
import { openGmailCompose } from '../services/gmailComposeService';

function Customers() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
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
  const [receivables, setReceivables] = useState({});
  const [openMenuId, setOpenMenuId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  useEffect(() => { loadCustomers(); }, []); // eslint-disable-line

  useEffect(() => {
    const closeMenu = event => {
      if (event.key === 'Escape') setOpenMenuId(null);
      if (event.type === 'mousedown' && menuRef.current && !menuRef.current.contains(event.target)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeMenu);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeMenu);
    };
  }, []);

  useLayoutEffect(() => {
    if (!openMenuId || !menuRef.current) {
      setMenuStyle(null);
      return undefined;
    }

    const positionMenu = () => {
      const menu = menuRef.current.querySelector('.customer-action-menu');
      if (!menu) return;
      const trigger = menuRef.current.querySelector('.customer-menu-trigger');
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const margin = 12;
      const bottomNav = document.querySelector('.bottom-nav');
      const bottomBoundary = bottomNav?.getBoundingClientRect().top || window.innerHeight;
      const availableHeight = Math.max(120, bottomBoundary - margin * 2);
      const top = Math.min(
        Math.max(margin, triggerRect.bottom + 4),
        Math.max(margin, bottomBoundary - menuRect.height - margin),
      );
      const left = Math.min(
        Math.max(margin, triggerRect.right - menuRect.width),
        Math.max(margin, window.innerWidth - menuRect.width - margin),
      );
      setMenuStyle({ position: 'fixed', top, left, right: 'auto', maxHeight: availableHeight });
    };

    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [openMenuId]);

  const loadCustomers = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [customerRows, receivableRows] = await Promise.all([customerAPI.getAll(user.uid), customerAPI.getReceivables(user.uid)]);
      setCustomers(customerRows);
      setReceivables(receivableRows);
    } catch (error) {
      console.error('Load customers failed:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      if (!searchQuery) { loadCustomers(); return; }
      setCustomers(await customerAPI.search(user.uid, searchQuery));
    } catch (error) {
      console.error('Search customers failed:', error);
      setLoadError(true);
    }
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
    setOpenMenuId(null);
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

  const openCustomer = customer => navigate(`/customers/${customer.id}`);

  const openNewBill = (event, customer) => {
    event.stopPropagation();
    setOpenMenuId(null);
    navigate('/new-bill', { state: { customer } });
  };

  const openReceivePayment = (event, customer) => {
    event.stopPropagation();
    setOpenMenuId(null);
    navigate(`/customers/${customer.id}`, { state: { openPayment: true } });
  };

  const shareWhatsApp = (event, customer) => {
    event.stopPropagation();
    setOpenMenuId(null);
    if (!isValidMobile(customer.mobile)) return showToast({ type: 'warning', message: "This customer doesn't have a valid WhatsApp number." });
    const opened = openWhatsApp(customer.mobile, `Hello ${customer.name},\n\nThank you for your business.\n\nMyBeezNus Billing`);
    if (opened) showToast({ type: 'info', message: 'WhatsApp opened with the customer message ready to send.' });
    else showToast({ type: 'warning', message: "WhatsApp isn't available on this device." });
  };

  const composeEmail = (event, customer) => {
    event.stopPropagation();
    setOpenMenuId(null);
    if (!customer.email) return showToast({ type: 'warning', message: "This customer doesn't have an email address." });
    if (!isValidEmail(customer.email)) return showToast({ type: 'warning', message: 'This customer has an invalid email address.' });
    if (openGmailCompose({ to: customer.email, subject: `Hello from ${profile?.businessName || 'MyBeezNus Billing'}`, body: `Hello ${customer.name},\n\nThank you for being our customer.` })) {
      showToast({ type: 'info', message: 'Gmail opened with the customer details ready to send.' });
    }
  };

  const renderLoadingRows = () => [1, 2, 3].map(row => <div className="customer-directory-skeleton" key={row}><span></span><span></span><span></span><span></span><span></span></div>);

  return (
    <div className="customers-page">
      <div className="page-header customers-page-header">
        <div><h1>Customers</h1><p>Manage customers and track outstanding payments.</p></div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <i className="fas fa-user-plus"></i> Add Customer
        </button>
      </div>

      <div className="search-box customers-search-box">
        <input type="text" placeholder="Search by name or mobile..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} onKeyUp={handleSearch} />
      </div>

      <div className="customer-directory" role="table" aria-label="Customers">
        <div className="customer-directory-header" role="row"><span role="columnheader">Customer</span><span role="columnheader">Contact</span><span role="columnheader">Outstanding</span><span role="columnheader">Gender</span><span role="columnheader">Actions</span></div>
        {loading ? renderLoadingRows() : loadError ? <div className="customer-directory-state"><i className="fas fa-triangle-exclamation"></i><strong>Unable to load customers.</strong><button className="btn btn-ghost" onClick={loadCustomers}>Retry</button></div> : customers.length === 0 ? <div className="customer-directory-state"><i className="fas fa-users"></i><strong>{searchQuery ? 'No customers found' : 'No customers yet'}</strong><span>{searchQuery ? 'Try another name or mobile number.' : 'Add your first customer to start keeping track of bills and customer history.'}</span>{!searchQuery && <button className="btn btn-primary" onClick={openAddModal}><i className="fas fa-user-plus"></i> Add Customer</button>}</div> : customers.map(c => {
          const balance = receivables[c.id]?.totalOutstanding || 0;
          const overdue = receivables[c.id]?.overdueOutstanding || 0;
          return <div key={c.id} className="customer-directory-row" role="row" tabIndex="0" onClick={() => openCustomer(c)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCustomer(c); } }}>
            <div role="cell" className="customer-directory-primary"><Link className="customer-name" to={`/customers/${c.id}`} onClick={event => event.stopPropagation()}>{c.name}</Link><span className="customer-id">{c.customerId}</span></div>
            <div role="cell" className="customer-directory-contact"><strong>{c.mobile}</strong>{c.email && <span>{c.email}</span>}{c.dob && <span>DOB: {formatDate(c.dob)}</span>}</div>
            <div role="cell" className={`customer-directory-balance ${balance > 0 ? 'has-balance' : ''}`}><strong>₹{balance.toFixed(2)}</strong>{overdue > 0 && <span>₹{overdue.toFixed(2)} overdue</span>}</div>
            <div role="cell" className="customer-directory-gender">{c.gender || '—'}</div>
            <div role="cell" className="customer-directory-actions" ref={openMenuId === c.id ? menuRef : null}><button type="button" className="customer-menu-trigger" aria-label={`Actions for ${c.name}`} aria-expanded={openMenuId === c.id} title="Customer actions" onClick={event => { event.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id); }}><i className="fas fa-ellipsis-vertical"></i></button>{openMenuId === c.id && <div className="customer-action-menu" role="menu" style={menuStyle || undefined}><button role="menuitem" onClick={event => { event.stopPropagation(); setOpenMenuId(null); openCustomer(c); }}><i className="fas fa-user"></i> View Customer</button><button role="menuitem" onClick={event => { event.stopPropagation(); openHistoryModal(c); }}><i className="fas fa-history"></i> Visit History</button><button role="menuitem" onClick={event => openNewBill(event, c)}><i className="fas fa-plus"></i> New Bill</button><button role="menuitem" onClick={event => openReceivePayment(event, c)}><i className="fas fa-hand-holding-usd"></i> Receive Payment</button><button role="menuitem" onClick={event => { event.stopPropagation(); setOpenMenuId(null); openEditModal(c); }}><i className="fas fa-edit"></i> Edit Customer</button><button role="menuitem" onClick={event => shareWhatsApp(event, c)}><i className="fab fa-whatsapp"></i> WhatsApp</button><button role="menuitem" onClick={event => composeEmail(event, c)}><i className="fas fa-envelope"></i> Email</button><button role="menuitem" className="is-danger" onClick={event => { event.stopPropagation(); deleteCustomer(c.id); }}> <i className="fas fa-trash"></i> Delete Customer</button></div>}</div>
          </div>;
        })}
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
