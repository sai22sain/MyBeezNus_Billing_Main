require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3001;

const PAGE = 1000;

/* Tables that hold per-tenant data. Deleted child-first. */
const USER_TABLES = ['bills', 'customers', 'items', 'categories', 'sequences', 'profiles'];

const dayKey = (iso) => String(iso || '').slice(0, 10);

/* ------------------------------------------------------------------ */
/* Supabase service-role client (bypasses RLS - server side only)      */
/* ------------------------------------------------------------------ */
let adminClient = null;

function getAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars');
  }
  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/* ------------------------------------------------------------------ */
/* Read helpers                                                        */
/* ------------------------------------------------------------------ */

/** Read every row of `columns` from `table`, paging past the 1000-row cap. */
async function fetchAll(table, columns) {
  const client = getAdmin();
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = data || [];
    for (const row of batch) rows.push(row);
    if (batch.length < PAGE) break;
  }
  return rows;
}

/** Same as fetchAll, but returns [] when the table has not been migrated yet. */
async function fetchAllSafe(table, columns) {
  try {
    return await fetchAll(table, columns);
  } catch (e) {
    console.warn('[fetchAllSafe] ' + table + ': ' + e.message);
    return [];
  }
}

/** Exact row count for a table, optionally scoped to one user. */
async function countSafe(table, uid) {
  try {
    const client = getAdmin();
    let q = client.from(table).select('*', { count: 'exact', head: true });
    if (uid) q = q.eq('user_id', uid);
    const { count, error } = await q;
    if (error) return 0;
    return count || 0;
  } catch (e) {
    return 0;
  }
}

/** Every Supabase Auth user, paged. */
async function listAuthUsers() {
  const client = getAdmin();
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw error;
    const batch = (data && data.users) || [];
    for (const u of batch) users.push(u);
    if (batch.length < PAGE) break;
  }
  return users;
}

/* ------------------------------------------------------------------ */
/* Deletion helpers                                                    */
/* ------------------------------------------------------------------ */

/** Delete every Supabase row owned by `uid`, child tables first. */
async function deleteSupabaseData(uid) {
  const client = getAdmin();
  for (const table of USER_TABLES) {
    const { error } = await client.from(table).delete().eq('user_id', uid);
    if (!error) continue;
    // A table that has not been migrated yet must not abort the whole delete.
    const msg = String(error.message || error.details || '');
    if (/does not exist|schema cache|find the table/i.test(msg)) {
      console.warn('[deleteSupabaseData] skipped missing table: ' + table);
      continue;
    }
    throw error;
  }
}

/** Remove the Supabase Auth account (revokes all refresh tokens). */
async function deleteAuthUser(uid) {
  const { error } = await getAdmin().auth.admin.deleteUser(uid);
  if (error) throw error;
}

/**
 * Wipe the legacy single-tenant SQLite database. That schema has no user_id
 * column, so the whole dataset is cleared for any account deletion.
 */
function wipeSqlite() {
  return new Promise((resolve) => {
    if (!fs.existsSync(SQLITE_DB_PATH)) {
      resolve({ wiped: false, reason: 'SQLite file not found at ' + SQLITE_DB_PATH });
      return;
    }
    let sqlite3;
    try {
      sqlite3 = require('sqlite3').verbose();
    } catch (e) {
      resolve({ wiped: false, reason: 'sqlite3 module is not installed' });
      return;
    }
    const db = new sqlite3.Database(SQLITE_DB_PATH);
    const tables = ['bill_items', 'bills', 'customers', 'items', 'categories'];
    db.serialize(() => {
      for (const t of tables) {
        db.run('DELETE FROM ' + t, (err) => {
          if (err) console.error('[wipeSqlite] ' + t + ': ' + err.message);
        });
      }
      db.run('DELETE FROM sqlite_sequence', () => {});
      db.run('VACUUM', () => {});
      db.close(() => resolve({ wiped: true, path: SQLITE_DB_PATH }));
    });
  });
}

/** Best-effort audit row (survives the cascade delete of the auth user). */
async function writeAuditLog(row) {
  try {
    const { error } = await getAdmin().from('deleted_accounts').insert(row);
    if (error) throw error;
  } catch (e) {
    console.warn('[writeAuditLog] ' + e.message);
  }
}

