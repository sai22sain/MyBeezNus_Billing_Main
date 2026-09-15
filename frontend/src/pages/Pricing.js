import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveSubscription, isPro } from '../utils/subscription';
import axios from 'axios';

// When deployed to Vercel the backend runs as serverless functions on the
// SAME origin (see /vercel.json routes), so an empty API_URL = relative
// /api/... calls — no CORS needed. Local dev keeps the localhost fallback.
const API_URL = process.env.REACT_APP_API_URL ?? '';

// Load checkout.js only when the user actually starts an upgrade.
// The script prefetches many asset chunks in the background, so loading it
// globally (in index.html) caused constant network traffic on every page.
const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve();
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = resolve;
  s.onerror = () => reject(new Error('Failed to load payment gateway'));
  document.body.appendChild(s);
});

const FREE_FEATURES = [
  { text: '30 bills per month',        included: true  },
  { text: '50 customers',              included: true  },
  { text: 'WhatsApp sharing',          included: true  },
  { text: 'Basic dashboard',           included: true  },
  { text: 'Full reports & analytics',  included: false },
  { text: 'Excel export',              included: false },
  { text: 'Unlimited bills',           included: false },
  { text: 'Priority support',          included: false },
];

const PRO_FEATURES = [
  { text: 'Unlimited bills',           icon: 'fa-file-invoice'    },
  { text: 'Unlimited customers',       icon: 'fa-users'           },
  { text: 'WhatsApp sharing',          icon: 'fa-whatsapp fab'    },
  { text: 'Full reports & analytics',  icon: 'fa-chart-line'      },
  { text: 'Excel export',              icon: 'fa-file-excel'      },
  { text: 'Priority support',          icon: 'fa-headset'         },
  { text: 'All future features',       icon: 'fa-rocket'          },
];

