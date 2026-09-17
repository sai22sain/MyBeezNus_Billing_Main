import React, { useEffect, useState } from 'react';
import { customerAPI } from '../utils/firestoreAPI';
import { normalizeMobile, isValidMobile, isValidName, isValidDob, isValidEmail } from '../utils/validation';

const EMPTY_FORM = { name: '', mobile: '', email: '', dob: '', gender: '', customerType: '', address: '', notes: '' };

function CustomerForm({ user, profile, initialValues = EMPTY_FORM, editingCustomer = null, onSaved, onCancel, onSelectExisting, formId = 'customer-form', showActions = true, onBusyChange }) {
  const [formData, setFormData] = useState({ ...EMPTY_FORM, ...initialValues });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [duplicateCustomer, setDuplicateCustomer] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData({ ...EMPTY_FORM, ...initialValues });
    setErrors({});
    setSubmitError('');
    setDuplicateCustomer(null);
  }, [initialValues]);

  const updateField = (field, value) => {
    setFormData(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: '' }));
    setSubmitError('');
    if (field === 'mobile') setDuplicateCustomer(null);
  };

  const validate = () => {
    const nextErrors = {};
    if (!isValidName(formData.name)) nextErrors.name = 'Enter a name between 2 and 60 characters.';
    if (!formData.mobile || !isValidMobile(formData.mobile)) nextErrors.mobile = 'Enter a valid 10-digit mobile starting with 6-9.';
    if (!isValidEmail(formData.email)) nextErrors.email = 'Enter a valid email address.';
    if (!isValidDob(formData.dob)) nextErrors.dob = 'Date of birth cannot be in the future.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    onBusyChange?.(true);
    setSubmitError('');
    setDuplicateCustomer(null);
    const payload = { ...formData, name: formData.name.trim(), mobile: normalizeMobile(formData.mobile) };
    try {
      const existing = await customerAPI.findByMobile(user.uid, payload.mobile);
      if (existing && existing.id !== editingCustomer?.id) {
        setDuplicateCustomer(existing);
        setErrors(current => ({ ...current, mobile: 'A customer with this mobile number already exists.' }));
        return;
      }
      const result = editingCustomer
        ? await customerAPI.update(user.uid, editingCustomer.id, payload).then(() => ({ id: editingCustomer.id, customerId: editingCustomer.customerId }))
        : await customerAPI.create(user.uid, payload, { customerPrefix: profile?.customerPrefix });
      onSaved({ ...payload, ...result });
    } catch (error) {
      console.error('Save customer failed:', error);
      setSubmitError('Unable to create customer. Please try again.');
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate>
      <div className="form-group">
        <label htmlFor="customer-name">Customer Name *</label>
        <input id="customer-name" type="text" maxLength={60} autoFocus value={formData.name} onChange={e => updateField('name', e.target.value)} />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </div>
      <div className="form-group">
        <label htmlFor="customer-mobile">Mobile Number *</label>
        <input id="customer-mobile" type="tel" inputMode="numeric" maxLength={12} placeholder="10-digit mobile" value={formData.mobile} onChange={e => updateField('mobile', e.target.value.replace(/[^0-9+ ]/g, ''))} />
        {errors.mobile && <span className="field-error">{errors.mobile}</span>}
        {duplicateCustomer && <div className="customer-duplicate-notice">This mobile belongs to <strong>{duplicateCustomer.name}</strong>. <button type="button" onClick={() => onSelectExisting?.(duplicateCustomer)}>Use existing customer</button></div>}
      </div>
      <div className="form-group">
        <label htmlFor="customer-email">Email <span className="form-optional">Optional</span></label>
        <input id="customer-email" type="email" maxLength={254} placeholder="customer@example.com" value={formData.email} onChange={e => updateField('email', e.target.value)} />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </div>
      <div className="form-group">
        <label htmlFor="customer-dob">Date of Birth</label>
        <input id="customer-dob" type="date" max={new Date().toISOString().slice(0, 10)} value={formData.dob} onChange={e => updateField('dob', e.target.value)} />
        {errors.dob && <span className="field-error">{errors.dob}</span>}
      </div>
      <div className="form-group">
        <label htmlFor="customer-gender">Gender</label>
        <select id="customer-gender" value={formData.gender} onChange={e => updateField('gender', e.target.value)}>
          <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="customer-type">Customer Type</label>
        <select id="customer-type" value={formData.customerType} onChange={e => updateField('customerType', e.target.value)}>
          <option value="">Select</option><option value="Individual">Individual</option><option value="Business">Business</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="customer-address">Address</label>
        <textarea id="customer-address" maxLength={240} rows={2} value={formData.address} onChange={e => updateField('address', e.target.value)} />
      </div>
      <div className="form-group">
        <label htmlFor="customer-notes">Notes</label>
        <textarea id="customer-notes" maxLength={500} rows={3} placeholder="Useful notes about this customer" value={formData.notes} onChange={e => updateField('notes', e.target.value)} />
      </div>
      {submitError && <div className="form-submit-error">{submitError}</div>}
      {showActions && <div className="customer-form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}><i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-user-plus'}`}></i> {saving ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Add Customer'}</button>
      </div>}
    </form>
  );
}

export default CustomerForm;
