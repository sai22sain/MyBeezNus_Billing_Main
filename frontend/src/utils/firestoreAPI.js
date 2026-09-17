import { supabase } from '../supabase';
import { backendAPI } from './backend';
import { cachedFetch, invalidate, CACHE_TTL } from './core/cache';

export const cacheKeys = {
  categories: 'categories',
  activeItems: 'active_items',
};

/** Drop cached reference data (call after any item/category mutation). */
export const invalidateReferenceCache = (uid) => {
  invalidate(uid, cacheKeys.categories);
  invalidate(uid, cacheKeys.activeItems);
};

// Row mappers: DB (snake_case) -> app (camelCase)
const toCustomer = (r) => r && {
  id: r.id,
  customerId: r.customer_id,
  name: r.name,
  mobile: r.mobile,
  dob: r.dob,
  gender: r.gender,
  address: r.address || '',
  notes: r.notes || '',
  customerType: r.customer_type || '',
  createdAt: r.created_at,
};

const toItem = (r, catName = '') => r && {
  id: r.id,
  categoryId: r.category_id,
  categoryName: catName,
  name: r.name,
  price: Number(r.price),
  tax: Number(r.tax),
  isActive: r.is_active,
  createdAt: r.created_at,
};

const toCategory = (r) => r && { id: r.id, name: r.name };

const toBill = (r) => r && {
  id: r.id,
  billNumber: r.bill_number,
  customerId: r.customer_id,
  customerName: r.customer_name,
  customerMobile: r.customer_mobile || '',
  items: r.items || [],
  discount: Number(r.discount),
  paymentMode: r.payment_mode,
  totalAmount: Number(r.total_amount),
  tax: Number(r.tax),
  finalAmount: Number(r.final_amount),
  createdAt: r.created_at,
};

// ─── CUSTOMERS ───────────────────────────────────────────────
export const customerAPI = {
  getAll: async (uid) => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCustomer);
  },
  search: async (uid, queryStr) => {
    const q = queryStr.toLowerCase();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', uid)
      .or(`name.ilike.%${q}%,mobile.ilike.%${q}%`);
    if (error) throw error;
    return (data || []).map(toCustomer);
  },
  findByMobile: async (uid, mobile) => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', uid)
      .eq('mobile', mobile)
      .limit(1);
    if (error) throw error;
    return toCustomer(data?.[0]);
  },
  getById: async (uid, id) => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', uid)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return toCustomer(data);
  },
  create: async (uid, data, opts = {}) => {
    // Prefix comes from the caller's profile context when provided, so we
    // don't re-fetch profiles on every create. Fall back to a DB read.
    let prefix = (opts.customerPrefix || '').toUpperCase();
    const backendPromise = backendAPI.nextCustomerNumber().catch(() => null);
    if (!prefix) {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('customer_prefix')
        .eq('user_id', uid)
        .maybeSingle();
      prefix = ((profileRow || {}).customer_prefix || 'CUST').toUpperCase();
    }
    const backendRes = await backendPromise;
    let customerId = backendRes?.number;
    if (!customerId) {
      throw new Error('Unable to allocate a globally unique customer number. Please try again.');
    }

    const { data: row, error } = await supabase
      .from('customers')
      .insert({
        user_id: uid,
        customer_id: customerId,
        name: data.name || '',
        mobile: data.mobile || '',
        dob: data.dob || '',
        gender: data.gender || '',
        address: data.address || '',
        notes: data.notes || '',
        customer_type: data.customerType || '',
      })
      .select()
      .single();
    if (error) throw error;
    return { id: row.id, customerId };
  },
  update: async (uid, id, data) => {
    const { error } = await supabase
      .from('customers')
      .update({
        name: data.name,
        mobile: data.mobile,
        dob: data.dob,
        gender: data.gender,
        address: data.address || '',
        notes: data.notes || '',
        customer_type: data.customerType || '',
      })
      .eq('user_id', uid)
      .eq('id', id);
    if (error) throw error;
  },
  delete: async (uid, id) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('user_id', uid)
      .eq('id', id);
    if (error) throw error;
  },
  getHistory: async (uid, customerId) => {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', uid)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toBill);
  },
  getSummary: async (uid, customerId) => {
    const { data, error, count } = await supabase
      .from('bills')
      .select('id,bill_number,final_amount,created_at', { count: 'exact' })
      .eq('user_id', uid)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    const bills = data || [];
    return {
      totalBills: count || 0,
      recentBills: bills.map(bill => ({
        id: bill.id,
        billNumber: bill.bill_number,
        finalAmount: Number(bill.final_amount || 0),
        createdAt: bill.created_at,
      })),
    };
  },
  getBirthdays: async (uid) => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', uid);
    if (error) throw error;
    return (data || [])
      .map(toCustomer)
      .filter(c => c.dob && c.dob.endsWith(`-${mm}-${dd}`));
  }
};

