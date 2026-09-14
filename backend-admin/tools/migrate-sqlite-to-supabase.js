/*
 * Copy the legacy SQLite (salon.db) dataset into a Supabase tenant.
 *
 * Dry-run by default: it only prints what would be written.
 * Add --apply to actually insert.
 *
 *   node tools/migrate-sqlite-to-supabase.js                 # dry run
 *   node tools/migrate-sqlite-to-supabase.js --apply         # write
 *   node tools/migrate-sqlite-to-supabase.js --uid=<uuid>    # choose tenant
 *   node tools/migrate-sqlite-to-supabase.js --keep-numbers  # skip clashing numbers
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const KEEP_NUMBERS = process.argv.includes('--keep-numbers');
const uidArg = process.argv.find((a) => a.startsWith('--uid='));
const TARGET_UID = uidArg ? uidArg.split('=')[1] : null;

const DB_PATH = process.env.BACKEND_BASE_SQLITE_DB
  || path.resolve(__dirname, '..', '..', 'backend', 'salon.db');

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();
const pad = (n) => String(n).padStart(5, '0');

function all(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function loadSqlite() {
  if (!fs.existsSync(DB_PATH)) throw new Error('SQLite file not found: ' + DB_PATH);
  const db = new sqlite3.Database(DB_PATH);
  const [categories, items, customers, bills, billItems] = await Promise.all([
    all(db, 'SELECT * FROM categories ORDER BY category_id'),
    all(db, 'SELECT * FROM items ORDER BY item_id'),
    all(db, 'SELECT * FROM customers ORDER BY created_at'),
    all(db, 'SELECT * FROM bills ORDER BY created_at, bill_id'),
    all(db, 'SELECT * FROM bill_items ORDER BY bill_id, id'),
  ]);
  db.close();
  return { categories, items, customers, bills, billItems };
}

async function loadSupabase(uid) {
  const [cats, items, customers, bills, seq, profile] = await Promise.all([
    client.from('categories').select('id, name').eq('user_id', uid),
    client.from('items').select('id, name, category_id').eq('user_id', uid),
    client.from('customers').select('id, customer_id, name, mobile').eq('user_id', uid),
    client.from('bills').select('id, bill_number, created_at, final_amount').eq('user_id', uid),
    client.from('sequences').select('*').eq('user_id', uid),
    client.from('profiles').select('business_name, bill_prefix, customer_prefix').eq('user_id', uid).maybeSingle(),
  ]);
  for (const r of [cats, items, customers, bills, seq]) {
    if (r.error) throw r.error;
  }
  return {
    categories: cats.data || [],
    items: items.data || [],
    customers: customers.data || [],
    bills: bills.data || [],
    sequences: seq.data || [],
    profile: profile.data || {},
  };
}

/** Highest numeric suffix used by codes like BILL-00004. */
function highestNumber(codes, prefix) {
  let max = 0;
  const re = new RegExp('^' + prefix + '-(\\d+)$');
  for (const c of codes) {
    const m = re.exec(String(c || ''));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

/** "2026-03-08 13:52:01" (SQLite CURRENT_TIMESTAMP, UTC) -> ISO string. */
function toIso(sqliteStamp) {
  if (!sqliteStamp) return new Date().toISOString();
  const s = String(sqliteStamp).replace(' ', 'T');
  return /Z$|[+-]\d\d:\d\d$/.test(s) ? s : s + '.000Z';
}

/** First unused placeholder mobile, so the customers.mobile unique index is safe. */
function freeMobile(taken) {
  for (let i = 0; i < 10000; i += 1) {
    const candidate = pad(i).padStart(10, '0');
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  throw new Error('Could not find a free placeholder mobile');
}

async function resolveTenant() {
  if (TARGET_UID) return TARGET_UID;
  const { data, error } = await client.from('profiles').select('user_id, business_name');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No profile found - pass --uid=<uuid>');
  if (data.length > 1) {
    console.log('Multiple tenants exist, pass --uid=<uuid> to choose one:');
    for (const p of data) console.log('  ' + p.user_id + '   ' + (p.business_name || ''));
    throw new Error('Ambiguous target tenant');
  }
  return data[0].user_id;
}

function buildPlan(sq, sb, uid) {
  const plan = {
    uid,
    businessName: sb.profile.business_name || '',
    newCategories: [],
    reuseCategories: [],
    newItems: [],
    reuseItems: [],
    newCustomers: [],
    bills: [],
    skippedBills: [],
    warnings: [],
    sequences: [],
  };

  /* Categories: match by name, otherwise create. */
  const catByName = {};
  for (const c of sb.categories) catByName[norm(c.name)] = c.id;

  const catRef = {};
  for (const c of sq.categories) {
    const existingId = catByName[norm(c.category_name)];
    if (existingId) {
      catRef[c.category_id] = existingId;
      plan.reuseCategories.push({ name: c.category_name });
    } else {
      const entry = { name: c.category_name, id: null };
      plan.newCategories.push(entry);
      catRef[c.category_id] = entry;
    }
  }

  /* Items: match by name, otherwise create under the mapped category. */
  const itemByName = {};
  for (const i of sb.items) itemByName[norm(i.name)] = i.id;

  const itemRef = {};
  for (const it of sq.items) {
    const existingId = itemByName[norm(it.item_name)];
    if (existingId) {
      itemRef[it.item_id] = { id: existingId, name: it.item_name, tax: it.tax };
      plan.reuseItems.push({ name: it.item_name });
    } else {
      const entry = {
        id: null,
        name: it.item_name,
        price: it.price,
        tax: it.tax,
        is_active: it.is_active !== 0,
        categoryRef: catRef[it.category_id] || null,
      };
      plan.newItems.push(entry);
      itemRef[it.item_id] = { id: null, name: it.item_name, tax: it.tax, ref: entry };
    }
  }

  /* Decide which bills to import and assign their final numbers. A bill keeps
     its legacy number unless something clashes; then all of them are renumbered
     sequentially (still chronological) so numbers stay unique. */
  const billPrefix = sb.profile.bill_prefix || 'BILL';
  const usedNumbers = new Set(sb.bills.map((b) => b.bill_number));
  const existingStamps = new Set(sb.bills.map((b) => toIso(b.created_at).slice(0, 19)));
  const clashes = sq.bills.filter((b) => usedNumbers.has(b.bill_number)).length;
  const renumber = !KEEP_NUMBERS && clashes > 0;
  let billCounter = highestNumber(usedNumbers, billPrefix);

  const decisions = [];
  for (const b of sq.bills) {
    const iso = toIso(b.created_at);
    if (existingStamps.has(iso.slice(0, 19))) {
      decisions.push(null);
      plan.skippedBills.push({ number: b.bill_number, reason: 'created_at already present' });
      continue;
    }
    let number = b.bill_number;
    if (renumber) {
      billCounter += 1;
      number = billPrefix + '-' + pad(billCounter);
    } else if (usedNumbers.has(number)) {
      decisions.push(null);
      plan.skippedBills.push({ number: b.bill_number, reason: 'number in use (--keep-numbers)' });
      continue;
    }
    usedNumbers.add(number);
    decisions.push({ bill: b, number: number, iso: iso });
  }

  /* The SQLite customers table is empty, so legacy bills point at a customer
     that no longer exists. Create one placeholder per referenced id, only for
     bills that are actually imported, and reuse it on later runs. */
  const takenMobiles = new Set(sb.customers.map((c) => String(c.mobile || '')));
  const takenCodes = sb.customers.map((c) => c.customer_id);
  const customerPrefix = sb.profile.customer_prefix || 'CUST';
  let codeCounter = highestNumber(takenCodes, customerPrefix);

  const custByName = {};
  for (const c of sb.customers) custByName[norm(c.name)] = c;

  const needed = {};
  for (const d of decisions) {
    if (!d) continue;
    const cid = String(d.bill.customer_id || '(none)');
    needed[cid] = (needed[cid] || 0) + 1;
  }

  const customerRef = {};
  for (const cid of Object.keys(needed)) {
    const placeholderName = 'Walk-in (' + cid + ')';
    const found = custByName[norm(placeholderName)];
    if (found) {
      plan.reuseCustomers.push({ name: found.name, customer_id: found.customer_id });
      customerRef[cid] = {
        id: found.id,
        customer_id: found.customer_id,
        name: found.name,
        mobile: found.mobile,
        legacyId: cid,
        billCount: needed[cid],
      };
      continue;
    }
    codeCounter += 1;
    const entry = {
      id: null,
      legacyId: cid,
      customer_id: customerPrefix + '-' + pad(codeCounter),
      name: placeholderName,
      mobile: freeMobile(takenMobiles),
      billCount: needed[cid],
    };
    plan.newCustomers.push(entry);
    customerRef[cid] = entry;
  }

  for (const d of decisions) {
    if (!d) continue;
    const b = d.bill;
    const number = d.number;
    const iso = d.iso;

    const lines = sq.billItems.filter((bi) => bi.bill_id === b.bill_id);
    if (!lines.length) plan.warnings.push('bill ' + b.bill_number + ' has no line items');

    const items = lines.map((bi) => {
      const r = itemRef[bi.item_id] || { id: null, name: 'Item #' + bi.item_id, tax: 0 };
      return {
        itemId: r.id,
        name: r.name,
        price: bi.price,
        tax: r.tax || 0,
        quantity: bi.quantity,
      };
    });

    const cust = customerRef[String(b.customer_id || '(none)')];
    plan.bills.push({
      user_id: uid,
      bill_number: number,
      originalNumber: b.bill_number,
      customer: cust,
      customer_name: cust ? cust.name : '',
      customer_mobile: cust ? cust.mobile : null,
      items,
      discount: b.discount || 0,
      payment_mode: b.payment_mode || 'Cash',
      total_amount: b.total_amount,
      tax: b.tax || 0,
      final_amount: b.final_amount,
      created_at: iso,
    });
  }

  plan.sequences.push({
    entity_type: 'bill',
    prefix: billPrefix,
    last_number: highestNumber(usedNumbers, billPrefix),
  });
  plan.sequences.push({
    entity_type: 'customer',
    prefix: customerPrefix,
    last_number: highestNumber(takenCodes.concat(plan.newCustomers.map((c) => c.customer_id)), customerPrefix),
  });

  plan.renumbered = renumber;
  return plan;
}

async function apply(plan) {
  const uid = plan.uid;

  for (const c of plan.newCategories) {
    const { data, error } = await client
      .from('categories').insert({ user_id: uid, name: c.name }).select('id').single();
    if (error) throw error;
    c.id = data.id;
  }

  for (const it of plan.newItems) {
    const categoryId = it.categoryRef
      ? (typeof it.categoryRef === 'string' ? it.categoryRef : it.categoryRef.id)
      : null;
    const { data, error } = await client.from('items').insert({
      user_id: uid,
      category_id: categoryId,
      name: it.name,
      price: it.price,
      tax: it.tax,
      is_active: it.is_active,
    }).select('id').single();
    if (error) throw error;
    it.id = data.id;
  }

  /* Newly created items only get their uuid now - patch the bill lines. */
  for (const b of plan.bills) {
    for (const line of b.items) {
      if (line.itemId) continue;
      const created = plan.newItems.find((x) => x.name === line.name);
      line.itemId = created ? created.id : null;
    }
  }

  for (const c of plan.newCustomers) {
    const { data, error } = await client.from('customers').insert({
      user_id: uid,
      customer_id: c.customer_id,
      name: c.name,
      mobile: c.mobile,
    }).select('id').single();
    if (error) throw error;
    c.id = data.id;
  }

  for (const b of plan.bills) {
    const { error } = await client.from('bills').insert({
      user_id: uid,
      bill_number: b.bill_number,
      customer_id: b.customer ? b.customer.id : null,
      customer_name: b.customer_name,
      customer_mobile: b.customer_mobile,
      items: b.items.map((l) => ({
        itemId: l.itemId,
        name: l.name,
        price: l.price,
        tax: l.tax,
        quantity: l.quantity,
      })),
      discount: b.discount,
      payment_mode: b.payment_mode,
      total_amount: b.total_amount,
      tax: b.tax,
      final_amount: b.final_amount,
      created_at: b.created_at,
    });
    if (error) throw error;
  }

  for (const s of plan.sequences) {
    const { data: existing, error: findErr } = await client
      .from('sequences').select('user_id')
      .eq('user_id', uid).eq('entity_type', s.entity_type).maybeSingle();
    if (findErr) throw findErr;

    if (existing) {
      const { error } = await client.from('sequences')
        .update({ prefix: s.prefix, last_number: s.last_number, updated_at: new Date().toISOString() })
        .eq('user_id', uid).eq('entity_type', s.entity_type);
      if (error) throw error;
    } else {
      const { error } = await client.from('sequences').insert({
        user_id: uid,
        entity_type: s.entity_type,
        prefix: s.prefix,
        last_number: s.last_number,
      });
      if (error) throw error;
    }
  }
}

function printPlan(plan) {
  const L = (s) => console.log(s);
  const list = (arr, fmt) => (arr.length ? ' -> ' + arr.map(fmt).join(', ') : '');

  L('');
  L('=== MIGRATION PLAN (' + (APPLY ? 'APPLY' : 'DRY RUN') + ') ===');
  L('Target tenant : ' + plan.uid + (plan.businessName ? '   (' + plan.businessName + ')' : ''));
  L('');
  L('Categories to create : ' + plan.newCategories.length + list(plan.newCategories, (c) => c.name));
  L('Categories reused    : ' + plan.reuseCategories.length + list(plan.reuseCategories, (c) => c.name));
  L('Items to create      : ' + plan.newItems.length + list(plan.newItems, (i) => i.name + ' (' + i.price + ')'));
  L('Items reused         : ' + plan.reuseItems.length + list(plan.reuseItems, (i) => i.name));
  L('Customers to create  : ' + plan.newCustomers.length);
  for (const c of plan.newCustomers) {
    L('    ' + c.customer_id + '  ' + c.name + '  mobile=' + c.mobile + '   (' + c.billCount + ' legacy bills)');
  }
  L('');
  L('Bills to insert      : ' + plan.bills.length + (plan.renumbered ? '   [renumbered to avoid clashes]' : ''));
  for (const b of plan.bills) {
    const label = b.originalNumber === b.bill_number
      ? b.bill_number
      : b.originalNumber + ' -> ' + b.bill_number;
    L('    ' + label.padEnd(22) + ' ' + String(b.final_amount).padEnd(9) +
      b.created_at.slice(0, 19) + '   ' + b.items.map((i) => i.quantity + 'x ' + i.name).join(', '));
  }
  if (plan.skippedBills.length) {
    L('');
    L('Skipped : ' + plan.skippedBills.length);
    for (const s of plan.skippedBills) L('    ' + s.number + ' - ' + s.reason);
  }
  if (plan.warnings.length) {
    L('');
    L('Warnings:');
    for (const w of plan.warnings) L('    ' + w);
  }
  L('');
  L('Sequences after import:');
  for (const s of plan.sequences) L('    ' + s.entity_type.padEnd(9) + ' prefix=' + s.prefix + '  last_number=' + s.last_number);
  L('');
}

(async () => {
  const uid = await resolveTenant();
  const [sq, sb] = await Promise.all([loadSqlite(), loadSupabase(uid)]);

  console.log('SQLite source : ' + DB_PATH);
  console.log('  categories=' + sq.categories.length + '  items=' + sq.items.length +
    '  customers=' + sq.customers.length + '  bills=' + sq.bills.length +
    '  bill_items=' + sq.billItems.length);
  console.log('Supabase now  : categories=' + sb.categories.length + '  items=' + sb.items.length +
    '  customers=' + sb.customers.length + '  bills=' + sb.bills.length);

  const plan = buildPlan(sq, sb, uid);
  printPlan(plan);

  if (!APPLY) {
    console.log('Dry run only - nothing was written. Re-run with --apply to import.');
    process.exit(0);
  }

  console.log('Applying...');
  await apply(plan);
  console.log('Import complete.');
  process.exit(0);
})().catch((e) => {
  console.error('FAILED: ' + ((e && e.message) || e));
  process.exit(1);
});