function Pricing() {
  const { user, subscription, refreshSubscription } = useAuth();
  const [loading, setLoading] = useState(null);

  const handleUpgrade = async (period) => {
    setLoading(period);
    try {
      const plan = period === 'monthly' ? 'pro_monthly' : 'pro_yearly';
      const { data } = await axios.post(`${API_URL}/api/payments/create-order`, { plan, userId: user.uid });

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'MyBeezNus Billing',
        description: `Pro Plan - ${period === 'monthly' ? '₹99/month' : '₹999/year'}`,
        order_id: data.orderId,
        prefill: { name: user.displayName, email: user.email },
        theme: { color: '#6366f1' },
        handler: async (response) => {
          const verifyRes = await axios.post(`${API_URL}/api/payments/verify-payment`, {
            ...response, plan, userId: user.uid
          });
          if (verifyRes.data.success) {
            await saveSubscription(user.uid, verifyRes.data.subscription);
            await refreshSubscription();
            alert('Welcome to Pro! Enjoy unlimited access.');
          }
        },
        modal: { ondismiss: () => setLoading(null) }
      };

      await loadRazorpay();
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Payment failed. Please try again.';
      alert(`Payment failed: ${message}`);
    }
    setLoading(null);
  };

  const proUser = isPro(subscription);

  return (
    <div>
      {/* Header */}
      <div className="pricing-hero">
        <div className="pricing-hero-badge">
          <i className="fas fa-crown"></i> Simple Pricing
        </div>
        <h1 className="pricing-hero-title">
          {proUser ? 'You\'re on Pro' : 'Upgrade to Pro'}
        </h1>
        <p className="pricing-hero-sub">
          {proUser
            ? `Active until ${new Date(subscription.expiresAt).toLocaleDateString('en-IN')}`
            : 'Everything you need to run your business billing — no limits'}
        </p>
      </div>

      {/* Cards */}
      <div className="pricing-grid">

        {/* Free */}
        <div className="pricing-card">
          <div className="pricing-card-header">
            <div className="pricing-plan-icon pricing-plan-icon--free">
              <i className="fas fa-seedling"></i>
            </div>
            <div>
              <div className="pricing-plan-name">Free</div>
              <div className="pricing-plan-desc">Get started, no card needed</div>
            </div>
          </div>
          <div className="pricing-amount">
            <span className="pricing-currency">₹</span>0
            <span className="pricing-period">/ forever</span>
          </div>
          <ul className="pricing-features">
            {FREE_FEATURES.map((f, i) => (
              <li key={i} className={`pricing-feature ${f.included ? '' : 'pricing-feature--off'}`}>
                <span className="pricing-feature-icon">
                  <i className={`fas ${f.included ? 'fa-check' : 'fa-times'}`}></i>
                </span>
                {f.text}
              </li>
            ))}
          </ul>
          <div className="pricing-cta pricing-cta--muted">
            <i className="fas fa-check-circle"></i>
            {!proUser ? 'Current Plan' : 'Free Plan'}
          </div>
        </div>

        {/* Pro */}
        <div className="pricing-card pricing-card--pro">
          <div className="pricing-popular-badge">
            <i className="fas fa-bolt"></i> Most Popular
          </div>
          <div className="pricing-card-header">
            <div className="pricing-plan-icon pricing-plan-icon--pro">
              <i className="fas fa-crown"></i>
            </div>
            <div>
              <div className="pricing-plan-name">Pro</div>
              <div className="pricing-plan-desc" style={{ opacity: 0.75 }}>For growing businesses</div>
            </div>
          </div>
          <div className="pricing-amount">
            <span className="pricing-currency">₹</span>99
            <span className="pricing-period">/ month</span>
          </div>
          <div className="pricing-yearly-note">
            <i className="fas fa-tag"></i> ₹999/year — save 15%
          </div>
          <ul className="pricing-features">
            {PRO_FEATURES.map((f, i) => (
              <li key={i} className="pricing-feature pricing-feature--pro">
                <span className="pricing-feature-icon">
                  <i className={`fas ${f.icon.replace('fab ', '')}`}
                     style={f.icon.startsWith('fab') ? { fontFamily: '"Font Awesome 6 Brands"' } : {}}></i>
                </span>
                {f.text}
              </li>
            ))}
          </ul>

          {proUser ? (
            <div className="pricing-cta pricing-cta--active">
              <i className="fas fa-shield-halved"></i> Active Plan
            </div>
          ) : (
            <div className="pricing-buttons">
              <button className="pricing-btn pricing-btn--primary"
                onClick={() => handleUpgrade('monthly')}
                disabled={!!loading}>
                {loading === 'monthly'
                  ? <><i className="fas fa-spinner fa-spin"></i> Processing...</>
                  : <><i className="fas fa-bolt"></i> Start Monthly — ₹99</>}
              </button>
              <button className="pricing-btn pricing-btn--outline"
                onClick={() => handleUpgrade('yearly')}
                disabled={!!loading}>
                {loading === 'yearly'
                  ? <><i className="fas fa-spinner fa-spin"></i> Processing...</>
                  : <><i className="fas fa-calendar-check"></i> Go Yearly — ₹999 <span className="pricing-save-tag">Save 15%</span></>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Trust strip */}
      <div className="pricing-trust">
        {[
          { icon: 'fa-lock',          text: 'Secure payments via Razorpay' },
          { icon: 'fa-rotate-left',   text: 'Cancel anytime' },
          { icon: 'fa-headset',       text: 'Priority support on Pro' },
          { icon: 'fa-indian-rupee-sign', text: 'INR billing, no hidden fees' },
        ].map((t, i) => (
          <div key={i} className="pricing-trust-item">
            <i className={`fas ${t.icon}`}></i>
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* Subscription details for Pro users */}
      {proUser && (
        <div className="pricing-sub-details">
          <div className="pricing-sub-details-title">
            <i className="fas fa-receipt"></i> Subscription Details
          </div>
          <div className="pricing-sub-grid">
            {[
              { label: 'Plan',       value: 'Pro',                                                    icon: 'fa-crown'         },
              { label: 'Period',     value: subscription.period === 'monthly' ? 'Monthly' : 'Yearly', icon: 'fa-calendar'      },
              { label: 'Paid',       value: `₹${subscription.amount}`,                               icon: 'fa-indian-rupee-sign' },
              { label: 'Started',    value: new Date(subscription.startedAt).toLocaleDateString('en-IN'), icon: 'fa-play'      },
              { label: 'Expires',    value: new Date(subscription.expiresAt).toLocaleDateString('en-IN'), icon: 'fa-hourglass-half' },
              { label: 'Payment ID', value: subscription.paymentId,                                  icon: 'fa-fingerprint'   },
            ].map((item, i) => (
              <div key={i} className="pricing-sub-item">
                <div className="pricing-sub-item-icon">
                  <i className={`fas ${item.icon}`}></i>
                </div>
                <div>
                  <div className="pricing-sub-label">{item.label}</div>
                  <div className="pricing-sub-value">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Pricing;