// ─── ITEMS ───────────────────────────────────────────────────
export const itemAPI = {
  getAll: async (uid) => {
    // Categories come from the shared per-user cache (5-min TTL).
    const cats = await itemAPI.getCategories(uid);
    const catMap = {};
    cats.forEach(c => { catMap[c.id] = c.name; });
    const { data, error } = await supabase.from('items').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => toItem(r, catMap[r.category_id] || ''));
  },
  getActive: async (uid) => {
    const all = await itemAPI.getAll(uid);
    return all.filter(i => i.isActive);
  },
  create: async (uid, data) => {
    const { error } = await supabase.from('items').insert({
      user_id: uid,
      name: data.name,
      category_id: data.categoryId || null,
      price: data.price || 0,
      tax: data.tax || 0,
      is_active: data.isActive !== false,
    });
    if (error) throw error;
  },
  update: async (uid, id, data) => {
    const { error } = await supabase
      .from('items')
      .update({
        name: data.name,
        category_id: data.categoryId || null,
        price: data.price || 0,
        tax: data.tax || 0,
        is_active: data.isActive !== false,
      })
      .eq('user_id', uid)
      .eq('id', id);
    if (error) throw error;
  },
  delete: async (uid, id) => {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('user_id', uid)
      .eq('id', id);
    if (error) throw error;
    invalidateReferenceCache(uid);
  },
  toggleStatus: async (uid, id, current) => {
    const { error } = await supabase
      .from('items')
      .update({ is_active: !current })
      .eq('user_id', uid)
      .eq('id', id);
    if (error) throw error;
    invalidateReferenceCache(uid);
  },
  getCategories: (uid) =>
    cachedFetch(uid, cacheKeys.categories, CACHE_TTL.categories, async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', uid)
        .order('name');
      if (error) throw error;
      return (data || []).map(toCategory);
    }),
  createCategory: async (uid, name) => {
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: uid, name })
      .select()
      .single();
    if (error) throw error;
    invalidateReferenceCache(uid);
    return toCategory(data);
  },
  deleteCategory: async (uid, id) => {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('user_id', uid)
      .eq('id', id);
    if (error) throw error;
    invalidateReferenceCache(uid);
  }
};

// ─── BILLS ───────────────────────────────────────────────────
export const billAPI = {
  getAll: async (uid) => {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toBill);
  },
  getById: async (uid, id) => {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', uid)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return toBill(data);
  },
  create: async (uid, data, opts = {}) => {
    // Prefix comes from the caller's profile context when provided.
    let prefix = (opts.billPrefix || '').toUpperCase();
    const backendPromise = backendAPI.nextBillNumber().catch(() => null);
    if (!prefix) {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('bill_prefix')
        .eq('user_id', uid)
        .maybeSingle();
      prefix = ((profileRow || {}).bill_prefix || 'BILL').toUpperCase();
    }
    const backendRes = await backendPromise;
    let billNumber = backendRes?.number;
    if (!billNumber) {
      throw new Error('Unable to allocate your bill number. Please try again.');
    }

    const { data: row, error } = await supabase
      .from('bills')
      .insert({
        user_id: uid,
        bill_number: billNumber,
        customer_id: data.customerId || null,
        customer_name: data.customerName || '',
        customer_mobile: data.customerMobile || '',
        items: data.items || [],
        discount: data.discount || 0,
        payment_mode: data.paymentMode || 'Cash',
        total_amount: data.totalAmount || 0,
        tax: data.tax || 0,
        final_amount: data.finalAmount || 0,
      })
      .select()
      .single();
    if (error) throw error;
    return { id: row.id, billNumber };
  },
  update: async (uid, id, data) => {
    const { error } = await supabase
      .from('bills')
      .update({
        customer_name: data.customerName,
        items: data.items,
        discount: data.discount,
        payment_mode: data.paymentMode,
        total_amount: data.totalAmount,
        tax: data.tax,
        final_amount: data.finalAmount,
      })
      .eq('user_id', uid)
      .eq('id', id);
    if (error) throw error;
  },
  delete: async (uid, id) => {
    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('user_id', uid)
      .eq('id', id);
    if (error) throw error;
  }
};

