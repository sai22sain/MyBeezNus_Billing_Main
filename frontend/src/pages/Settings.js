import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

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
    address: '', city: '', state: '', pincode: '',
    gstNumber: '', panNumber: '',
    billPrefix: 'BILL', customerPrefix: 'CUST',
    defaultTax: '0', currency: '₹',
    billFooter: 'Thank you for shopping with us!',
    whatsappNumber: '', whatsappMessage: '',
    showTaxOnBill: true, showGstOnBill: false,
  });
  const [saved, setSaved] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Profile is loaded by AuthContext; sync it into the form
    if (profile) {
      setForm(prev => ({ ...prev, ...profile }));
    }
    setLoading(false);
  }, [profile]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await setProfile({ ...profile, ...form });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Error saving settings');
    }
    setSaving(false);
  };

  const handleRequestDeletion = async () => {
    if (!window.confirm('Request account deletion? This sends a request to support. Your account and data are deleted only after admin approval.')) {
      return;
    }
    const uid = user && user.uid;
    if (!uid) {
      alert('Could not submit deletion request: you are not signed in.');
      return;
    }
    try {
      // Already requested? Do not create a second row.
      const { data: existing, error: checkErr } = await supabase
        .from('delete_requests')
        .select('id')
        .eq('user_id', uid)
        .eq('status', 'pending')
        .maybeSingle();
      if (checkErr) throw checkErr;
      if (existing) {
        setDeleteMsg('You already have a pending deletion request. Support will contact you.');
        return;
      }

      const { error } = await supabase
        .from('delete_requests')
        .insert({ user_id: uid, status: 'pending' });
      if (error) {
        // 23505 = unique_violation: a pending request exists (race with another tab)
        if (error.code === '23505') {
          setDeleteMsg('You already have a pending deletion request. Support will contact you.');
          return;
        }
        throw error;
      }

      setDeleteMsg('Deletion request submitted. Support will review it and delete your account.');
    } catch (err) {
      console.error('[handleRequestDeletion] error:', err);
      alert('Could not submit deletion request: ' + err.message);
    }
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
            <label>City</label>
            <input type="text" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Mumbai" />
          </div>
          <div className="form-group">
            <label>State</label>
            <input type="text" value={form.state} onChange={e => set('state', e.target.value)} placeholder="Maharashtra" />
          </div>
          <div className="form-group">
            <label>Pincode</label>
            <input type="text" value={form.pincode} onChange={e => set('pincode', e.target.value)} placeholder="400001" />
          </div>
        </Row>
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
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Request account deletion</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Ask support to permanently remove your account and all data</div>
            </div>
            <button className="btn btn-ghost" onClick={handleRequestDeletion}
              style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
              <i className="fas fa-trash"></i> Request deletion
            </button>
            {deleteMsg ? (<div style={{ fontSize: 12, marginTop: 6, color: 'var(--color-text-muted)' }}>{deleteMsg}</div>) : null}
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
