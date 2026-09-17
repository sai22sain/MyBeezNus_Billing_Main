import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { billAPI, itemAPI, cacheKeys } from '../utils/firestoreAPI';
import { useCachedQuery } from '../hooks/useCachedQuery';
import { CACHE_TTL } from '../utils/core/cache';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/dateFormat';
import { showToast, showConfirmation } from '../services/notificationService';
import { buildBillMessage, openWhatsApp } from '../utils/whatsapp';
import { isValidMobile } from '../utils/validation';

function Bills() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [bills, setBills] = useState([]);
  // Active items shared with Items/NewBill via the per-user cache.
  const { data: allItems } = useCachedQuery(
    user?.uid, cacheKeys.activeItems, CACHE_TTL.activeItems,
    () => itemAPI.getActive(user.uid)
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [billItems, setBillItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterMode, setFilterMode] = useState('today');

  useEffect(() => { loadBills(); }, []); // eslint-disable-line

  useEffect(() => {
    const editBillId = location.state?.editBillId;
    if (!editBillId || !bills.length) return;
    const bill = bills.find(item => item.id === editBillId);
    if (bill) openEditModal(bill);
    navigate('/bills', { replace: true, state: {} });
  }, [bills, location.state, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBills = async () => { setBills(await billAPI.getAll(user.uid)); };

  const openEditModal = async (bill) => {
    const data = await billAPI.getById(user.uid, bill.id);
    setEditingBill(data);
    setBillItems(data.items || []);
    setDiscount(data.discount || 0);
    setPaymentMode(data.paymentMode || 'Cash');
    setShowEditModal(true);
  };

  const updateQuantity = (idx, qty) => {
    if (qty <= 0) setBillItems(billItems.filter((_, i) => i !== idx));
    else setBillItems(billItems.map((bi, i) => i === idx ? { ...bi, quantity: qty } : bi));
  };

  const addItemToBill = (item) => {
    const ex = billItems.findIndex(bi => bi.itemId === item.id);
    if (ex >= 0) setBillItems(billItems.map((bi, i) => i === ex ? { ...bi, quantity: bi.quantity + 1 } : bi));
    else setBillItems([...billItems, { itemId: item.id, name: item.name, price: item.price, tax: item.tax || 0, quantity: 1 }]);
  };

  const calculateTotals = () => {
    let subtotal = 0, tax = 0;
    billItems.forEach(item => {
      const t = item.price * item.quantity;
      subtotal += t;
      tax += (t * (item.tax || 0)) / 100;
    });
    return { subtotal, tax, finalTotal: subtotal + tax - discount };
  };

  const updateBill = async () => {
    try {
      const totals = calculateTotals();
      await billAPI.update(user.uid, editingBill.id, {
        items: billItems, discount, paymentMode,
        totalAmount: totals.subtotal, tax: totals.tax, finalAmount: totals.finalTotal
      });
      setShowEditModal(false);
      loadBills();
      showToast({ type: 'success', message: 'Bill updated successfully.' });
    } catch {
      showToast({ type: 'error', message: 'Unable to update the bill. Please try again.' });
    }
  };

  const deleteBill = async (id) => {
    await showConfirmation({
      title: 'Delete this bill?',
      message: 'This bill will be permanently removed. This action cannot be undone.',
      confirmText: 'Delete Bill',
      destructive: true,
      onConfirm: async () => {
        try {
          await billAPI.delete(user.uid, id);
          loadBills();
          showToast({ type: 'success', message: 'Bill deleted successfully.' });
        } catch {
          showToast({ type: 'error', message: 'Unable to delete the bill. Please try again.' });
        }
      },
    });
  };

  const resendWhatsApp = (bill) => {
    if (!isValidMobile(bill.customerMobile)) {
      return showToast({ type: 'warning', message: "This customer doesn't have a valid WhatsApp number." });
    }
    const msg = buildBillMessage({ billNumber: bill.billNumber, customerName: bill.customerName, total: bill.finalAmount, paymentMode: bill.paymentMode, items: bill.items });
    if (openWhatsApp(bill.customerMobile, msg)) showToast({ type: 'info', message: 'WhatsApp opened with the bill ready to send.' });
    else showToast({ type: 'warning', message: "WhatsApp isn't available on this device." });
  };

  const filteredBills = bills.filter(bill => {
    const billDate = bill.createdAt?.split('T')[0];
    const today = new Date().toLocaleDateString('en-CA');
    let dateMatch =
      filterMode === 'today' ? billDate === today :
      filterMode === 'date' ? billDate === selectedDate :
      (startDate && endDate ? billDate >= startDate && billDate <= endDate : true);
    const searchMatch = !searchQuery ||
      bill.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.customerMobile?.includes(searchQuery);
    return dateMatch && searchMatch;
  });

  const totals = calculateTotals();

  return (
    <div className="bills-page">
      <header className="bills-header">
        <div>
          <span className="bills-eyebrow"><i className="fas fa-receipt"></i> Billing history</span>
          <h1>Bills</h1>
          <p>Manage and review your billing history.</p>
        </div>
        <button className="btn btn-primary bills-new-button" onClick={() => navigate('/new-bill')}>
          <i className="fas fa-plus"></i> New Bill
        </button>
      </header>

      <section className="bills-toolbar" aria-label="Bill filters">
        <div className="bills-filter-group" role="group" aria-label="Date filter">
          {['today', 'date', 'range'].map(mode => (
            <button key={mode} className={`bills-filter-button ${filterMode === mode ? 'is-active' : ''}`}
              onClick={() => setFilterMode(mode)}>
              {mode === 'today' ? 'Today' : mode === 'date' ? 'By Date' : 'Date Range'}
            </button>
          ))}
          {filterMode === 'date' && (
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          )}
          {filterMode === 'range' && (
            <>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="bills-date-separator">to</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </>
          )}
        </div>

        <label className="bills-search">
          <i className="fas fa-search" aria-hidden="true"></i>
          <span className="sr-only">Search bills</span>
          <input type="text" placeholder="Search bill number, customer name or mobile..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </label>
      </section>

      <section className="bills-list" aria-label="Bills list">
        <div className="bills-list-header" aria-hidden="true">
          <span>Bill</span>
          <span>Customer</span>
          <span>Amount</span>
          <span>Actions</span>
        </div>

        {filteredBills.length === 0 ? (
          <div className="bills-empty-state">
            <span className="bills-empty-icon"><i className="fas fa-receipt"></i></span>
            <strong>{bills.length === 0 ? 'No bills yet' : 'No bills found'}</strong>
            <p>{bills.length === 0 ? 'Create your first bill to start tracking your sales.' : 'Try adjusting your filters or search phrase.'}</p>
            {bills.length === 0 && <button className="btn btn-primary" onClick={() => navigate('/new-bill')}><i className="fas fa-plus"></i> Create New Bill</button>}
          </div>
        ) : filteredBills.map(bill => (
          <div key={bill.id} className="bill-row bills-row" onClick={() => navigate(`/bills/${bill.id}`)} role="button" tabIndex={0}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') navigate(`/bills/${bill.id}`); }}>
            <div>
              <div className="bill-number">{bill.billNumber}</div>
              <div className="bill-date">{formatDateTime(bill.createdAt)}</div>
            </div>
            <div>
              <div className="bill-customer-name">{bill.customerName || 'Walk-in Customer'}</div>
              <div className="bill-customer-mobile">{bill.customerMobile || 'No mobile number'}</div>
            </div>
            <div>
              <div className="bill-amount">₹{bill.finalAmount?.toFixed(2)}</div>
              <div className="bill-payment">{bill.paymentMode}</div>
            </div>
            <div className="row-actions bills-row-actions">
              <button className="btn btn-ghost bills-action-button" onClick={event => { event.stopPropagation(); openEditModal(bill); }} title="Edit bill" aria-label={`Edit ${bill.billNumber}`}>
                <i className="fas fa-edit"></i>
              </button>
              <button className="btn btn-ghost bills-action-button bills-whatsapp-button" onClick={event => { event.stopPropagation(); resendWhatsApp(bill); }} title="Send by WhatsApp" aria-label={`Send ${bill.billNumber} by WhatsApp`}
                style={{ color: '#16a34a' }}>
                <i className="fab fa-whatsapp"></i>
              </button>
              <button className="btn btn-ghost bills-action-button bills-delete-button" onClick={event => { event.stopPropagation(); deleteBill(bill.id); }} title="Delete bill" aria-label={`Delete ${bill.billNumber}`}
                style={{ color: 'var(--color-danger)' }}>
                <i className="fas fa-trash"></i>
              </button>
            </div>
          </div>
        ))}
      </section>

      {showEditModal && editingBill && (
        <div className="modal modal-sheet">
          <div className="modal-content edit-bill-modal">
            {/* Fixed header */}
            <div className="modal-header">
              <h2>Edit Bill — {editingBill.billNumber}</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>

            {/* Scrollable body */}
            <div className="edit-bill-body">
              <div className="alert alert-success" style={{ marginBottom: 12 }}>
                <i className="fas fa-user"></i> {editingBill.customerName} · {editingBill.customerMobile}
              </div>

              {/* Items */}
              <div className="bill-items-header">
                <span>Item</span><span>Price</span><span>Qty</span><span>Total</span><span></span>
              </div>
              <div className="bill-items-list">
                {billItems.map((item, idx) => (
                  <div key={idx} className="bill-item-row">
                    <span className="bill-item-name">{item.name}</span>
                    <input className="bill-item-input" type="number" value={item.price}
                      onChange={e => setBillItems(billItems.map((bi, i) => i === idx ? { ...bi, price: parseFloat(e.target.value) || 0 } : bi))} />
                    <input className="bill-item-input" type="number" value={item.quantity}
                      onChange={e => updateQuantity(idx, parseInt(e.target.value))} />
                    <span className="bill-item-total">₹{(item.price * item.quantity).toFixed(2)}</span>
                    <button className="bill-item-remove" onClick={() => updateQuantity(idx, 0)}>×</button>
                  </div>
                ))}
              </div>

              {/* Add more items */}
              <div className="edit-bill-add-label">Add Items</div>
              <div className="edit-bill-add-items">
                {allItems.map(item => (
                  <button key={item.id} className="btn btn-ghost" onClick={() => addItemToBill(item)}
                    style={{ fontSize: 12, padding: '6px 12px' }}>
                    {item.name} · ₹{item.price}
                  </button>
                ))}
              </div>
            </div>

            {/* Sticky footer */}
            <div className="edit-bill-footer">
              <div className="edit-bill-totals">
                <div className="edit-bill-total-row">
                  <span>Subtotal</span><strong>₹{totals.subtotal.toFixed(2)}</strong>
                </div>
                <div className="edit-bill-total-row">
                  <span>Tax</span><strong>₹{totals.tax.toFixed(2)}</strong>
                </div>
                <div className="edit-bill-total-row">
                  <span>Discount</span>
                  <input type="number" value={discount}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    className="edit-bill-discount-input" />
                </div>
                <div className="edit-bill-grand">
                  <span>Total</span><span>₹{totals.finalTotal.toFixed(2)}</span>
                </div>
              </div>
              <div className="edit-bill-actions">
                <div className="payment-tabs">
                  {['Cash', 'UPI', 'Card'].map(mode => (
                    <button key={mode} className={`payment-tab ${paymentMode === mode ? 'active' : ''}`}
                      onClick={() => setPaymentMode(mode)}>
                      <i className={`fas ${mode === 'Cash' ? 'fa-money-bill' : mode === 'UPI' ? 'fa-mobile-alt' : 'fa-credit-card'}`}></i> {mode}
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={updateBill} style={{ width: '100%', padding: '12px', fontSize: 15 }}>
                  <i className="fas fa-check"></i> Update Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Bills;