/**
 * Permanently remove one account:
 *   audit log -> Supabase tables -> Supabase Auth user.
 */
async function purgeAccount(uid, opts) {
  const options = opts || {};

  const profiles = await fetchAllSafe('profiles', 'user_id, business_name, owner_name, phone, email');
  const profile = profiles.find((p) => p.user_id === uid) || {};

  const counts = await Promise.all([
    countSafe('bills', uid),
    countSafe('customers', uid),
    countSafe('items', uid),
    countSafe('categories', uid),
  ]);

  await writeAuditLog({
    user_id: uid,
    email: options.email || profile.email || '',
    business_name: profile.business_name || '',
    owner_name: profile.owner_name || '',
    phone: profile.phone || '',
    bills_count: counts[0],
    customers_count: counts[1],
    deleted_by: options.deletedBy || 'admin-dashboard',
    notes: options.notes || null,
  });

  await deleteSupabaseData(uid);
  await deleteAuthUser(uid);

  return {
    profile: {
      businessName: profile.business_name || '',
      email: options.email || profile.email || '',
    },
    counts: {
      bills: counts[0],
      customers: counts[1],
      items: counts[2],
      categories: counts[3],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Snapshot: one pass over the data, reused by the read endpoints      */
/* ------------------------------------------------------------------ */
async function buildSnapshot() {
  const results = await Promise.all([
    listAuthUsers(),
    fetchAllSafe('profiles', 'user_id, business_name, owner_name, phone, email, city, created_at'),
    fetchAllSafe('delete_requests', 'id, user_id, status, requested_at, reviewed_at, admin_notes'),
    fetchAllSafe('deleted_accounts',
      'id, user_id, email, business_name, bills_count, customers_count, deleted_at, deleted_by'),
    fetchAllSafe('support_tickets',
      'id, user_id, app, category, subject, message, status, admin_reply, created_at, updated_at'),
  ]);

  const authUsers = results[0];
  const profiles = results[1];
  const requests = results[2];
  const deleted = results[3];
  const tickets = results[4];

  const profileByUid = {};
  for (const p of profiles) profileByUid[p.user_id] = p;

  /* Active = has completed onboarding (created a business profile).
     The CRM shows contact info only - never the customer's business data. */
  const users = authUsers
    .filter((u) => profileByUid[u.id] && profileByUid[u.id].business_name)
    .map((u) => {
      const p = profileByUid[u.id];
      return {
        uid: u.id,
        email: u.email || p.email || '',
        businessName: p.business_name || '',
        ownerName: p.owner_name || '',
        phone: p.phone || '',
        city: p.city || '',
        createdAt: u.created_at || p.created_at || null,
        lastSignInAt: u.last_sign_in_at || null,
      };
    });

  const stats = {
    activeUsers: users.length,
    totalSignups: authUsers.length,
    openTickets: tickets.filter((t) => t.status === 'open').length,
    inProgressTickets: tickets.filter((t) => t.status === 'in_progress').length,
    resolvedTickets: tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
    pendingRequests: requests.filter((r) => r.status === 'pending').length,
    approvedRequests: requests.filter((r) => r.status === 'approved').length,
    rejectedRequests: requests.filter((r) => r.status === 'rejected').length,
    deletedAccounts: deleted.length,
  };

  return {
    stats: stats,
    users: users,
    requests: requests,
    deleted: deleted,
    tickets: tickets,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Express app                                                         */
/* ------------------------------------------------------------------ */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/** Wrap an async handler so a rejection becomes a 500 JSON response. */
const route = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error('[api] ' + (err && err.message));
    if (res.headersSent) return next(err);
    res.status(500).json({ error: (err && err.message) || 'Internal error' });
  });
};

/**
 * Optional shared-secret guard. Local use stays wide open (ADMIN_TOKEN unset).
 * Setting ADMIN_TOKEN on Render protects the public URL: the dashboard then
 * asks for the token once and keeps it in localStorage.
 */
function adminGuard(req, res, next) {
  const token = process.env.ADMIN_TOKEN || '';
  if (!token) return next();
  const sent = req.get('x-admin-token') || req.query.token || '';
  if (sent === token) return next();
  return res.status(401).json({ error: 'Admin token required' });
}

app.use('/api/admin', adminGuard);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

/** Everything the dashboard needs, in a single round trip. */
app.get('/api/admin/snapshot', route(async (_req, res) => {
  res.json(await buildSnapshot());
}));

app.get('/api/admin/stats', route(async (_req, res) => {
  const snap = await buildSnapshot();
  res.json(snap.stats);
}));

app.get('/api/admin/users', route(async (_req, res) => {
  const snap = await buildSnapshot();
  res.json({ users: snap.users, stats: snap.stats });
}));

app.get('/api/admin/deleted', route(async (_req, res) => {
  const snap = await buildSnapshot();
  res.json({ deleted: snap.deleted });
}));

app.get('/api/admin/requests', route(async (_req, res) => {
  const snap = await buildSnapshot();
  const byUid = {};
  for (const u of snap.users) byUid[u.uid] = u;

  const rows = snap.requests.map((r) => {
    const u = byUid[r.user_id] || {};
    return {
      id: r.id,
      userId: r.user_id,
      status: r.status,
      requestedAt: r.requested_at,
      reviewedAt: r.reviewed_at,
      adminNotes: r.admin_notes,
      email: u.email || '',
      businessName: u.businessName || '',
    };
  });

  rows.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (b.status === 'pending' && a.status !== 'pending') return 1;
    return String(b.requestedAt).localeCompare(String(a.requestedAt));
  });

  res.json({ requests: rows });
}));

