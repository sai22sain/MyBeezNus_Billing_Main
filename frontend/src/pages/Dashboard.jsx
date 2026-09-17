import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { billAPI, customerAPI, itemAPI, reportAPI } from '../utils/firestoreAPI';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatDateTime } from '../utils/dateFormat';

const actions = [
  { label: 'Create New Bill', sub: 'Start a customer invoice', icon: 'fa-plus', path: '/new-bill', primary: true },
  { label: 'Add Customer', sub: 'Build your customer book', icon: 'fa-user-plus', path: '/customers' },
  { label: 'View Bills', sub: 'Review billing history', icon: 'fa-receipt', path: '/bills' },
  { label: 'Manage Items', sub: 'Update your catalog', icon: 'fa-box-open', path: '/items' },
];

const money = (value, visible) => visible ? `₹${Number(value || 0).toFixed(0)}` : '₹ ••••';

const dayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function Metric({ label, value, note, icon, tone }) {
  return <article className="dashboard-metric"><div className={`dashboard-metric-icon ${tone}`}><i className={`fas ${icon}`}></i></div><div className="dashboard-metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function Panel({ title, eyebrow, action, children, className = '' }) {
  return <section className={`dashboard-panel ${className}`}><div className="dashboard-panel-heading"><div>{eyebrow && <span className="dashboard-eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>{children}</section>;
}

function EmptyPanel({ icon, title, message, action, onAction }) {
  return <div className="dashboard-empty"><i className={`fas ${icon}`}></i><strong>{title}</strong><span>{message}</span>{action && <button className="dashboard-inline-action" onClick={onAction}>{action}</button>}</div>;
}

function Dashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [showRevenue, setShowRevenue] = useState(false);
  const [selectedTrendKey, setSelectedTrendKey] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    Promise.all([reportAPI.getDashboard(user.uid), billAPI.getAll(user.uid), customerAPI.getAll(user.uid), itemAPI.getAll(user.uid), customerAPI.getBirthdays(user.uid)])
      .then(([statsData, billData, customerData, itemData, birthdayData]) => {
        if (!active) return;
        setStats(statsData); setBills(billData || []); setCustomers(customerData || []); setItems(itemData || []); setBirthdays(birthdayData || []);
      })
      .catch(error => { console.error('Error loading dashboard:', error); if (active) setLoadError(true); });
    return () => { active = false; };
  }, [user.uid]);

  const monthBills = useMemo(() => { const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0); return bills.filter(bill => new Date(bill.createdAt) >= start); }, [bills]);
  const trend = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const key = dayKey(date);
    const total = bills.filter(bill => dayKey(bill.createdAt) === key).reduce((sum, bill) => sum + Number(bill.finalAmount || 0), 0);
    return { key, total, label: date.toLocaleDateString('en-IN', { weekday: 'short' }), dateLabel: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) };
  }), [bills]);
  const topItem = useMemo(() => {
    const counts = {};
    monthBills.forEach(bill => (bill.items || []).forEach(line => { const name = line.name || 'Unnamed item'; counts[name] = (counts[name] || 0) + Number(line.quantity || 0); }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  }, [monthBills]);

  if (!stats && !loadError) return <div className="dashboard-skeleton" aria-label="Loading dashboard"><span></span><span></span><span></span><span></span></div>;
  if (loadError) return <div className="dashboard-error"><i className="fas fa-cloud-exclamation"></i><h2>Dashboard unavailable</h2><p>We could not load your business summary. Please refresh and try again.</p></div>;

  const latestBills = bills.slice(0, 4);
  const latestCustomers = customers.slice(0, 4);
  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const peak = Math.max(...trend.map(day => day.total), 1);
  const hasRecentRevenue = trend.some(day => day.total > 0);

  return <div className="dashboard-page">
    <header className="dashboard-welcome"><div><span className="dashboard-eyebrow"><i className="fas fa-sparkles"></i> Business overview</span><h1>{greeting}, {profile?.ownerName || user.displayName || 'there'}</h1><p>{profile?.businessName || 'Your business'} at a glance, for {today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.</p></div><button className="dashboard-revenue-toggle" onClick={() => setShowRevenue(!showRevenue)}><i className={`fas ${showRevenue ? 'fa-eye-slash' : 'fa-eye'}`}></i>{showRevenue ? 'Hide revenue' : 'Show revenue'}</button></header>
    <div className="dashboard-actions">{actions.map(action => <button key={action.path} className={`dashboard-action ${action.primary ? 'is-primary' : ''}`} onClick={() => navigate(action.path)}><span className="dashboard-action-icon"><i className={`fas ${action.icon}`}></i></span><span><strong>{action.label}</strong><small>{action.sub}</small></span><i className="fas fa-arrow-up-right-from-square dashboard-action-arrow"></i></button>)}</div>
    <div className="dashboard-metrics"><Metric label="Today's revenue" value={money(stats.today_revenue, showRevenue)} note={`${stats.today_bills || 0} bills today`} icon="fa-indian-rupee-sign" tone="gold" /><Metric label="This month" value={money(stats.month_revenue, showRevenue)} note={`${monthBills.length} bills this month`} icon="fa-chart-line" tone="violet" /><Metric label="Customers" value={stats.total_customers || 0} note="In your customer book" icon="fa-users" tone="blue" /><Metric label="Active items" value={stats.active_items || 0} note="Ready to add to a bill" icon="fa-cubes" tone="green" /></div>
    <div className="dashboard-main-grid"><Panel title="Revenue rhythm" eyebrow="Last 7 days" className="revenue-panel"><div className="revenue-total"><strong>{money(stats.month_revenue, showRevenue)}</strong><span>This month</span></div>{hasRecentRevenue ? <div className="revenue-chart" aria-label="Revenue over the last seven days">{trend.map((day, index) => { const selected = selectedTrendKey === day.key; return <div className={`revenue-day${selected ? ' is-selected' : ''}`} key={day.key} onMouseEnter={() => setSelectedTrendKey(day.key)} onMouseLeave={() => setSelectedTrendKey(null)}><button type="button" className="revenue-point" aria-label={`${day.dateLabel}: ${money(day.total, true)} revenue`} onClick={() => setSelectedTrendKey(selected ? null : day.key)}><span className="revenue-bar-track"><span className="revenue-bar" style={{ height: `${Math.max((day.total / peak) * 100, day.total ? 12 : 4)}%` }}></span></span></button>{selected && <div className={`revenue-tooltip revenue-tooltip-${index < 2 ? 'start' : index > 4 ? 'end' : 'center'}`} role="status"><strong>{day.dateLabel}</strong><span>Revenue</span><b>{money(day.total, showRevenue)}</b></div>}<small>{day.label}</small></div>; })}</div> : <EmptyPanel icon="fa-chart-line" title="No revenue in the last 7 days" message="Create a bill to see your business rhythm here." action="Create New Bill" onAction={() => navigate('/new-bill')} />}</Panel><Panel title="Business health" eyebrow="Worth a look" className="health-panel"><div className="health-list"><div className="health-item"><span className="health-icon gold"><i className="fas fa-bolt"></i></span><span><strong>{stats.today_bills ? `${stats.today_bills} bill${stats.today_bills === 1 ? '' : 's'} generated today` : 'No bills generated today'}</strong><small>{stats.today_bills ? 'Your day is moving' : 'Create a bill to start today'}</small></span></div><div className="health-item"><span className="health-icon violet"><i className="fas fa-ranking-star"></i></span><span><strong>{topItem ? `${topItem[0]} is your top item` : 'Your best-selling item will appear here'}</strong><small>{topItem ? `${topItem[1]} sold this month` : 'Use items in bills to build the signal'}</small></span></div><div className="health-item"><span className="health-icon blue"><i className="fas fa-boxes-stacked"></i></span><span><strong>{items.length ? `${items.length} catalog item${items.length === 1 ? '' : 's'} available` : 'Your catalog is ready to begin'}</strong><small>{items.length ? 'Ready to add to a bill' : 'Add services or products'}</small></span></div></div></Panel></div>
    <div className="dashboard-secondary-grid"><Panel title="Recent bills" eyebrow="Latest activity" action={<button className="panel-link" onClick={() => navigate('/bills')}>View all <i className="fas fa-arrow-right"></i></button>}>{latestBills.length ? <div className="dashboard-list">{latestBills.map(bill => <div className="dashboard-list-row" key={bill.id}><span className="list-avatar bill"><i className="fas fa-receipt"></i></span><span className="list-main"><strong>{bill.billNumber || 'Bill'}</strong><small>{bill.customerName || 'Walk-in customer'} · {formatDateTime(bill.createdAt).split(' ')[0]}</small></span><span className="list-value">{money(bill.finalAmount, showRevenue)}<small>{bill.paymentMode || 'Payment recorded'}</small></span></div>)}</div> : <EmptyPanel icon="fa-receipt" title="No bills yet" message="Create your first bill to start tracking revenue." action="Create New Bill" onAction={() => navigate('/new-bill')} />}</Panel><Panel title="Recent customers" eyebrow="Customer book" action={<button className="panel-link" onClick={() => navigate('/customers')}>View all <i className="fas fa-arrow-right"></i></button>}>{latestCustomers.length ? <div className="dashboard-list">{latestCustomers.map(customer => <div className="dashboard-list-row" key={customer.id}><span className="list-avatar customer"><i className="fas fa-user"></i></span><span className="list-main"><strong>{customer.name}</strong><small>{customer.mobile || 'No mobile number'} · Added {formatDate(customer.createdAt)}</small></span><i className="fas fa-chevron-right list-chevron"></i></div>)}</div> : <EmptyPanel icon="fa-users" title="No customers yet" message="Add your first customer to build their history." action="Add Customer" onAction={() => navigate('/customers')} />}</Panel></div>
    {(birthdays.length > 0 || items.length === 0) && <div className="dashboard-notices">{birthdays.length > 0 && <Panel title="Customer moments" eyebrow="Today"><div className="birthday-compact">{birthdays.slice(0, 3).map(customer => <div className="birthday-compact-row" key={customer.id}><span className="list-avatar gold"><i className="fas fa-cake-candles"></i></span><span><strong>{customer.name}'s birthday</strong><small>{customer.mobile || 'Send them a warm wish today'}</small></span><i className="fas fa-gift"></i></div>)}</div></Panel>}{items.length === 0 && <Panel title="Inventory snapshot" eyebrow="Catalog"><EmptyPanel icon="fa-box-open" title="No items added yet" message="Add your services or products to speed up billing." action="Manage Items" onAction={() => navigate('/items')} /></Panel>}</div>}
  </div>;
}

export default Dashboard;
