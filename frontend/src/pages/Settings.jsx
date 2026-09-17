import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { isValidMobile, isValidEmail, isValidPincode, isValidGst } from '../utils/validation';
import { showToast, showConfirmation } from '../services/notificationService';
import { backendAPI } from '../utils/backend';
import BillDocument from '../components/billing/BillDocument';
import { INVOICE_ACCENT_PRESETS, INVOICE_TEMPLATES, DEFAULT_INVOICE_ACCENT, DEFAULT_INVOICE_TEMPLATE, normalizeInvoiceAccent, normalizeInvoiceTemplate } from '../components/billing/invoiceTemplates';

const SECTION = ({ id, icon, title, subtitle, isOpen, onToggle, children }) => (
  <div className={`settings-section ${isOpen ? 'is-open' : 'is-collapsed'}`}>
    <button
      type="button"
      className="settings-section-header"
      onClick={() => onToggle(id)}
      aria-expanded={isOpen}
      aria-controls={`settings-section-body-${id}`}
    >
      <div className="settings-section-icon"><i className={`fas ${icon}`}></i></div>
      <div>
        <div className="settings-section-title">{title}</div>
        {subtitle && <div className="settings-section-sub">{subtitle}</div>}
      </div>
      <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} settings-section-chevron`} aria-hidden="true"></i>
    </button>
    {isOpen && <div id={`settings-section-body-${id}`} className="settings-section-body">{children}</div>}
  </div>
);

const Row = ({ children }) => <div className="settings-row">{children}</div>;

function Settings() {
  const { user, profile, setProfile, logout } = useAuth();
  const [form, setForm] = useState({
    businessName: '', ownerName: '', phone: '', email: '',
    businessType: 'general',
    address: '', area: '', city: '', state: '', pincode: '',
    gstNumber: '', panNumber: '',
    billPrefix: 'BILL', customerPrefix: 'CUST',
    defaultTax: '0', currency: '₹',
    billFooter: 'Thank you for shopping with us!',
    whatsappNumber: '', whatsappMessage: '',
    showTaxOnBill: true, showGstOnBill: false,
    allowBillingWithoutCustomer: false,
    inventoryEnabled: false, allowNegativeStock: false,
    invoiceTemplate: DEFAULT_INVOICE_TEMPLATE,
    invoiceAccentColor: DEFAULT_INVOICE_ACCENT,
  });
  const [saving, setSaving] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [pincodeStatus, setPincodeStatus] = useState('');
  const [openSection, setOpenSection] = useState('business');

  useEffect(() => {
    // Profile is loaded by AuthContext; sync it into the form
    if (profile) {
      setForm(prev => ({ ...prev, ...profile }));
    }
  }, [profile]);

  useEffect(() => {
    const pincode = String(form.pincode || '').trim();
    if (!isValidPincode(pincode) || pincode.length !== 6) {
      setPincodeStatus('');
      return undefined;
    }

    const controller = new AbortController();
    setPincodeStatus('Looking up location...');

    fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Pincode lookup failed');
        return response.json();
      })
      .then(result => {
        const office = result?.[0]?.PostOffice?.[0];
        if (!office) throw new Error('Pincode not found');
        setForm(previous => ({
          ...previous,
          area: office.Name || '',
          city: office.District || office.Block || '',
          state: office.State || '',
        }));
        setPincodeStatus('Location found. You can edit these details if needed.');
      })
      .catch(error => {
        if (error.name !== 'AbortError') setPincodeStatus('Location not found. Enter the details manually.');
      });

    return () => controller.abort();
  }, [form.pincode]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const toggleSection = sectionId => setOpenSection(previous => previous === sectionId ? '' : sectionId);

  const previewBill = {
    billNumber: 'BILL-00011',
    createdAt: '2026-09-17T10:00:00.000Z',
    dueDate: '2026-09-24',
    customerName: 'Aarav Mehta',
    customerMobile: '+91 98765 43210',
    items: [
      { name: 'Signature service', quantity: 1, price: 850, tax: 18 },
      { name: 'Finishing touch', quantity: 2, price: 120, tax: 0 },
    ],
    totalAmount: 1090,
    discount: 0,
    tax: 177,
    finalAmount: 1267,
    paidAmount: 1267,
    paymentMode: 'UPI',
  };

  const previewProfile = { ...form, invoiceTemplate: normalizeInvoiceTemplate(form.invoiceTemplate), invoiceAccentColor: normalizeInvoiceAccent(form.invoiceAccentColor) };

  const saveInvoicePreferences = async () => {
    setInvoiceSaving(true);
    const preferences = {
      invoiceTemplate: normalizeInvoiceTemplate(form.invoiceTemplate),
      invoiceAccentColor: normalizeInvoiceAccent(form.invoiceAccentColor),
    };
    try {
      await setProfile({ ...profile, ...preferences });
      showToast({ type: 'success', message: 'Invoice preferences saved.' });
    } catch {
      showToast({ type: 'error', message: 'Unable to save invoice preferences. Please try again.' });
    } finally {
      setInvoiceSaving(false);
    }
  };

  const handleSave = async () => {
    // ---- validation ----
    if (!form.businessName || form.businessName.trim().length < 2) {
      return showToast({ type: 'warning', message: 'Business name is required (at least 2 characters).' });
    }
    if (form.phone && !isValidMobile(form.phone)) {
      return showToast({ type: 'warning', message: 'Enter a valid 10-digit phone number, or leave it empty.' });
    }
    if (form.whatsappNumber && !isValidMobile(form.whatsappNumber)) {
      return showToast({ type: 'warning', message: 'Enter a valid WhatsApp number, or leave it empty.' });
    }
    if (!isValidEmail(form.email)) {
      return showToast({ type: 'warning', message: 'Please enter a valid email address.' });
    }
    if (!isValidPincode(form.pincode)) {
      return showToast({ type: 'warning', message: 'Pincode must be a valid 6-digit Indian pincode.' });
    }
    if (!isValidGst(form.gstNumber)) {
      return showToast({ type: 'warning', message: 'GST number format is invalid.' });
    }
    const tax = parseFloat(form.defaultTax);
    if (isNaN(tax) || tax < 0 || tax > 100) {
      return showToast({ type: 'warning', message: 'Default tax rate must be between 0 and 100.' });
    }
    if (form.billPrefix && !/^[A-Za-z0-9-]{1,10}$/.test(form.billPrefix.trim())) {
      return showToast({ type: 'warning', message: 'Bill prefix must be 1–10 letters, numbers, or dashes.' });
    }
    if (form.customerPrefix && !/^[A-Za-z0-9-]{1,10}$/.test(form.customerPrefix.trim())) {
      return showToast({ type: 'warning', message: 'Customer prefix must be 1–10 letters, numbers, or dashes.' });
    }

    const payload = { ...form, defaultTax: tax };
    setSaving(true);
    try {
      await setProfile({ ...profile, ...payload });
      showToast({ type: 'success', message: 'Settings saved successfully.' });
    } catch (error) {
      showToast({ type: 'error', message: error.message || 'Could not save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDeletion = async () => {
    await showConfirmation({
      title: 'Delete your account?',
      message: 'This permanently removes your business account and associated data. This action cannot be undone.',
      confirmText: 'Delete Account',
      destructive: true,
      onConfirm: async () => {
        const result = await backendAPI.deleteAccount();
        if (!result) {
          showToast({ type: 'error', message: 'Unable to submit the account deletion request.' });
          return;
        }
        showToast({ type: 'success', message: 'Account deletion request submitted.' });
        await logout();
      },
    });
  };

  return (
    <div className="settings-page">
      {/* Business Info */}
      <SECTION id="business" isOpen={openSection === 'business'} onToggle={toggleSection} icon="fa-store" title="Business Information" subtitle="Shown on bills and receipts">
        <Row>
          <div className="form-group">
            <label>Business Name *</label>
            <input type="text" value={form.businessName} onChange={e => set('businessName', e.target.value)} placeholder="e.g., Glamour Studio" />
          </div>
          <div className="form-group">
            <label>Owner Name</label>
            <input type="text" value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="e.g., Priya Sharma" />
          </div>
        </Row>
        <Row>
          <div className="form-group">
            <label>Phone Number</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="shop@example.com" />
          </div>
        </Row>
        <div className="form-group">
          <label>Address</label>
          <input type="text" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street address" />
        </div>
        <Row>
          <div className="form-group">
            <label>Area / Locality</label>
            <input type="text" value={form.area} onChange={e => set('area', e.target.value)} placeholder="Area or locality" />
          </div>
          <div className="form-group">
            <label>City</label>
            <input type="text" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Mumbai" />
          </div>
          <div className="form-group">
            <label>State</label>
            <input type="text" value={form.state} onChange={e => set('state', e.target.value)} placeholder="Maharashtra" />
          </div>
          <div className="form-group">
            <label>Pincode</label>
            <input type="text" inputMode="numeric" maxLength={6} value={form.pincode} onChange={e => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="400001" />
          </div>
        </Row>
        {pincodeStatus && <div className="settings-location-status">{pincodeStatus}</div>}
        <Row>
          <div className="form-group">
            <label>Business Type</label>
            <select value={form.businessType} onChange={e => set('businessType', e.target.value)}>
              <option value="salon">Salon / Spa</option>
              <option value="retail">Retail / Shop</option>
              <option value="restaurant">Restaurant / Cafe</option>
              <option value="grocery">Grocery / Kirana</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="repair">Repair / Services</option>
              <option value="general">Other Business</option>
            </select>
          </div>
          <div className="form-group">
            <label>GST Number</label>
            <input type="text" value={form.gstNumber} onChange={e => set('gstNumber', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
          </div>
          <div className="form-group">
            <label>PAN Number</label>
            <input type="text" value={form.panNumber} onChange={e => set('panNumber', e.target.value.toUpperCase())} placeholder="AAAAA0000A" />
          </div>
        </Row>
      </SECTION>

      {/* Billing Settings */}
      <SECTION id="billing" isOpen={openSection === 'billing'} onToggle={toggleSection} icon="fa-receipt" title="Billing Preferences" subtitle="Configure how bills are generated">
        <Row>
          <div className="form-group">
            <label>Bill Number Prefix</label>
            <input type="text" value={form.billPrefix} onChange={e => set('billPrefix', e.target.value.toUpperCase())} placeholder="BILL" />
            <span className="settings-hint">Bills will be: {form.billPrefix || 'BILL'}-00001</span>
          </div>
          <div className="form-group">
            <label>Customer ID Prefix</label>
            <input type="text" value={form.customerPrefix} onChange={e => set('customerPrefix', e.target.value.toUpperCase())} placeholder="CUST" />
            <span className="settings-hint">IDs will be: {form.customerPrefix || 'CUST'}-00001</span>
          </div>
        </Row>
        <Row>
          <div className="form-group">
            <label>Currency Symbol</label>
            <select value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="₹">₹ Indian Rupee</option>
              <option value="$">$ US Dollar</option>
              <option value="€">€ Euro</option>
              <option value="£">£ British Pound</option>
              <option value="AED">AED Dirham</option>
            </select>
          </div>
          <div className="form-group">
            <label>Default Tax Rate (%)</label>
            <input type="number" value={form.defaultTax} onChange={e => set('defaultTax', e.target.value)} placeholder="0" min="0" max="100" />
          </div>
        </Row>
        <div className="form-group">
          <label>Bill Footer Message</label>
          <textarea value={form.billFooter} onChange={e => set('billFooter', e.target.value)} placeholder="Thank you for visiting us!" rows={2} />
          <span className="settings-hint">Printed at the bottom of every bill</span>
        </div>
        <div className="settings-toggles">
          <label className="settings-toggle">
            <input type="checkbox" checked={form.allowBillingWithoutCustomer === true} onChange={e => set('allowBillingWithoutCustomer', e.target.checked)} />
            <span className="toggle-track"><span className="toggle-thumb"></span></span>
            <span className="toggle-label">Allow billing without a customer</span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={form.showTaxOnBill} onChange={e => set('showTaxOnBill', e.target.checked)} />
            <span className="toggle-track"><span className="toggle-thumb"></span></span>
            <span className="toggle-label">Show tax breakdown on bill</span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={form.showGstOnBill} onChange={e => set('showGstOnBill', e.target.checked)} />
            <span className="toggle-track"><span className="toggle-thumb"></span></span>
            <span className="toggle-label">Show GST number on bill</span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={form.inventoryEnabled === true} onChange={e => set('inventoryEnabled', e.target.checked)} />
            <span className="toggle-track"><span className="toggle-thumb"></span></span>
            <span className="toggle-label">Enable inventory tracking</span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={form.allowNegativeStock === true} onChange={e => set('allowNegativeStock', e.target.checked)} />
            <span className="toggle-track"><span className="toggle-thumb"></span></span>
            <span className="toggle-label">Allow stock to go below zero</span>
          </label>
        </div>
      </SECTION>

      <SECTION id="appearance" isOpen={openSection === 'appearance'} onToggle={toggleSection} icon="fa-palette" title="Invoice Appearance" subtitle="Choose how your bills look when printed or downloaded">
        <div className="invoice-settings-layout">
          <div className="invoice-template-picker">
            <div className="invoice-settings-heading"><strong>Invoice Templates</strong><span>Live preview</span></div>
            <div className="invoice-template-grid">
              {INVOICE_TEMPLATES.map(template => (
                <button type="button" key={template.id} className={`invoice-template-card ${form.invoiceTemplate === template.id ? 'is-selected' : ''}`} onClick={() => set('invoiceTemplate', template.id)} aria-pressed={form.invoiceTemplate === template.id}>
                  <span className={`invoice-template-mini invoice-template-mini--${template.id}`} style={{ '--preview-accent': form.invoiceAccentColor }}><i className={`fas ${template.icon}`}></i><b>MYBEEZNUS</b><em>{template.id === 'professional' ? 'INVOICE' : 'BILL'}</em><small>Bill · Total</small></span>
                  <strong>{template.name}</strong>
                  <span>{template.description}</span>
                  {form.invoiceTemplate === template.id && <b className="invoice-template-check"><i className="fas fa-check"></i> Selected</b>}
                </button>
              ))}
            </div>
            <div className="invoice-color-picker">
              <div className="invoice-settings-heading"><strong>Accent Color</strong><span>Used for headings and totals</span></div>
              <div className="invoice-color-swatches">
                {INVOICE_ACCENT_PRESETS.map(color => <button type="button" key={color.value} className={`invoice-color-swatch ${form.invoiceAccentColor.toUpperCase() === color.value ? 'is-selected' : ''}`} style={{ backgroundColor: color.value }} onClick={() => set('invoiceAccentColor', color.value)} title={`${color.name} ${color.value}`} aria-label={`${color.name} ${color.value}`} />)}
                <label className="invoice-custom-color"><span>Custom</span><input type="color" value={normalizeInvoiceAccent(form.invoiceAccentColor)} onChange={event => set('invoiceAccentColor', event.target.value)} aria-label="Custom invoice accent color" /></label>
              </div>
              <div className="invoice-selected-color"><span className="invoice-selected-dot" style={{ backgroundColor: normalizeInvoiceAccent(form.invoiceAccentColor) }}></span><span>{normalizeInvoiceAccent(form.invoiceAccentColor)}</span></div>
            </div>
            <button className="btn btn-primary invoice-preferences-save" onClick={saveInvoicePreferences} disabled={invoiceSaving}><i className={`fas ${invoiceSaving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i> {invoiceSaving ? 'Saving...' : 'Save Invoice Preferences'}</button>
          </div>
          <div className="invoice-live-preview">
            <div className="invoice-settings-heading"><strong>Preview Invoice</strong><span>{INVOICE_TEMPLATES.find(template => template.id === form.invoiceTemplate)?.name}</span></div>
            <div className="invoice-preview-frame"><BillDocument bill={previewBill} profile={previewProfile} customer={{ name: 'Aarav Mehta', mobile: '+91 98765 43210', email: 'aarav@example.com' }} /></div>
          </div>
        </div>
      </SECTION>

      {/* WhatsApp */}
      <SECTION id="whatsapp" isOpen={openSection === 'whatsapp'} onToggle={toggleSection} icon="fa-whatsapp fab" title="WhatsApp Settings" subtitle="Auto-send bills to customers via WhatsApp">
        <div className="form-group">
          <label>Your WhatsApp Number</label>
          <input type="tel" value={form.whatsappNumber} onChange={e => set('whatsappNumber', e.target.value)} placeholder="+919876543210" />
          <span className="settings-hint">Include country code, e.g. +91 for India</span>
        </div>
        <div className="form-group">
          <label>Default WhatsApp Message Template</label>
          <textarea value={form.whatsappMessage} onChange={e => set('whatsappMessage', e.target.value)}
            placeholder={`Hello {name},\n\nThank you for shopping with ${form.businessName || 'us'}!\nBill No: {bill_no} | Total: {total}\n\n${form.billFooter}`}
            rows={4} />
          <span className="settings-hint">Variables: {'{name}'}, {'{bill_no}'}, {'{total}'}, {'{payment_mode}'}</span>
        </div>
      </SECTION>

      {/* Account */}
      <SECTION id="account" isOpen={openSection === 'account'} onToggle={toggleSection} icon="fa-user-circle" title="Account" subtitle="Your login and account details">
        <div className="settings-account-info">
          <img src={user.photoURL} alt={user.displayName} className="settings-avatar" />
          <div>
            <div className="settings-account-name">{user.displayName}</div>
            <div className="settings-account-email">{user.email}</div>
          </div>
        </div>
        <div className="settings-danger-zone">
          <div className="danger-zone-title"><i className="fas fa-exclamation-triangle"></i> Danger Zone</div>
          <div className="danger-zone-row">
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Sign out of all devices</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>You will be redirected to the login page</div>
            </div>
            <button className="btn btn-danger" onClick={logout}>
              <i className="fas fa-sign-out-alt"></i> Sign Out
            </button>
          </div>
          <div className="danger-zone-row">
            <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Delete Account</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Permanently remove this business account and its associated data</div>
            </div>
            <button className="btn btn-ghost" onClick={handleRequestDeletion}
              style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
              <i className="fas fa-trash"></i> Delete Account
            </button>
          </div>
        </div>
      </SECTION>

      <div style={{ paddingBottom: 40 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '11px 28px' }}>
          {saving ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <><i className="fas fa-save"></i> Save All Changes</>}
        </button>
      </div>
    </div>
  );
}

export default Settings;