/** Approve a request: mark it approved, then purge the whole account. */
app.post('/api/admin/requests/:id/approve', route(async (req, res) => {
  const client = getAdmin();
  const notes = (req.body && req.body.notes) || null;

  const { data: request, error } = await client
    .from('delete_requests')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) throw error;
  if (!request) return res.status(404).json({ error: 'Deletion request not found' });

  await client
    .from('delete_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), admin_notes: notes })
    .eq('id', request.id);

  const detail = await purgeAccount(request.user_id, {
    deletedBy: 'admin-dashboard',
    notes: notes || 'Deleted via deletion request ' + request.id,
  });

  res.json({ message: 'Account deleted permanently', detail: detail });
}));

/** Reject a request: the account is left untouched. */
app.post('/api/admin/requests/:id/reject', route(async (req, res) => {
  const notes = (req.body && req.body.notes) || null;
  const { error } = await getAdmin()
    .from('delete_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), admin_notes: notes })
    .eq('id', req.params.id);
  if (error) throw error;
  res.json({ message: 'Request rejected' });
}));

/** Delete an account directly, without waiting for a request. */
app.post('/api/admin/users/:uid/delete', route(async (req, res) => {
  const detail = await purgeAccount(req.params.uid, {
    deletedBy: 'admin-dashboard (direct)',
    notes: (req.body && req.body.notes) || null,
  });
  res.json({ message: 'Account deleted permanently', detail: detail });
}));

/* ------------------------------------------------------------------ */
/* Support tickets (CRM)                                               */
/* ------------------------------------------------------------------ */

/** Update a ticket's status and/or leave an admin reply. */
app.post('/api/admin/tickets/:id/update', route(async (req, res) => {
  const body = req.body || {};
  const ALLOWED = ['open', 'in_progress', 'resolved', 'closed'];
  const patch = { updated_at: new Date().toISOString() };

  if (body.status) {
    if (!ALLOWED.includes(body.status)) {
      return res.status(400).json({ error: 'Invalid status: ' + body.status });
    }
    patch.status = body.status;
  }
  if (typeof body.admin_reply === 'string') {
    patch.admin_reply = body.admin_reply.slice(0, 4000) || null;
  }
  if (!body.status && typeof body.admin_reply !== 'string') {
    return res.status(400).json({ error: 'Nothing to update (send status and/or admin_reply)' });
  }

  const { error } = await getAdmin()
    .from('support_tickets')
    .update(patch)
    .eq('id', req.params.id);
  if (error) throw error;
  res.json({ message: 'Ticket updated' });
}));

app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: (err && err.message) || 'Internal error' });
});

app.listen(PORT, () => {
  console.log('Salon admin dashboard  ->  http://localhost:' + PORT);
});