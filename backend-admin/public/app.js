/* Salon admin dashboard - front-end logic (plain JS, no build step). */

const $ = (id) => document.getElementById(id);

let snapshot = { stats: {}, users: [], requests: [], deleted: [] };
let filter = '';

function toast(msg, isErr) {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, 5000);
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const num = (n) => esc(n == null ? 0 : n);

const fmtMoney = (n) => '\u20B9' + Number(n || 0).toLocaleString('en-IN', {
  maximumFractionDigits: 2,
});

const fmtDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const TOKEN_KEY = 'salonAdminToken';

async function api(method, url, body, retried) {
  const res = await fetch(url, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': localStorage.getItem(TOKEN_KEY) || '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Hosted + ADMIN_TOKEN set: ask for it once, remember it, retry.
  if (res.status === 401 && !retried) {
    const entered = window.prompt('Admin token required for this dashboard:');
    if (entered) {
      localStorage.setItem(TOKEN_KEY, entered);
      return api(method, url, body, true);
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}

function renderStats() {
  const s = snapshot.stats || {};
  const cards = [
    ['Registered users', s.totalUsers],
    ['Onboarded salons', s.onboardedUsers],
    ['Total bills', s.totalBills],
    ['Total customers', s.totalCustomers],
    ['Total items', s.totalItems],
    ['Total categories', s.totalCategories],
    ['All-time revenue', fmtMoney(s.totalRevenue)],
    ['Today revenue', fmtMoney(s.todayRevenue)],
    ['This month revenue', fmtMoney(s.monthRevenue)],
    ['Pending requests', s.pendingRequests],
    ['Deleted accounts', s.deletedAccounts],
  ];
  $('statsGrid').innerHTML = cards.map((c) =>
    '<div class="card"><div class="stat-label">' + esc(c[0]) + '</div>' +
    '<div class="stat-value">' + num(c[1]) + '</div></div>'
  ).join('');
}

function renderRequests() {
  const rows = snapshot.requests || [];
  const pending = rows.filter((r) => r.status === 'pending').length;
  $('pendingCount').textContent = pending ? pending + ' awaiting review' : 'nothing waiting';

  const body = $('requestsBody');
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No deletion requests yet.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((r) => {
    const actions = r.status === 'pending'
      ? '<button class="btn btn-ok" data-approve="' + esc(r.id) + '">Approve &amp; delete</button> ' +
        '<button class="btn" data-reject="' + esc(r.id) + '">Reject</button>'
      : '<span class="muted">&mdash;</span>';
    const who = esc(r.businessName) || '<span class="muted">(not onboarded)</span>';
    return '<tr>' +
      '<td>' + who + '</td>' +
      '<td>' + esc(r.email) + '</td>' +
      '<td class="num">' + num(r.bills) + '</td>' +
      '<td class="num">' + num(r.customers) + '</td>' +
      '<td class="muted">' + esc(fmtDate(r.requestedAt)) + '</td>' +
      '<td><span class="badge badge-' + esc(r.status) + '">' + esc(r.status) + '</span></td>' +
      '<td>' + actions + '</td>' +
    '</tr>';
  }).join('');
}

function renderUsers() {
  const q = filter.trim().toLowerCase();
  const users = (snapshot.users || []).filter((u) => {
    if (!q) return true;
    const hay = [u.businessName, u.email, u.phone, u.ownerName].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  });

  const body = $('usersBody');
  if (!users.length) {
    body.innerHTML = '<tr><td colspan="10" class="empty">No users match.</td></tr>';
    return;
  }

  body.innerHTML = users.map((u) => {
    const who = esc(u.businessName) || '<span class="muted">(not onboarded)</span>';
    return '<tr>' +
      '<td>' + who + '</td>' +
      '<td>' + esc(u.ownerName) + '</td>' +
      '<td>' + esc(u.email) + '</td>' +
      '<td>' + esc(u.phone) + '</td>' +
      '<td class="muted">' + esc(fmtDate(u.createdAt)) + '</td>' +
      '<td class="num">' + num(u.bills) + '</td>' +
      '<td class="num">' + num(u.customers) + '</td>' +
      '<td class="num">' + num(u.items) + '</td>' +
      '<td class="num">' + esc(fmtMoney(u.revenue)) + '</td>' +
      '<td><button class="btn btn-danger" data-delete="' + esc(u.uid) + '" data-label="' +
        esc(u.businessName || u.email) + '">Delete</button></td>' +
    '</tr>';
  }).join('');
}

function renderDeleted() {
  const rows = (snapshot.deleted || []).slice().sort((a, b) =>
    String(b.deleted_at).localeCompare(String(a.deleted_at)));
  $('deletedCount').textContent = rows.length ? rows.length + ' logged' : 'none';

  const body = $('deletedBody');
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No accounts deleted yet.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((r) => {
    const who = esc(r.business_name) || '<span class="muted">&mdash;</span>';
    return '<tr>' +
      '<td>' + who + '</td>' +
      '<td>' + esc(r.email) + '</td>' +
      '<td class="num">' + num(r.bills_count) + '</td>' +
      '<td class="num">' + num(r.customers_count) + '</td>' +
      '<td class="muted">' + esc(fmtDate(r.deleted_at)) + '</td>' +
      '<td class="muted">' + esc(r.deleted_by) + '</td>' +
    '</tr>';
  }).join('');
}

function renderAll() {
  renderStats();
  renderRequests();
  renderUsers();
  renderDeleted();
  $('subtitle').textContent = 'Snapshot taken ' + fmtDate(snapshot.generatedAt);
}

async function load() {
  $('subtitle').textContent = 'Loading...';
  try {
    snapshot = await api('GET', '/api/admin/snapshot');
    renderAll();
  } catch (e) {
    $('subtitle').textContent = 'Failed to load: ' + e.message;
    toast('Load failed: ' + e.message, true);
  }
}

const WARNING = '\n\nAll Supabase data, the auth account and the legacy SQLite database ' +
  'will be wiped. This cannot be undone.';

document.addEventListener('click', async (ev) => {
  if (!ev.target || !ev.target.closest) return;
  const el = ev.target.closest('[data-approve],[data-reject],[data-delete]');
  if (!el) return;

  const approveId = el.getAttribute('data-approve');
  const rejectId = el.getAttribute('data-reject');
  const deleteUid = el.getAttribute('data-delete');

  try {
    if (approveId) {
      if (!confirm('Approve and PERMANENTLY delete this account?' + WARNING)) return;
      el.disabled = true;
      const r = await api('POST', '/api/admin/requests/' + approveId + '/approve');
      const p = r.detail && r.detail.profile;
      toast('Deleted: ' + ((p && (p.businessName || p.email)) || approveId));
      await load();
    } else if (rejectId) {
      if (!confirm('Reject this deletion request? The account will not be touched.')) return;
      el.disabled = true;
      await api('POST', '/api/admin/requests/' + rejectId + '/reject');
      toast('Request rejected');
      await load();
    } else if (deleteUid) {
      const label = el.getAttribute('data-label') || deleteUid;
      if (!confirm('Permanently delete "' + label + '"?' + WARNING)) return;
      el.disabled = true;
      await api('POST', '/api/admin/users/' + deleteUid + '/delete');
      toast('Deleted: ' + label);
      await load();
    }
  } catch (e) {
    toast('Action failed: ' + e.message, true);
    el.disabled = false;
  }
});

$('refreshBtn').addEventListener('click', load);

$('searchBox').addEventListener('input', (e) => {
  filter = e.target.value;
  renderUsers();
});

load();