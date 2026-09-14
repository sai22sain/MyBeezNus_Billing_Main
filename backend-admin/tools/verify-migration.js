/*
 * Verifies whether the legacy SQLite data already exists in Supabase.
 *
 *   node tools/verify-migration.js <user_id>
 *
 * Matches categories/items by name and bills by (created_at, final_amount)
 * because the Supabase migration renumbered bill numbers.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const path = require('path');
const sqlite3 = require('sqlite3');
const { createClient } = require('@supabase/supabase-js');

const UID = process.argv[2];
if (!UID) {
  console.error('usage: node verify-migration.js <user_id>');
  process.exit(1);
}

const dbPath = process.env.BACKEND_BASE_SQLITE_DB ||
  path.resolve(__dirname, '..', '..', 'backend', 'salon.db');

const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();
const money = (n) => Math.round(Number(n || 0) * 100);
const stamp = (s) => String(s == null ? '' : s)
  .replace('T', ' ').replace(/\.\d+/, '').replace(/\+00:00/, '').trim().slice(0, 19);

const ok = (b) => (b ? 'OK   ' : 'MISS ');

(async () => {
  const db = new sqlite3.Database(dbPath);
  const all = (sql) => new Promise((res, rej) => db.all(sql, (e, r) => (e ? rej(e) : res(r))));

  const sCats = await all('SELECT * FROM categories');
  const sItems = await all('SELECT * FROM items');
  const sBills = await all('SELECT * FROM bills');
  const sBillItems = await all('SELECT * FROM bill_items');
  const sCustomers = await all('SELECT * FROM customers');
  db.close();

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const q = async (t, cols) => {
    const r = await sb.from(t).select(cols).eq('user_id', UID);
    if (r.error) throw r.error;
    return r.data || [];
  };

  const pCats = await q('categories', 'id,name');
  const pItems = await q('items', 'id,name,price,tax');
  const pBills = await q('bills', 'bill_number,customer_name,final_amount,created_at,items');
  const pCustomers = await q('customers', 'id,name,mobile');

  console.log('SQLite : ' + dbPath);
  console.log('Supabase user: ' + UID);
  console.log('');

  let missing = 0;
  const catNames = new Set(pCats.map((c) => norm(c.name)));
  const itemNames = new Set(pItems.map((i) => norm(i.name)));

  console.log('--- categories (' + sCats.length + ') ---');
  for (const c of sCats) {
    const hit = catNames.has(norm(c.category_name));
    if (!hit) missing += 1;
    console.log('  ' + ok(hit) + c.category_name);
  }

  console.log('\n--- items (' + sItems.length + ') ---');
  const itemById = {};
  for (const i of sItems) {
    itemById[i.item_id] = i;
    const hit = itemNames.has(norm(i.item_name));
    if (!hit) missing += 1;
    console.log('  ' + ok(hit) + i.item_name + '  (price ' + i.price + ')');
  }

  console.log('\n--- bills (' + sBills.length + ') ---');
  const billMap = {};
  for (const b of sBills) {
    const match = pBills.find(
      (p) => stamp(p.created_at) === stamp(b.created_at) && money(p.final_amount) === money(b.final_amount)
    );
    billMap[b.bill_id] = match;
    if (!match) missing += 1;
    console.log('  ' + ok(match) + b.bill_number + '  ' + b.final_amount + '  ' + b.created_at +
      (match ? '   -> Supabase ' + match.bill_number : '   -> NOT IN SUPABASE'));
  }

  console.log('\n--- bill line items (' + sBillItems.length + ') ---');
  for (const li of sBillItems) {
    const src = itemById[li.item_id] || {};
    const target = billMap[li.bill_id];
    const line = target && Array.isArray(target.items)
      ? target.items.find((x) => norm(x.name) === norm(src.item_name)) : null;
    const sameQty = line && Number(line.quantity) === Number(li.quantity);
    const samePrice = line && money(line.price) === money(li.price);
    const hit = Boolean(line && sameQty && samePrice);
    if (!hit) missing += 1;
    console.log('  ' + ok(hit) + (src.item_name || '?') + ' x' + li.quantity + ' @' + li.price +
      (target ? '  in ' + target.bill_number : '  (bill missing)'));
  }

  console.log('\n--- customers (' + sCustomers.length + ') ---');
  console.log('  Supabase has ' + pCustomers.length + ' customer(s): ' +
    pCustomers.map((c) => c.name + ' / ' + c.mobile).join(', '));

  console.log('\n================================');
  console.log(missing === 0
    ? 'RESULT: nothing is missing - SQLite data is fully present in Supabase.'
    : 'RESULT: ' + missing + ' SQLite row(s) NOT found in Supabase.');
  process.exit(missing === 0 ? 0 : 2);
})().catch((e) => {
  console.error('FAILED: ' + e.message);
  process.exit(1);
});