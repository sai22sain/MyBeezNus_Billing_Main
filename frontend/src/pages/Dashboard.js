import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportAPI, customerAPI } from '../utils/firestoreAPI';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/dateFormat';

const quickActions = [
  { label: 'New Bill', sub: 'Create invoice', icon: 'fa-plus-circle', path: '/new-bill' },
  { label: 'Add Customer', sub: 'Register new', icon: 'fa-user-plus', path: '/customers' },
  { label: 'View Bills', sub: 'Browse history', icon: 'fa-receipt', path: '/bills' },
  { label: 'Items', sub: 'Manage catalog', icon: 'fa-box', path: '/items' },
];

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [birthdays, setBirthdays] = useState([]);
  const [showRevenue, setShowRevenue] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadDashboard(); }, []); // eslint-disable-line

  const loadDashboard = async () => {
    try {
      const [statsData, birthdaysData] = await Promise.all([
        reportAPI.getDashboard(user.uid),
        customerAPI.getBirthdays(user.uid)
      ]);
      setStats(statsData);
      setBirthdays(birthdaysData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  if (!stats) return <div className="loading"><i className="fas fa-spinner fa-spin"></i> Loading...</div>;

  const statCards = [
    { label: "Today's Bills", value: stats.today_bills, icon: 'fa-file-invoice' },
    { label: "Today's Revenue", value: showRevenue ? `₹${stats.today_revenue?.toFixed(0) || 0}` : '₹ ••••', icon: 'fa-indian-rupee-sign' },
    { label: 'Month Revenue', value: showRevenue ? `₹${stats.month_revenue?.toFixed(0) || 0}` : '₹ ••••', icon: 'fa-calendar-alt' },
    { label: 'Total Customers', value: stats.total_customers, icon: 'fa-users' },
    { label: 'Active Items', value: stats.active_items, icon: 'fa-boxes-stacked' },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, fontSize: 13 }}>
            Welcome back! Here's what's happening today.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => setShowRevenue(!showRevenue)}>
          <i className={`fas ${showRevenue ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          {showRevenue ? 'Hide' : 'Show'} Revenue
        </button>
      </div>

      {/* Quick Actions */}
      <div className="dash-quick-actions">
        {quickActions.map(a => (
          <button key={a.path} className="quick-action-card" onClick={() => navigate(a.path)}>
            <i className={`fas ${a.icon} quick-action-icon`}></i>
            <div className="quick-action-label">{a.label}</div>
            <div className="quick-action-sub">{a.sub}</div>
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="dash-stats">
        {statCards.map(s => (
          <div key={s.label} className="dash-stat-card">
            <div className="dash-stat-icon">
              <i className={`fas ${s.icon}`}></i>
            </div>
            <div>
              <div className="dash-stat-label">{s.label}</div>
              <div className="dash-stat-value">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Birthday Reminders */}
      {birthdays.length > 0 && (
        <div className="birthday-banner">
          <div className="birthday-banner-header">
            <i className="fas fa-birthday-cake"></i>
            <div>
              <div className="birthday-banner-title">Birthday Reminders 🎉</div>
              <div className="birthday-banner-sub">Don't forget to wish these customers!</div>
            </div>
          </div>
          <div className="birthday-list">
            {birthdays.map(c => (
              <div key={c.id} className="birthday-item">
                <div>
                  <div className="birthday-name">{c.name}</div>
                  <div className="birthday-mobile">{c.mobile}</div>
                </div>
                <div className="birthday-date">{formatDate(c.dob)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
