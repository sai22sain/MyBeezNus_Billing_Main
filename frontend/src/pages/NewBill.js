import React, { useMemo, useState } from 'react';
import { customerAPI, billAPI, itemAPI } from '../utils/firestoreAPI';
import { useCachedQuery } from '../hooks/useCachedQuery';
import { cacheKeys } from '../utils/firestoreAPI';
import { CACHE_TTL } from '../utils/core/cache';
import { useAuth } from '../context/AuthContext';
import { isPro, FREE_LIMITS } from '../utils/subscription';
import { isValidMobile } from '../utils/validation';
import { showToast } from '../services/notificationService';
import { buildBillMessage, openWhatsApp } from '../utils/whatsapp';
import { useNavigate } from 'react-router-dom';
import CustomerForm from '../components/CustomerForm';
import CustomerContextPanel from '../components/CustomerContextPanel';
import ResponsiveFormModal from '../components/ui/ResponsiveFormModal';

function NewBill() {
  const { user, profile, subscription } = useAuth();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [walkInCustomer, setWalkInCustomer] = useState(false);
  const [billItems, setBillItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerPrefill, setCustomerPrefill] = useState({ name: '', mobile: '', dob: '', gender: '' });
  const [noCustomerFound, setNoCustomerFound] = useState(false);
  const [customPrice, setCustomPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState(null);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerRefreshKey, setCustomerRefreshKey] = useState(0);

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
    try {
      const results = await customerAPI.search(user.uid, query);
      setSearchResults(results);
      setNoCustomerFound(results.length === 0);
    } catch {
      setSearchResults([]);
      showToast({ type: 'error', message: 'Unable to search customers. Please try again.' });
    }
  };

  const openCustomerForm = () => {
    const rawQuery = searchQuery.trim();
    const digits = rawQuery.replace(/\D/g, '');
    const mobileMatch = digits.match(/(?:91|0)?([6-9]\d{9})/);
    const mobile = mobileMatch ? mobileMatch[1] : '';
    const detectedName = rawQuery.replace(mobileMatch?.[0] || '', '').replace(/[+,()-]/g, ' ').replace(/\s+/g, ' ').trim();
    const name = /[a-zA-Z]/.test(detectedName) ? detectedName : '';
    setCustomerPrefill({ name, mobile, dob: '', gender: '', customerType: '', address: '', notes: '' });
    setShowCustomerModal(true);
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

  const handleCustomerSaved = (customer) => {
    setSelectedCustomer(customer);
    setSearchQuery('');
    setSearchResults([]);
    setNoCustomerFound(false);
    setShowCustomerModal(false);
    showToast({ type: 'success', message: 'Customer added successfully.' });
  };

  const createBill = async (sendWhatsApp = false) => {
    if (!selectedCustomer && !walkInCustomer && !profile?.allowBillingWithoutCustomer) return showToast({ type: 'warning', message: 'Please select a customer.' });
    if (billItems.length === 0) return showToast({ type: 'warning', message: 'Please add items to the bill.' });
    if (saving) return;
    setSaving(true);
    setSavingMode(sendWhatsApp ? 'whatsapp' : 'save');

    if (!isPro(subscription)) {
      const allBills = await billAPI.getAll(user.uid);
      const now = new Date();
      const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (allBills.filter(b => b.createdAt?.startsWith(prefix)).length >= FREE_LIMITS.bills) {
        setSaving(false);
        return showToast({ type: 'warning', message: `Free plan limit reached (${FREE_LIMITS.bills} bills/month). Upgrade to continue.` });
      }
    }

    try {
      const totals = calculateTotals();
      const result = await billAPI.create(user.uid, {
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || 'Walk-in customer',
        customerMobile: selectedCustomer?.mobile || '',
        items: billItems, discount, paymentMode,
        totalAmount: totals.subtotal, tax: totals.tax, finalAmount: totals.finalTotal
      }, { billPrefix: profile?.billPrefix });
      showToast({ type: 'success', message: `Bill ${result.billNumber} saved successfully.` });
      if (sendWhatsApp) {
        if (!selectedCustomer) {
          showToast({ type: 'info', message: 'Bill saved. A customer and WhatsApp number are required to send this bill.' });
        } else if (!isValidMobile(selectedCustomer.mobile)) {
          showToast({ type: 'warning', message: "Bill saved successfully, but this customer doesn't have a valid WhatsApp number." });
        } else {
          const messageText = buildBillMessage({ billNumber: result.billNumber, customerName: selectedCustomer.name, businessName: profile?.businessName, total: totals.finalTotal, paymentMode, items: billItems });
          if (openWhatsApp(selectedCustomer.mobile, messageText)) showToast({ type: 'info', message: 'Bill saved. WhatsApp opened with the bill ready to send.' });
          else showToast({ type: 'warning', message: "Bill saved successfully. WhatsApp isn't available on this device." });
        }
      }
      setSelectedCustomer(null); setWalkInCustomer(false); setBillItems([]); setDiscount(0); setPaymentMode('Cash');
      setCustomerRefreshKey(key => key + 1);
    } catch { showToast({ type: 'error', message: 'Unable to save the bill. Please try again.' }); }
    finally { setSaving(false); setSavingMode(null); }
  };

  const filteredItems = useMemo(() => items.filter(item =>
    (!selectedCategory || item.categoryId === selectedCategory) &&
    (!itemSearch || `${item.name || ''} ${item.categoryName || ''}`.toLowerCase().includes(itemSearch.toLowerCase()))
  ), [items, selectedCategory, itemSearch]);

  const totals = calculateTotals();

  return (
    <div className="billing-page">
      <header className="billing-header">
        <div>
          <div className="billing-kicker"><i className="fas fa-bolt"></i> Fast billing workspace</div>
          <h1>New Bill</h1>
          <p>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} <span>·</span> Draft invoice</p>
        </div>
        <div className="billing-header-meta">
          <span className="billing-status"><i className="fas fa-circle"></i> Ready</span>
          <span className="billing-bill-hint">Bill number assigned on save</span>
        </div>
      </header>

      <div className={`billing-workspace${selectedCustomer ? ' has-customer-context' : ''}`}>
        <section className="billing-catalog" aria-labelledby="catalog-title">
          <div className="billing-section-heading">
            <div><span className="billing-eyebrow">Build the bill</span><h2 id="catalog-title">Item catalog</h2></div>
            <button className="billing-icon-button" type="button" title="Add item" aria-label="Add item" onClick={() => navigate('/items')}><i className="fas fa-plus"></i></button>
          </div>
          <label className="billing-search">
            <i className="fas fa-search"></i>
            <span className="sr-only">Search items</span>
            <input type="search" placeholder="Search items or category..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
            <kbd>⌘ K</kbd>
          </label>
          <div className="billing-category-filter" aria-label="Filter items by category">
            <button type="button" className={!selectedCategory ? 'active' : ''} onClick={() => setSelectedCategory(null)}>All</button>
            {categories.map(cat => <button type="button" key={cat.id} className={selectedCategory === cat.id ? 'active' : ''} onClick={() => setSelectedCategory(cat.id)}>{cat.name}</button>)}
          </div>
          <div className="billing-catalog-list">
            {filteredItems.map(item => <button type="button" key={item.id} className="billing-item-tile" onClick={() => addItemToBill(item)}>
              <span className="billing-item-tile-icon"><i className="fas fa-plus"></i></span>
              <span className="billing-item-tile-copy"><strong>{item.name}</strong><small>{item.categoryName || 'Item'}{item.tax ? ` · ${item.tax}% tax` : ''}</small></span>
              <span className="billing-item-tile-price">₹{Number(item.price).toFixed(0)}</span>
            </button>)}
            {filteredItems.length === 0 && !itemSearch && <div className="billing-catalog-empty"><i className="fas fa-box-open"></i><strong>No items available</strong><span>Add your first item to start billing.</span><button type="button" className="billing-inline-link" onClick={() => navigate('/items')}>Add item <i className="fas fa-arrow-right"></i></button></div>}
            {filteredItems.length === 0 && itemSearch && <div className="billing-custom-item"><span>No match for “{itemSearch}”</span><div><input type="number" aria-label="Custom item price" placeholder="Price ₹" value={customPrice} onChange={e => setCustomPrice(e.target.value)} /><button type="button" className="btn btn-primary" onClick={() => { if (!customPrice) return; addItemToBill({ id: `custom_${Date.now()}`, name: itemSearch, price: parseFloat(customPrice), tax: 0 }); setCustomPrice(''); setItemSearch(''); }}>Add custom</button></div></div>}
          </div>
        </section>

        <section className="billing-invoice" aria-labelledby="invoice-title">
          <div className="billing-section-heading billing-invoice-heading"><div><span className="billing-eyebrow">Live preview</span><h2 id="invoice-title">Current bill</h2></div><span className="billing-item-count">{billItems.reduce((sum, item) => sum + item.quantity, 0)} items</span></div>
          <div className="billing-customer-row">
            <div className="billing-customer-label"><span className="billing-eyebrow">Customer</span>{selectedCustomer ? <strong>{selectedCustomer.name}</strong> : walkInCustomer ? <strong>Walk-in customer</strong> : <strong>Select a customer</strong>}{selectedCustomer && <small>{selectedCustomer.mobile || 'No mobile number'}</small>}{walkInCustomer && <small>No customer attached</small>}</div>
            {selectedCustomer || walkInCustomer ? <button type="button" className="billing-text-button" onClick={() => { setSelectedCustomer(null); setWalkInCustomer(false); }}>Change</button> : <button type="button" className="billing-text-button" onClick={() => setShowCustomerModal(true)}><i className="fas fa-user-plus"></i> Add new</button>}
          </div>
          {!selectedCustomer && !walkInCustomer && <div className="billing-customer-picker"><label className="billing-search billing-customer-search"><i className="fas fa-user"></i><span className="sr-only">Search customer</span><input type="search" placeholder="Search by name or mobile..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); searchCustomers(e.target.value); }} /></label>{profile?.allowBillingWithoutCustomer && <button type="button" className="billing-walkin-button" onClick={() => { setWalkInCustomer(true); setSearchQuery(''); setSearchResults([]); }}><i className="fas fa-person-walking"></i> Continue without customer</button>}{searchResults.length > 0 && <div className="billing-customer-results">{searchResults.map(c => <button type="button" key={c.id} onClick={() => { setSelectedCustomer(c); setSearchQuery(''); setSearchResults([]); setNoCustomerFound(false); }}><span><strong>{c.name}</strong><small>{c.mobile}</small></span><i className="fas fa-arrow-right"></i></button>)}</div>}{noCustomerFound && <div className="billing-no-customer">No customer found. <button type="button" onClick={openCustomerForm}><i className="fas fa-user-plus"></i> Add New Customer</button></div>}</div>}

          <div className="billing-items-area">
            {billItems.length === 0 ? <div className="billing-empty-invoice"><i className="fas fa-receipt"></i><strong>Your bill is empty</strong><span>Select an item from the catalog to get started.</span></div> : <>
              <div className="billing-items-head"><span>Item</span><span>Rate</span><span>Qty</span><span>Amount</span><span></span></div>
              <div className="billing-invoice-items">{billItems.map((item, idx) => <div key={idx} className="billing-invoice-item"><div className="billing-invoice-item-name"><strong>{item.name}</strong>{item.tax ? <small>{item.tax}% tax included</small> : null}</div><input aria-label={`${item.name} price`} type="number" value={item.price} onChange={e => setBillItems(billItems.map((bi, i) => i === idx ? { ...bi, price: parseFloat(e.target.value) || 0 } : bi))} /><div className="billing-quantity"><button type="button" aria-label={`Decrease ${item.name} quantity`} onClick={() => updateQuantity(idx, item.quantity - 1)}>−</button><span>{item.quantity}</span><button type="button" aria-label={`Increase ${item.name} quantity`} onClick={() => updateQuantity(idx, item.quantity + 1)}>+</button></div><strong className="billing-line-total">₹{(item.price * item.quantity).toFixed(2)}</strong><button type="button" className="billing-remove-item" aria-label={`Remove ${item.name}`} onClick={() => updateQuantity(idx, 0)}>×</button></div>)}</div>
            </>}
          </div>

          <div className="billing-summary"><div className="billing-summary-row"><span>Subtotal</span><strong>₹{totals.subtotal.toFixed(2)}</strong></div><div className="billing-summary-row"><span>Tax</span><strong>₹{totals.tax.toFixed(2)}</strong></div><div className="billing-summary-row billing-discount-row"><label htmlFor="bill-discount">Discount</label><input id="bill-discount" type="number" min="0" value={discount} onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))} placeholder="0" /></div><div className="billing-total"><span>Total payable</span><strong>₹{Math.max(0, totals.finalTotal).toFixed(2)}</strong></div></div>
          <div className="billing-payment"><span className="billing-eyebrow">Payment method</span><div className="billing-payment-options">{['Cash', 'UPI', 'Card'].map(mode => <button type="button" key={mode} className={paymentMode === mode ? 'active' : ''} onClick={() => setPaymentMode(mode)}><i className={`fas ${mode === 'Cash' ? 'fa-money-bill' : mode === 'UPI' ? 'fa-mobile-screen-button' : 'fa-credit-card'}`}></i>{mode}</button>)}</div></div>
          <div className="billing-actions"><button type="button" className="billing-save-button" onClick={() => createBill(false)} disabled={saving}><i className={`fas ${savingMode === 'save' ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>{savingMode === 'save' ? 'Saving...' : 'Save bill'}</button><button type="button" className="billing-whatsapp-button" onClick={() => createBill(true)} disabled={saving}><i className={`fab ${savingMode === 'whatsapp' ? 'fa-spinner fa-spin' : 'fa-whatsapp'}`}></i>{savingMode === 'whatsapp' ? 'Saving & preparing...' : 'Save & send via WhatsApp'}</button></div>
        </section>

        <CustomerContextPanel
          user={user}
          profile={profile}
          customer={selectedCustomer}
          refreshKey={customerRefreshKey}
          onCustomerUpdated={updated => { setSelectedCustomer(current => ({ ...current, ...updated })); setCustomerRefreshKey(key => key + 1); }}
        />
      </div>

      {showCustomerModal && <ResponsiveFormModal title="Add New Customer" labelledBy="billing-customer-form-title" maxWidth={440} onClose={() => setShowCustomerModal(false)} footer={<><button type="button" className="btn btn-ghost" onClick={() => setShowCustomerModal(false)} disabled={customerSaving}>Cancel</button><button type="submit" form="billing-customer-form" className="btn btn-primary" disabled={customerSaving}><i className={`fas ${customerSaving ? 'fa-spinner fa-spin' : 'fa-user-plus'}`}></i> {customerSaving ? 'Saving...' : 'Add Customer'}</button></>}>
        <CustomerForm user={user} profile={profile} formId="billing-customer-form" showActions={false} initialValues={customerPrefill} onSaved={handleCustomerSaved} onCancel={() => setShowCustomerModal(false)} onSelectExisting={customer => { setSelectedCustomer(customer); setSearchQuery(''); setSearchResults([]); setNoCustomerFound(false); setShowCustomerModal(false); }} onBusyChange={setCustomerSaving} />
      </ResponsiveFormModal>}
    </div>
  );
}

export default NewBill;
