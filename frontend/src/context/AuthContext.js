import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { getSubscription } from '../utils/subscription';
import { clearAll as clearReferenceCache } from '../utils/core/cache';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

// DB row (snake_case) -> app profile (camelCase)
const toProfile = (r) => r && {
  businessName: r.business_name,
  businessType: r.business_type,
  ownerName: r.owner_name,
  phone: r.phone,
  address: r.address,
  city: r.city,
  state: r.state,
  pincode: r.pincode,
  email: r.email,
  gstNumber: r.gst_number,
  panNumber: r.pan_number,
  billPrefix: r.bill_prefix,
  customerPrefix: r.customer_prefix,
  defaultTax: r.default_tax,
  currency: r.currency,
  billFooter: r.bill_footer,
  whatsappNumber: r.whatsapp_number,
  whatsappMessage: r.whatsapp_message,
  showTaxOnBill: r.show_tax_on_bill,
  showGstOnBill: r.show_gst_on_bill,
  allowBillingWithoutCustomer: r.allow_billing_without_customer === true,
};

const toDbProfile = (uid, p) => ({
  user_id: uid,
  business_name: p.businessName || '',
  business_type: p.businessType || 'general',
  owner_name: p.ownerName || '',
  phone: p.phone || '',
  address: p.address || '',
  city: p.city || '',
  state: p.state || '',
  pincode: p.pincode || '',
  email: p.email || '',
  gst_number: p.gstNumber || '',
  pan_number: p.panNumber || '',
  bill_prefix: (p.billPrefix || 'BILL').toUpperCase(),
  customer_prefix: (p.customerPrefix || 'CUST').toUpperCase(),
  default_tax: p.defaultTax ?? '0',
  currency: p.currency || '₹',
  bill_footer: p.billFooter || 'Thank you for shopping with us!',
  whatsapp_number: p.whatsappNumber || '',
  whatsapp_message: p.whatsappMessage || '',
  show_tax_on_bill: p.showTaxOnBill !== false,
  show_gst_on_bill: p.showGstOnBill === true,
  allow_billing_without_customer: p.allowBillingWithoutCustomer === true,
  updated_at: new Date().toISOString(),
});

const saveProfile = async (uid, profile) => {
  const row = toDbProfile(uid, profile);
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update(row)
    .eq('user_id', uid)
    .select('user_id')
    .maybeSingle();
  if (updateError) throw updateError;
  if (updated) return;

  const { error: insertError } = await supabase.from('profiles').insert(row);
  if (insertError) throw insertError;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfileState] = useState(null);
  const [subscription, setSubscription] = useState({ plan: 'free' });
  const [loading, setLoading] = useState(true);

  const loadUserData = async (sbUser) => {
    if (!sbUser) {
      setUser(null);
      setProfileState(null);
      setSubscription({ plan: 'free' });
      clearReferenceCache();
      return;
    }
    setUser({ uid: sbUser.id, email: sbUser.email, displayName: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || '', photoURL: sbUser.user_metadata?.avatar_url || '' });
    const [{ data: profileRow }, sub] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', sbUser.id).maybeSingle(),
      getSubscription(sbUser.id).catch(() => ({ plan: 'free' })),
    ]);
    setProfileState(toProfile(profileRow) || null);
    setSubscription(sub);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      loadUserData(data.session?.user || null).finally(() => setLoading(false));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserData(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const setProfile = async (p) => {
    const sbUser = (await supabase.auth.getUser()).data.user;
    if (sbUser) {
      await saveProfile(sbUser.id, p);
    }
    setProfileState(p);
  };

  const logout = () => {
    clearReferenceCache();
    return supabase.auth.signOut();
  };

  const refreshSubscription = async () => {
    const sbUser = (await supabase.auth.getUser()).data.user;
    if (sbUser) {
      const sub = await getSubscription(sbUser.id);
      setSubscription(sub);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, subscription, refreshSubscription, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
