import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { normalizeMobile, isValidMobile, isValidName } from '../utils/validation';

const BUSINESS_TYPES = [
  { id: 'salon',      label: 'Salon / Spa',      icon: 'fa-scissors' },
  { id: 'retail',     label: 'Retail / Shop',    icon: 'fa-bag-shopping' },
  { id: 'restaurant', label: 'Restaurant / Cafe', icon: 'fa-utensils' },
  { id: 'grocery',    label: 'Grocery / Kirana', icon: 'fa-basket-shopping' },
  { id: 'pharmacy',   label: 'Pharmacy',         icon: 'fa-pills' },
  { id: 'repair',     label: 'Repair / Services', icon: 'fa-screwdriver-wrench' },
  { id: 'general',    label: 'Other Business',   icon: 'fa-store' },
];

const BUSINESS_NAME_LABELS = {
  salon: 'Salon Name',
  retail: 'Shop / Store Name',
  restaurant: 'Restaurant Name',
  grocery: 'Store Name',
  pharmacy: 'Pharmacy Name',
  repair: 'Business Name',
  general: 'Business Name',
};

const BUSINESS_TEMPLATES = {
  salon: {
    categories: ['Hair', 'Skin', 'Grooming', 'Spa', 'Products'],
    items: [
      { name: 'Haircut', category: 'Hair', price: 200, tax: 0 },
      { name: 'Hair Color', category: 'Hair', price: 800, tax: 18 },
      { name: 'Facial', category: 'Skin', price: 500, tax: 18 },
      { name: 'Shave', category: 'Grooming', price: 100, tax: 0 },
      { name: 'Massage', category: 'Spa', price: 600, tax: 18 },
    ],
  },
  retail: {
    categories: ['Apparel', 'Footwear', 'Accessories'],
    items: [
      { name: 'T-Shirt', category: 'Apparel', price: 499, tax: 5 },
      { name: 'Jeans', category: 'Apparel', price: 1299, tax: 5 },
      { name: 'Sneakers', category: 'Footwear', price: 1999, tax: 18 },
      { name: 'Belt', category: 'Accessories', price: 299, tax: 18 },
    ],
  },
  restaurant: {
    categories: ['Starters', 'Mains', 'Beverages', 'Desserts'],
    items: [
      { name: 'Paneer Tikka', category: 'Starters', price: 220, tax: 5 },
      { name: 'Veg Biryani', category: 'Mains', price: 180, tax: 5 },
      { name: 'Cold Coffee', category: 'Beverages', price: 120, tax: 5 },
      { name: 'Gulab Jamun (4 pc)', category: 'Desserts', price: 100, tax: 5 },
    ],
  },
  grocery: {
    categories: ['Staples', 'Dairy', 'Snacks', 'Household'],
    items: [
      { name: 'Rice 5kg', category: 'Staples', price: 350, tax: 0 },
      { name: 'Milk 1L', category: 'Dairy', price: 66, tax: 0 },
      { name: 'Biscuits Pack', category: 'Snacks', price: 40, tax: 18 },
      { name: 'Detergent 1kg', category: 'Household', price: 140, tax: 18 },
    ],
  },
  pharmacy: {
    categories: ['Tablets', 'Syrups', 'Personal Care'],
    items: [
      { name: 'Paracetamol 650 (strip)', category: 'Tablets', price: 45, tax: 5 },
      { name: 'Cough Syrup 100ml', category: 'Syrups', price: 110, tax: 5 },
      { name: 'Hand Sanitizer 200ml', category: 'Personal Care', price: 99, tax: 18 },
    ],
  },
  repair: {
    categories: ['Labour', 'Spares', 'Accessories'],
    items: [
      { name: 'General Service Charge', category: 'Labour', price: 300, tax: 18 },
      { name: 'Screen Replacement', category: 'Spares', price: 1500, tax: 18 },
      { name: 'Charger', category: 'Accessories', price: 499, tax: 18 },
    ],
  },
  general: {
    categories: ['General'],
    items: [],
  },
};

