const { getAdminClient } = require('../lib/supabase');
const { getISTDate } = require('../utils/timezone');

const PAGE = 1000;
const IST = '+05:30';

/**
 * Page through every matching row (Supabase caps a request at 1000 rows) so
 * reports are never silently truncated. Always scoped to one tenant.
 */
async function fetchRows(table, uid, columns, bounds) {
  const client = getAdminClient();
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let q = client.from(table).select(columns).eq('user_id', uid);
    if (bounds && bounds.from) q = q.gte('created_at', bounds.from);
    if (bounds && bounds.to) q = q.lte('created_at', bounds.to);
    q = q.order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    const batch = data || [];
    for (const row of batch) rows.push(row);
    if (batch.length < PAGE) break;
  }
  return rows;
}

/** IST day window: 2026-09-14 -> 00:00:00+05:30 .. 23:59:59.999+05:30 */
const dayBounds = (date) => ({
  from: date + 'T00:00:00' + IST,
  to: date + 'T23:59:59.999' + IST,
});

/** IST month window for the supplied month/year. */
const monthBounds = (month, year) => {
  const m = String(month).padStart(2, '0');
  const lastDay = String(new Date(Number(year), Number(m), 0).getDate()).padStart(2, '0');
  return {
    from: year + '-' + m + '-01T00:00:00' + IST,
    to: year + '-' + m + '-' + lastDay + 'T23:59:59.999' + IST,
  };
};

/** Current IST month/year, as zero-padded strings. */
const istNow = () => {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return {
    month: String(ist.getUTCMonth() + 1).padStart(2, '0'),
    year: String(ist.getUTCFullYear()),
  };
};

const summariseBills = (bills) => {
  const total = bills.length;
  const revenue = bills.reduce((sum, b) => sum + Number(b.final_amount || 0), 0);
  return {
    total_bills: total,
    total_revenue: revenue,
    avg_bill_amount: total ? revenue / total : 0,
  };
};

/** GET /api/reports/daily?date=YYYY-MM-DD */
const getDailyRevenue = async (req, res) => {
  try {
    const date = req.query.date || getISTDate();
    const bills = await fetchRows('bills', req.user.uid, 'final_amount,created_at', dayBounds(date));
    res.json(summariseBills(bills));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** GET /api/reports/monthly?month=MM&year=YYYY */
const getMonthlyRevenue = async (req, res) => {
  try {
    const now = istNow();
    const month = String(req.query.month || now.month).padStart(2, '0');
    const year = String(req.query.year || now.year);
    const bills = await fetchRows('bills', req.user.uid, 'final_amount,created_at', monthBounds(month, year));
    res.json(summariseBills(bills));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * GET /api/reports/top-services?limit=10
 * Bills store their line items as JSON, so the aggregate is computed in JS.
 */
const getTopServices = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const bills = await fetchRows('bills', req.user.uid, 'items');
    const agg = {};

    for (const bill of bills) {
      const list = Array.isArray(bill.items) ? bill.items : [];
      for (const line of list) {
        const key = line.itemId || line.name || 'unknown';
        if (!agg[key]) {
          agg[key] = { item_name: line.name || '', times_sold: 0, total_quantity: 0, total_revenue: 0 };
        }
        agg[key].times_sold += 1;
        agg[key].total_quantity += Number(line.quantity || 0);
        agg[key].total_revenue += Number(line.price || 0) * Number(line.quantity || 0);
      }
    }

    const rows = Object.values(agg)
      .sort((a, b) => b.times_sold - a.times_sold)
      .slice(0, limit);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** GET /api/reports/repeat-customers — customers with more than one visit. */
const getRepeatCustomers = async (req, res) => {
  try {
    const uid = req.user.uid;
    const customers = await fetchRows('customers', uid, 'id,customer_id,name,mobile');
    const bills = await fetchRows('bills', uid, 'customer_id,final_amount,created_at');

    const stats = {};
    for (const bill of bills) {
      if (!bill.customer_id) continue;
      const key = bill.customer_id;
      if (!stats[key]) stats[key] = { visit_count: 0, total_spent: 0, last_visit: null };
      stats[key].visit_count += 1;
      stats[key].total_spent += Number(bill.final_amount || 0);
      if (!stats[key].last_visit || bill.created_at > stats[key].last_visit) {
        stats[key].last_visit = bill.created_at;
      }
    }

    const rows = customers
      .map((c) => {
        const s = stats[c.id] || { visit_count: 0, total_spent: 0, last_visit: null };
        return {
          customer_id: c.customer_id,
          name: c.name,
          mobile: c.mobile,
          visit_count: s.visit_count,
          total_spent: s.total_spent,
          last_visit: s.last_visit,
        };
      })
      .filter((r) => r.visit_count > 1)
      .sort((a, b) => b.visit_count - a.visit_count);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** GET /api/reports/dashboard — headline counters for the signed-in tenant. */
const getDashboardStats = async (req, res) => {
  try {
    const uid = req.user.uid;
    const today = getISTDate();
    const now = istNow();

    const [customers, items, todayBills, monthBills] = await Promise.all([
      fetchRows('customers', uid, 'id'),
      fetchRows('items', uid, 'is_active'),
      fetchRows('bills', uid, 'final_amount', dayBounds(today)),
      fetchRows('bills', uid, 'final_amount', monthBounds(now.month, now.year)),
    ]);

    const sum = (rows) => rows.reduce((s, r) => s + Number(r.final_amount || 0), 0);

    res.json({
      total_customers: customers.length,
      today_bills: todayBills.length,
      today_revenue: sum(todayBills),
      month_revenue: sum(monthBills),
      active_services: items.filter((i) => i.is_active).length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports = {
  getDailyRevenue,
  getMonthlyRevenue,
  getTopServices,
  getRepeatCustomers,
  getDashboardStats,
};