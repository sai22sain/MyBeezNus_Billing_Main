import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import NewBill from './pages/NewBill';
import Bills from './pages/Bills';
import Customers from './pages/Customers';
import Items from './pages/Items';
import Reports from './pages/Reports';
import Pricing from './pages/Pricing';
import Settings from './pages/Settings';
import Support from './pages/Support';
import Logo from './components/Logo';
import HiveBackground from './components/ui/HiveBackground';
import ToastContainer from './components/Toast/ToastContainer';
import './App.css';

const themes = {
  default: { primary: '#3498db', success: '#27ae60', danger: '#e74c3c', sidebar: '#2c3e50', background: '#f5f5f5', text: '#2c3e50' },
  purple:  { primary: '#9b59b6', success: '#1abc9c', danger: '#e74c3c', sidebar: '#8e44ad', background: '#ecf0f1', text: '#2c3e50' },
  dark:    { primary: '#3498db', success: '#2ecc71', danger: '#e74c3c', sidebar: '#1a1a1a', background: '#2c2c2c', text: '#ffffff' },
  ocean:   { primary: '#16a085', success: '#27ae60', danger: '#c0392b', sidebar: '#16a085', background: '#ecf0f1', text: '#2c3e50' },
  sunset:  { primary: '#e67e22', success: '#27ae60', danger: '#c0392b', sidebar: '#d35400', background: '#fef5e7', text: '#2c3e50' }
};

function applyTheme(theme) {
  const root = document.documentElement;
  const colors = themes[theme] || themes.default;
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-success', colors.success);
  root.style.setProperty('--color-danger', colors.danger);
  root.style.setProperty('--color-sidebar', colors.sidebar);
  root.style.setProperty('--color-background', colors.background);
  root.style.setProperty('--color-text', colors.text);
}

const navItems = [
  { to: '/', icon: 'fa-home', label: 'Dashboard' },
  { to: '/new-bill', icon: 'fa-plus-circle', label: 'New Bill' },
  { to: '/bills', icon: 'fa-receipt', label: 'Bills' },
  { to: '/customers', icon: 'fa-users', label: 'Customers' },
  { to: '/items', icon: 'fa-box', label: 'Items' },
  { to: '/reports', icon: 'fa-chart-bar', label: 'Reports' },
  { to: '/pricing', icon: 'fa-crown', label: 'Upgrade' },
  { to: '/support', icon: 'fa-headset', label: 'Tickets' },
  { to: '/settings', icon: 'fa-cog', label: 'Settings' },
];

// Bottom tab bar shows these 5 items; rest accessible via drawer
const bottomTabs = ['/', '/new-bill', '/bills', '/customers', '/settings'];

function AppShell() {
  const { user, profile, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    applyTheme(localStorage.getItem('theme') || 'default');
  }, []);

  if (!user) return <Login />;
  if (!profile) return <Onboarding />;

  return (
    <div className="app">
      <HiveBackground />
      {/* Sidebar — desktop */}
      <nav className="sidebar">
        <div className="sidebar-header">
          <Link to="/" title="Go to homepage" style={{ textDecoration: 'none' }}>
            <div className="sidebar-brand">
              <Logo size={52} radius={8} />
              <span className="sidebar-brand-name">MyBeezNus Billing</span>
            </div>
          </Link>
          <div className="sidebar-business-name">{profile.businessName}</div>
          <div className="sidebar-email">{user.email}</div>
        </div>
        <div className="sidebar-nav-label">Main Menu</div>
        <ul>
          {navItems.map(n => (
            <li key={n.to}><Link to={n.to} data-label={n.label} className={location.pathname === n.to ? 'active' : ''}><i className={`fas ${n.icon}`}></i>{n.label}</Link></li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <img src={user.photoURL} alt={user.displayName} />
            <span className="sidebar-user-name">{user.displayName}</span>
          </div>
          <button className="sidebar-signout" onClick={logout}>
            <i className="fas fa-sign-out-alt"></i> Sign Out
          </button>
        </div>
      </nav>

      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <Link to="/" title="Go to homepage" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Logo size={30} radius={8} />
            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-text)' }}>MyBeezNus Billing</span>
          </Link>
        </div>
        <button className="mobile-menu-btn" onClick={() => setDrawerOpen(true)}>
          <i className="fas fa-bars"></i>
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <nav className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <Link to="/" onClick={() => setDrawerOpen(false)} title="Go to homepage" style={{ textDecoration: 'none' }}>
                <div className="sidebar-brand">
                  <Logo size={34} radius={9} />
                  <span className="sidebar-brand-name">MyBeezNus Billing</span>
                </div>
              </Link>
              <button className="close-btn" onClick={() => setDrawerOpen(false)}>×</button>
            </div>
            <div style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-sidebar-muted)' }}>Menu</div>
            <ul style={{ listStyle: 'none', padding: '0 10px' }}>
              {navItems.map(n => (
                <li key={n.to} style={{ marginBottom: 2 }}>
                  <Link to={n.to} onClick={() => setDrawerOpen(false)}
                    style={{ color: 'var(--color-sidebar-text)', textDecoration: 'none', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 8 }}>
                    <i className={`fas ${n.icon}`} style={{ width: 18, textAlign: 'center', color: '#a5b4fc' }}></i>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="drawer-footer">
              <div className="sidebar-user">
                <img src={user.photoURL} alt={user.displayName} />
                <span className="sidebar-user-name">{user.displayName}</span>
              </div>
              <button className="sidebar-signout" onClick={logout}>
                <i className="fas fa-sign-out-alt"></i> Sign Out
              </button>
            </div>
          </nav>
        </div>
      )}

      <main className={`content${location.pathname === '/' ? ' dashboard-content' : ''}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-bill" element={<NewBill />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/items" element={<Items />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/support" element={<Support />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="bottom-nav">
        {navItems.filter(n => bottomTabs.includes(n.to)).map(n => (
          <Link key={n.to} to={n.to} className={`bottom-nav-item${location.pathname === n.to ? ' active' : ''}`}>
            <i className={`fas ${n.icon}`}></i>
            <span>{n.label}</span>
          </Link>
        ))}
        <button className="bottom-nav-item" onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <i className="fas fa-ellipsis-h"></i>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppShell />
        <ToastContainer />
      </Router>
    </AuthProvider>
  );
}

export default App;