// ─── REPORTS ─────────────────────────────────────────────────
export const reportAPI = {
  getDashboard: async (uid) => {
    const today = new Date().toLocaleDateString('en-CA');
    const mm = String(new Date().getMonth() + 1).padStart(2, '0');
    const yyyy = String(new Date().getFullYear());

    const [{ data: bills, error: billsErr }, { count: custCount }, { count: activeItems }] = await Promise.all([
      supabase.from('bills').select('final_amount,created_at').eq('user_id', uid),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('items').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('is_active', true),
    ]);
    if (billsErr) throw billsErr;

    const dayOf = (iso) => (iso || '').split('T')[0];
    const todayBills = (bills || []).filter(b => dayOf(b.created_at) === today);
    const monthBills = (bills || []).filter(b => dayOf(b.created_at).startsWith(`${yyyy}-${mm}`));

    return {
      today_bills: todayBills.length,
      today_revenue: todayBills.reduce((s, b) => s + Number(b.final_amount || 0), 0),
      month_revenue: monthBills.reduce((s, b) => s + Number(b.final_amount || 0), 0),
      total_customers: custCount || 0,
      active_items: activeItems || 0
    };
  },

  getDailyRevenue: async (uid, date) => {
    const target = date || new Date().toLocaleDateString('en-CA');
    const { data, error } = await supabase
      .from('bills')
      .select('final_amount,created_at')
      .eq('user_id', uid);
    if (error) throw error;
    const bills = (data || []).filter(b => (b.created_at || '').split('T')[0] === target);
    const total = bills.reduce((s, b) => s + Number(b.final_amount || 0), 0);
    return {
      total_bills: bills.length,
      total_revenue: total,
      avg_bill_amount: bills.length ? total / bills.length : 0
    };
  },

  getMonthlyRevenue: async (uid, month, year) => {
    const mm = String(month).padStart(2, '0');
    const yyyy = String(year);
    const { data, error } = await supabase
      .from('bills')
      .select('final_amount,created_at')
      .eq('user_id', uid);
    if (error) throw error;
    const bills = (data || []).filter(b => ((b.created_at || '').split('T')[0] || '').startsWith(`${yyyy}-${mm}`));
    const total = bills.reduce((s, b) => s + Number(b.final_amount || 0), 0);
    return {
      total_bills: bills.length,
      total_revenue: total,
      avg_bill_amount: bills.length ? total / bills.length : 0
    };
  },

  getTopItems: async (uid) => {
    const { data, error } = await supabase
      .from('bills')
      .select('items')
      .eq('user_id', uid);
    if (error) throw error;
    const counts = {};
    (data || []).forEach(b => {
      (b.items || []).forEach(item => {
        if (!counts[item.name]) counts[item.name] = { item_name: item.name, times_sold: 0, total_quantity: 0, total_revenue: 0 };
        counts[item.name].times_sold += 1;
        counts[item.name].total_quantity += item.quantity;
        counts[item.name].total_revenue += item.price * item.quantity;
      });
    });
    return Object.values(counts).sort((a, b) => b.times_sold - a.times_sold);
  },

  getRepeatCustomers: async (uid) => {
    const [{ data: bills, error: billsErr }, { data: customers, error: custErr }] = await Promise.all([
      supabase.from('bills').select('customer_id,final_amount,created_at').eq('user_id', uid),
      supabase.from('customers').select('*').eq('user_id', uid),
    ]);
    if (billsErr) throw billsErr;
    if (custErr) throw custErr;
    const map = {};
    (customers || []).forEach(r => {
      const c = toCustomer(r);
      map[c.id] = { ...c, visit_count: 0, total_spent: 0, last_visit: null };
    });
    (bills || []).forEach(b => {
      const c = map[b.customer_id];
      if (c) {
        c.visit_count += 1;
        c.total_spent += Number(b.final_amount || 0);
        if (!c.last_visit || b.created_at > c.last_visit) {
          c.last_visit = b.created_at;
        }
      }
    });
    return Object.values(map).filter(c => c.visit_count > 1).sort((a, b) => b.visit_count - a.visit_count);
  }
};