function Onboarding() {
  const { user, setProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [businessType, setBusinessType] = useState('salon');
  const [businessData, setBusinessData] = useState({
    businessName: '',
    ownerName: user?.displayName || '',
    phone: '',
    address: '',
    city: '',
  });

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  /* Step-1 gate: keep users from advancing with invalid contact details. */
  const step1Valid = isValidName(businessData.businessName)
    && isValidName(businessData.ownerName)
    && isValidMobile(businessData.phone);

  const handleFinish = async () => {
    // ---- validation (defence in depth; step 1 already gated) ----
    if (!isValidName(businessData.businessName)) { alert('Business name must be 2-60 characters.'); setStep(1); return; }
    if (!isValidName(businessData.ownerName)) { alert('Owner name must be 2-60 characters.'); setStep(1); return; }
    if (!isValidMobile(businessData.phone)) { alert('Enter a valid 10-digit mobile number starting with 6-9.'); setStep(1); return; }
    setLoading(true);
    try {
      const uid = user.uid;
      const template = BUSINESS_TEMPLATES[businessType] || BUSINESS_TEMPLATES.general;

      // Save business profile (AuthContext.setProfile persists to Supabase)
      const profileData = {
        ...businessData,
        phone: normalizeMobile(businessData.phone),
        businessType,
        email: user.email,
      };
      await setProfile(profileData);

      // Save default categories, keep id -> name map for items
      const catIdByName = {};
      for (const cat of template.categories) {
        const { data, error } = await supabase
          .from('categories')
          .insert({ user_id: uid, name: cat })
          .select()
          .single();
        if (error) throw error;
        catIdByName[cat] = data.id;
      }

      // Save default items
      for (const item of template.items) {
        const { error } = await supabase.from('items').insert({
          user_id: uid,
          name: item.name,
          category_id: catIdByName[item.category] || null,
          price: item.price,
          tax: item.tax || 0,
          is_active: true,
        });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Onboarding error:', err);
    }
    setLoading(false);
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 15px',
    borderRadius: '10px',
    border: '2px solid #e0e0e0',
    fontSize: '15px',
    outline: 'none',
    transition: 'border 0.2s',
    boxSizing: 'border-box'
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '50px 40px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '35px' }}>
          {[1, 2, 3, 4].map(s => (
            <div key={s} style={{
              flex: 1,
              height: '5px',
              borderRadius: '3px',
              background: s <= step ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#e0e0e0',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>

        {/* Step 1: Business type */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{
                width: '70px', height: '70px', borderRadius: '18px',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <i className="fas fa-store" style={{ fontSize: '30px', color: 'white' }}></i>
              </div>
              <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#2c3e50', marginBottom: '8px' }}>
                Welcome, {user?.displayName?.split(' ')[0]}! 👋
              </h2>
              <p style={{ color: '#666', fontSize: '15px' }}>
                What kind of business do you run?
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {BUSINESS_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setBusinessType(t.id)}
                  style={{
                    padding: '14px 10px', borderRadius: '12px',
                    border: businessType === t.id ? '2px solid #667eea' : '2px solid #e0e0e0',
                    background: businessType === t.id ? '#eef2ff' : 'white',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '8px',
                    fontSize: '13px', fontWeight: '600',
                    color: businessType === t.id ? '#4338ca' : '#555'
                  }}
                >
                  <i className={`fas ${t.icon}`} style={{ fontSize: '22px', color: businessType === t.id ? '#667eea' : '#999' }}></i>
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleNext}
              style={{
                width: '100%', marginTop: '25px', padding: '14px',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white', border: 'none', borderRadius: '12px',
                fontSize: '16px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Next →
            </button>
          </div>
        )}

        {/* Step 2: Business details */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{
                width: '70px', height: '70px', borderRadius: '18px',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <i className="fas fa-id-card" style={{ fontSize: '30px', color: 'white' }}></i>
              </div>
              <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#2c3e50', marginBottom: '8px' }}>
                Business Details
              </h2>
              <p style={{ color: '#666', fontSize: '15px' }}>
                Set up your business in just 2 minutes
              </p>
            </div>
            <div style={{ display: 'grid', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>
                  {BUSINESS_NAME_LABELS[businessType] || 'Business Name'} *
                </label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Glamour Studio"
                  value={businessData.businessName}
                  onChange={(e) => setBusinessData({ ...businessData, businessName: e.target.value })}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>
                  Owner Name *
                </label>
                <input
                  style={inputStyle}
                  placeholder="Your name"
                  value={businessData.ownerName}
                  onChange={(e) => setBusinessData({ ...businessData, ownerName: e.target.value })}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>
                  Phone Number *
                </label>
                <input
                  style={inputStyle}
                  type="tel"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="10-digit mobile number"
                  value={businessData.phone}
                  onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value.replace(/[^0-9+ ]/g, '') })}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '25px' }}>
              <button onClick={handleBack} style={{
                flex: 1, padding: '14px', background: '#f0f0f0',
                color: '#555', border: 'none', borderRadius: '12px',
                fontSize: '16px', fontWeight: '600', cursor: 'pointer'
              }}>
                ← Back
              </button>
              <button
                onClick={handleNext}
                disabled={!step1Valid}
                style={{
                  flex: 2, padding: '14px',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white', border: 'none', borderRadius: '12px',
                  fontSize: '16px', fontWeight: '600', cursor: 'pointer',
                  opacity: step1Valid ? 1 : 0.5
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Address */}
        {step === 3 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{
                width: '70px', height: '70px', borderRadius: '18px',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <i className="fas fa-map-marker-alt" style={{ fontSize: '30px', color: 'white' }}></i>
              </div>
              <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#2c3e50', marginBottom: '8px' }}>
                Business Location
              </h2>
              <p style={{ color: '#666', fontSize: '15px' }}>This will appear on your bills</p>
            </div>

            <div style={{ display: 'grid', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>
                  Address
                </label>
                <textarea
                  style={{ ...inputStyle, height: '90px', resize: 'none' }}
                  placeholder="Street address"
                  value={businessData.address}
                  onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>
                  City
                </label>
                <input
                  style={inputStyle}
                  placeholder="City"
                  value={businessData.city}
                  onChange={(e) => setBusinessData({ ...businessData, city: e.target.value })}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '25px' }}>
              <button onClick={handleBack} style={{
                flex: 1, padding: '14px', background: '#f0f0f0',
                color: '#555', border: 'none', borderRadius: '12px',
                fontSize: '16px', fontWeight: '600', cursor: 'pointer'
              }}>
                ← Back
              </button>
              <button onClick={handleNext} style={{
                flex: 2, padding: '14px',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white', border: 'none', borderRadius: '12px',
                fontSize: '16px', fontWeight: '600', cursor: 'pointer'
              }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Ready */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '70px', height: '70px', borderRadius: '18px',
              background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <i className="fas fa-check" style={{ fontSize: '30px', color: 'white' }}></i>
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#2c3e50', marginBottom: '8px' }}>
              All Set!
            </h2>
            <p style={{ color: '#666', fontSize: '15px', marginBottom: '30px' }}>
              We'll set up your account with default items and categories for your business type. You can customize everything later.
            </p>

            <div style={{
              background: '#f8f9fa', borderRadius: '12px', padding: '20px',
              textAlign: 'left', marginBottom: '25px'
            }}>
              <p style={{ fontWeight: '600', marginBottom: '10px', color: '#2c3e50' }}>
                <i className="fas fa-store" style={{ marginRight: '8px', color: '#667eea' }}></i>
                {businessData.businessName}
              </p>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '6px' }}>
                <i className="fas fa-user" style={{ marginRight: '8px' }}></i>
                {businessData.ownerName}
              </p>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '6px' }}>
                <i className="fas fa-phone" style={{ marginRight: '8px' }}></i>
                {businessData.phone}
              </p>
              {businessData.city && (
                <p style={{ color: '#666', fontSize: '14px' }}>
                  <i className="fas fa-map-marker-alt" style={{ marginRight: '8px' }}></i>
                  {businessData.city}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleBack} style={{
                flex: 1, padding: '14px', background: '#f0f0f0',
                color: '#555', border: 'none', borderRadius: '12px',
                fontSize: '16px', fontWeight: '600', cursor: 'pointer'
              }}>
                ← Back
              </button>
              <button
                onClick={handleFinish}
                disabled={loading}
                style={{
                  flex: 2, padding: '14px',
                  background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                  color: 'white', border: 'none', borderRadius: '12px',
                  fontSize: '16px', fontWeight: '600', cursor: 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Setting up...' : '🚀 Launch My Business'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Onboarding;
