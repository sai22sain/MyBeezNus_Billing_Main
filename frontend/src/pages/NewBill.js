import React, { useState } from 'react';
import { customerAPI, billAPI, itemAPI } from '../utils/firestoreAPI';
import { useCachedQuery } from '../hooks/useCachedQuery';
import { cacheKeys } from '../utils/firestoreAPI';
import { CACHE_TTL } from '../utils/core/cache';
import { useAuth } from '../context/AuthContext';
import { isPro, FREE_LIMITS } from '../utils/subscription';
import { normalizeMobile, isValidMobile, isValidName, isValidDob } from '../utils/validation';
import { useNavigate } from 'react-router-dom';

function NewBill() {
  const { user, profile, subscription } = useAuth();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [billItems, setBillItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '', dob: '', gender: '' });
  const [message, setMessage] = useState(null);
  const [noCustomerFound, setNoCustomerFound] = useState(false);
  const [customPrice, setCustomPrice] = useState('');

  // Reference data served from the shared per-user cache (5-min cats,
  // 2-min active items). Mutations on other pages invalidate it.
  const { data: items } = useCachedQuery(
    user?.uid, cacheKeys.activeItems, CACHE_TTL.activeItems,
    () => itemAPI.getActive(user.uid)
  );
  const { data: categories } = useCachedQuery(
    user?.uid, cacheKeys.categories, CACHE_TTL.categories,
    () => itemAPI.getCategories(user.uid)
  );


  const searchCustomers = async (query) => {
    if (query.length < 3) { setSearchResults([]); setNoCustomerFound(false); return; }
    const results = await customerAPI.search(user.uid, query);
    setSearchResults(results);
    setNoCustomerFound(results.length === 0);
    if (results.length === 0) setNewCustomer({ name: '', mobile: query, dob: '', gender: '' });
  };

  const addItemToBill = (item) => {
    const ex = billItems.findIndex(bi => bi.itemId === item.id);
    if (ex >= 0) setBillItems(billItems.map((bi, i) => i === ex ? { ...bi, quantity: bi.quantity + 1 } : bi));
    else setBillItems([...billItems, { itemId: item.id, name: item.name, price: item.price, tax: item.tax || 0, quantity: 1 }]);
  };

  const updateQuantity = (idx, qty) => {
    if (qty <= 0) setBillItems(billItems.filter((_, i) => i !== idx));
    else setBillItems(billItems.map((bi, i) => i === idx ? { ...bi, quantity: qty } : bi));
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

  const addNewCustomer = async () => {
    // ---- validation ----
    if (!isValidName(newCustomer.name)) {
      return setMessage({ type: 'error', text: 'Please enter a valid name (2–60 characters).' });
    }
    if (!newCustomer.mobile || !isValidMobile(newCustomer.mobile)) {
      return setMessage({ type: 'error', text: 'Enter a valid 10-digit mobile starting with 6-9 (e.g. 9876543210).' });
    }
    if (!isValidDob(newCustomer.dob)) {
      return setMessage({ type: 'error', text: 'Date of birth cannot be in the future.' });
    }
    const payload = { ...newCustomer, mobile: normalizeMobile(newCustomer.mobile) };
    try {
      const result = await customerAPI.create(
        user.uid, payload, { customerPrefix: profile?.customerPrefix }
      );
      setSelectedCustomer({ ...payload, id: result.id, customerId: result.customerId });
      setShowCustomerModal(false);
      setMessage({ type: 'success', text: 'Customer added!' });
    } catch (e) {
      console.error('Add customer failed:', e);
      setMessage({ type: 'error', text: `Error adding customer${e?.message ? ` — ${e.message}` : ''}` });
    }
  };

  const createBill = async () => {
    if (!selectedCustomer) return setMessage({ type: 'error', text: 'Please select a customer' });
    if (billItems.length === 0) return setMessage({ type: 'error', text: 'Please add items to the bill' });

    if (!isPro(subscription)) {
      const allBills = await billAPI.getAll(user.uid);
      const now = new Date();
      const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (allBills.filter(b => b.createdAt?.startsWith(prefix)).length >= FREE_LIMITS.bills) {
        return setMessage({ type: 'error', text: `Free plan limit reached (${FREE_LIMITS.bills} bills/month).`, upgrade: true });
      }
    }

    try {
      const totals = calculateTotals();
      const result = await billAPI.create(user.uid, {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerMobile: selectedCustomer.mobile,
        items: billItems, discount, paymentMode,
        totalAmount: totals.subtotal, tax: totals.tax, finalAmount: totals.finalTotal
      }, { billPrefix: profile?.billPrefix });
      const msg = `Hello ${selectedCustomer.name},\n\nThank you for shopping with ${profile?.businessName || 'us'}!\n\nBill No: ${result.billNumber}\nTotal: ₹${totals.finalTotal.toFixed(2)}\nPayment: ${paymentMode}\n\nItems:\n${billItems.map(i => `- ${i.name} x${i.quantity} = ₹${(i.price * i.quantity).toFixed(2)}`).join('\n')}\n\nThank you!`;
      window.open(`https://web.whatsapp.com/send?phone=${selectedCustomer.mobile.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(msg)}`, '_blank');
      setMessage({ type: 'success', text: `Bill ${result.billNumber} created!` });
      setSelectedCustomer(null); setBillItems([]); setDiscount(0); setPaymentMode('Cash');
    } catch { setMessage({ type: 'error', text: 'Error creating bill' }); }
  };

  const filteredItems = items.filter(item =>
    (!selectedCategory || item.categoryId === selectedCategory) &&
    (!itemSearch || item.name?.toLowerCase().includes(itemSearch.toLowerCase()))
  );

  const totals = calculateTotals();

  return (
    <div>
      <div className="page-header"><h1>New Bill</h1></div>

      {message && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span>{message.text}</span>
          {message.upgrade && (
            <button className="btn btn-primary" onClick={() => navigate('/pricing')} style={{ marginLeft: 12, whiteSpace: 'nowrap' }}>
              <i className="fas fa-crown"></i> Upgrade to Pro
            </button>
          )}
        </div>
      )}

      <div className="new-bill-layout">
        {/* Left panel */}
        <div>
          {/* Customer */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 12 }}>Customer</div>
            {selectedCustomer ? (
              <div className="customer-selected">
                <div className="customer-selected-name">{selectedCustomer.name}</div>
                <div className="customer-selected-mobile">{selectedCustomer.mobile}</div>
                <button className="btn btn-ghost" onClick={() => setSelectedCustomer(null)} style={{ fontSize: 12, padding: '6px 12px' }}>
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <input type="text" placeholder="Search by mobile or name..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); searchCustomers(e.target.value); }} />
                </div>
                {searchResults.length > 0 && (
                  <div className="customer-dropdown">
                    {searchResults.map(c => (
                      <div key={c.id} className="customer-dropdown-item"
                        onClick={() => { setSelectedCustomer(c); setSearchQuery(''); setSearchResults([]); }}>
                        <div className="customer-dropdown-name">{c.name}</div>
                        <div className="customer-dropdown-mobile">{c.mobile}</div>
                      </div>
                    ))}
                  </div>
                )}
                {noCustomerFound && (
                  <div className="no-customer-found">
                    <p>No customer found for "{searchQuery}"</p>
                    <button className="btn btn-primary" onClick={() => setShowCustomerModal(true)} style={{ width: '100%' }}>
                      <i className="fas fa-user-plus"></i> Add as New Customer
                    </button>
                  </div>
                )}
                {!noCustomerFound && (
                  <button className="btn btn-ghost" onClick={() => setShowCustomerModal(true)} style={{ width: '100%', marginTop: 4 }}>
                    <i className="fas fa-user-plus"></i> Add New Customer
                  </button>
                )}
              </>
            )}
          </div>

          {/* Services */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 12 }}>Items</div>
            <div className="category-tabs" style={{ marginBottom: 12 }}>
              <button className={`category-tab ${!selectedCategory ? 'active' : ''}`} onClick={() => setSelectedCategory(null)}>All</button>
              {categories.map(cat => (
                <button key={cat.id} className={`category-tab ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}>{cat.name}</button>
              ))}
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <input type="text" placeholder="Search items..." value={itemSearch}
                onChange={e => setItemSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
              {filteredItems.map(item => (
                <button key={item.id} className="service-btn" onClick={() => addItemToBill(item)}>
                  <span>{item.name}</span>
                  <span className="service-btn-price">₹{item.price}</span>
                </button>
              ))}
              {filteredItems.length === 0 && itemSearch && (
                <div className="custom-service-box">
                  <p>"{itemSearch}" not found. Add as custom?</p>
                  <div className="custom-service-inputs">
                    <input type="number" placeholder="Price ₹" value={customPrice}
                      onChange={e => setCustomPrice(e.target.value)} />
                    <button className="btn btn-primary" onClick={() => {
                      if (!customPrice) return;
                      addItemToBill({ id: `custom_${Date.now()}`, name: itemSearch, price: parseFloat(customPrice), tax: 0 });
                      setCustomPrice(''); setItemSearch('');
                    }}>Add</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel — Bill Summary */}
        <div className="card" style={{ position: 'sticky', top: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 16 }}>Bill Summary</div>

          {billItems.length === 0 ? (
            <div className="bill-empty">
              <i className="fas fa-receipt"></i>
              <p>No items added yet</p>
              <p style={{ fontSize: 12, marginTop: 4, opacity: 0.6 }}>Click items on the left to add</p>
            </div>
          ) : (
            <>
              {/* Bill items list */}
              <div className="bill-items-header">
                <span>Item</span>
                <span>Price</span>
                <span>Qty</span>
                <span>Total</span>
                <span></span>
              </div>
              <div className="bill-items-list">
                {billItems.map((item, idx) => (
                  <div key={idx} className="bill-item-row">
                    <span className="bill-item-name">{item.name}</span>
                    <input
                      type="number"
                      className="bill-item-input"
                      value={item.price}
                      onChange={e => setBillItems(billItems.map((bi, i) => i === idx ? { ...bi, price: parseFloat(e.target.value) || 0 } : bi))}
                    />
                    <input
                      type="number"
                      className="bill-item-input"
                      value={item.quantity}
                      onChange={e => updateQuantity(idx, parseInt(e.target.value))}
                    />
                    <span className="bill-item-total">&#8377;{(item.price * item.quantity).toFixed(2)}</span>
                    <button className="bill-item-remove" onClick={() => updateQuantity(idx, 0)}>&#215;</button>
                  </div>
                ))}
              </div>

              <div className="bill-summary-totals">
                <div className="bill-total-row"><span>Subtotal</span><strong>₹{totals.subtotal.toFixed(2)}</strong></div>
                <div className="bill-total-row"><span>Tax</span><strong>₹{totals.tax.toFixed(2)}</strong></div>
                <div className="bill-total-row">
                  <span>Discount</span>
                  <input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    style={{ width: 90, padding: '4px 8px', border: '1.5px solid var(--color-border)', borderRadius: 6, fontSize: 13, textAlign: 'right' }} />
                </div>
                <div className="bill-grand-total">
                  <span>Total</span>
                  <span>₹{totals.finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="payment-tabs">
                {['Cash', 'UPI', 'Card'].map(mode => (
                  <button key={mode} className={`payment-tab ${paymentMode === mode ? 'active' : ''}`}
                    onClick={() => setPaymentMode(mode)}>
                    <i className={`fas ${mode === 'Cash' ? 'fa-money-bill' : mode === 'UPI' ? 'fa-mobile-alt' : 'fa-credit-card'}`}></i> {mode}
                  </button>
                ))}
              </div>

              <button className="btn btn-success" onClick={createBill}
                style={{ width: '100%', padding: '13px', fontSize: 15, marginTop: 4 }}>
                <i className="fas fa-paper-plane"></i> Save Bill & Send WhatsApp
              </button>
            </>
          )}
        </div>
      </div>

      {showCustomerModal && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2>Add New Customer</h2>
              <button className="close-btn" onClick={() => setShowCustomerModal(false)}>×</button>
            </div>
            {['name', 'mobile'].map(f => (
              <div className="form-group" key={f}>
                <label>{f === 'mobile' ? 'Mobile Number' : f.charAt(0).toUpperCase() + f.slice(1)} *</label>
                {f === 'mobile'
                  ? <input type="tel" inputMode="numeric" maxLength={12} placeholder="10-digit mobile"
                      value={newCustomer[f]} onChange={e => setNewCustomer({ ...newCustomer, [f]: e.target.value.replace(/[^0-9+ ]/g, '') })} />
                  : <input type="text" maxLength={60}
                      value={newCustomer[f]} onChange={e => setNewCustomer({ ...newCustomer, [f]: e.target.value })} />}
              </div>
            ))}
            <div className="form-group">
              <label>Date of Birth</label>
              <input type="date" max={new Date().toISOString().slice(0, 10)} value={newCustomer.dob} onChange={e => setNewCustomer({ ...newCustomer, dob: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select value={newCustomer.gender} onChange={e => setNewCustomer({ ...newCustomer, gender: e.target.value })}>
                <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={addNewCustomer}>Add Customer</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NewBill;
