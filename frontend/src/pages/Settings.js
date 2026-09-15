import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { normalizeMobile, isValidMobile, isValidEmail, isValidPincode, isValidGst } from '../utils/validation';
import { showToast, showConfirmation } from '../services/notificationService';
import { backendAPI } from '../utils/backend';
import { supabase } from '../supabase';

const API_URL = process.env.REACT_APP_API_URL ?? '';

const SECTION = ({ icon, title, subtitle, children }) => (
  <div className="settings-section">
    <div className="settings-section-header">
      <div className="settings-section-icon"><i className={`fas ${icon}`}></i></div>
      <div>
        <div className="settings-section-title">{title}</div>
        {subtitle && <div className="settings-section-sub">{subtitle}</div>}
      </div>
    </div>
    <div className="settings-section-body">{children}</div>
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
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pincodeStatus, setPincodeStatus] = useState('');

  // ---- Support tickets (CRM) ----
  const [ticketForm, setTicketForm] = useState({ category: 'bug', subject: '', message: '' });
  const [myTickets, setMyTickets] = useState([]);
  const [ticketMsg, setTicketMsg] = useState('');
  const [ticketBusy, setTicketBusy] = useState(false);

  useEffect(() => {
    // Profile is loaded by AuthContext; sync it into the form
    if (profile) {
      setForm(prev => ({ ...prev, ...profile }));
    }
    setLoading(false);
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

  // ---- Support ticket helpers ----
  const authedFetch = useCallback(async (method, url, body) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      const r = await authedFetch('GET', `${API_URL}/api/support/mine`);
      setMyTickets(r.tickets || []);
    } catch {
      /* tickets are non-critical - stay silent on failure */
    }
  }, [authedFetch]);

  const handleRaiseTicket = async () => {
    const subject = ticketForm.subject.trim();
    const message = ticketForm.message.trim();
    if (subject.length < 3) return alert('Subject must be at least 3 characters.');
    if (message.length < 5) return alert('Please describe the issue (at least 5 characters).');
    setTicketBusy(true);
    setTicketMsg('');
    try {
      await authedFetch('POST', `${API_URL}/api/support`, {
        app: 'billing',
        ...ticketForm,
        subject,
        message,
      });
      setTicketForm({ category: 'bug', subject: '', message: '' });
      setTicketMsg('Ticket submitted. Our team will get back to you here.');
      await loadTickets();
    } catch (e) {
      setTicketMsg('Could not submit ticket: ' + e.message);
    } finally {
      setTicketBusy(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

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

    setSaving(true);
    try {
      await setProfile({
        ...profile,
        ...form,
        phone: normalizeMobile(form.phone),
        whatsappNumber: normalizeMobile(form.whatsappNumber),
        defaultTax: String(tax),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      showToast({ type: 'success', message: 'Settings saved successfully.' });
    } catch (e) {
      showToast({ type: 'error', message: 'Unable to save settings. Please try again.' });
    }
    setSaving(false);
  };

  const handleRequestDeletion = async () => {
    await showConfirmation({
      title: 'Delete this account?',
      message: 'This will permanently remove the business account and its associated data.',
      confirmText: 'Delete Account',
      destructive: true,
      onConfirm: async () => {
        try {
          const result = await backendAPI.deleteAccount();
          if (result === null) throw new Error('Account deletion service unavailable');
          showToast({ type: 'success', message: 'Account deleted successfully.' });
          await logout();
        } catch (err) {
          console.error('[handleAccountDeletion] error:', err);
          showToast({ type: 'error', message: 'Unable to delete the account. Please try again.' });
        }
      },
    });
  };

  if (loading) return <div className="loading"><i className="fas fa-spinner fa-spin"></i> Loading...</div>;

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, fontSize: 13 }}>
            Manage your business profile and billing preferences
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving
            ? <><i className="fas fa-spinner fa-spin"></i> Saving...</>
            : saved
            ? <><i className="fas fa-check"></i> Saved!</>
            : <><i className="fas fa-save"></i> Save Changes</>}
        </button>
      </div>

      {saved && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          <i className="fas fa-check-circle"></i> Settings saved successfully!
        </div>
      )}

      {/* Business Info */}
      <SECTION icon="fa-store" title="Business Information" subtitle="Shown on bills and receipts">
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
      <SECTION icon="fa-receipt" title="Billing Preferences" subtitle="Configure how bills are generated">
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
        </div>
      </SECTION>

      {/* WhatsApp */}
      <SECTION icon="fa-whatsapp fab" title="WhatsApp Settings" subtitle="Auto-send bills to customers via WhatsApp">
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
      <SECTION icon="fa-user-circle" title="Account" subtitle="Your login and account details">
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

      {/* Help & Support */}
      <SECTION icon="fa-headset" title="Help &amp; Support" subtitle="Raise a ticket — our team will get back to you">
        <div className="form-group">
          <label>Category</label>
          <select value={ticketForm.category} onChange={e => setTicketForm(p => ({ ...p, category: e.target.value }))}>
            <option value="bug">Bug / something not working</option>
            <option value="feature">Feature request</option>
            <option value="billing">Billing / payment issue</option>
            <option value="account">Account issue</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label>Subject</label>
          <input
            value={ticketForm.subject}
            maxLength={120}
            onChange={e => setTicketForm(p => ({ ...p, subject: e.target.value }))}
            placeholder="Short summary (e.g. Bill PDF not opening)"
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            rows={4}
            maxLength={4000}
            value={ticketForm.message}
            onChange={e => setTicketForm(p => ({ ...p, message: e.target.value }))}
            placeholder="Tell us what happened, what you expected and what went wrong..."
          />
        </div>
        <button className="btn btn-primary" onClick={handleRaiseTicket} disabled={ticketBusy} style={{ padding: '9px 22px' }}>
          {ticketBusy ? <><i className="fas fa-spinner fa-spin"></i> Sending...</> : <><i className="fas fa-paper-plane"></i> Submit ticket</>}
        </button>
        {ticketMsg && <div style={{ fontSize: 13, marginTop: 8, color: 'var(--color-text-muted)' }}>{ticketMsg}</div>}

        {myTickets.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="settings-section-sub" style={{ marginBottom: 4 }}>Your recent tickets</div>
            {myTickets.map(t => (
              <div key={t.id} style={{ borderTop: '1px solid var(--color-border, rgba(128,128,128,.25))', padding: '10px 0', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{t.subject}</strong>
                  <span style={{
                    fontWeight: 600, whiteSpace: 'nowrap',
                    color: t.status === 'open' ? '#f59e0b'
                      : (t.status === 'resolved' || t.status === 'closed') ? '#22c55e' : '#3b82f6',
                  }}>
                    {String(t.status).replace('_', ' ')}
                  </span>
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
                  {new Date(t.created_at).toLocaleString('en-IN')} &middot; {t.app}
                </div>
                {t.admin_reply && (
                  <div style={{ marginTop: 6, background: 'rgba(127,127,127,.12)', padding: 8, borderRadius: 6 }}>
                    <strong>Support:</strong> {t.admin_reply}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
