import React, { useState, useEffect } from 'react';
import { reportAPI } from '../utils/firestoreAPI';
import { useAuth } from '../context/AuthContext';
import { backendAPI } from '../utils/backend';
import { formatDateTime } from '../utils/dateFormat';
import { showToast } from '../services/notificationService';

const rankColors = ['#f59e0b', '#94a3b8', '#b45309', '#6366f1', '#22c55e'];

function Reports() {
  const { user } = useAuth();
  const [dailyRevenue, setDailyRevenue] = useState(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState(null);
  const [topItems, setTopItems] = useState([]);
  const [repeatCustomers, setRepeatCustomers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [showRevenue, setShowRevenue] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { loadReports(); }, [selectedDate]); // eslint-disable-line

  const loadReports = async () => {
    try {
      const [daily, monthly, topItm, repeat] = await Promise.all([
        reportAPI.getDailyRevenue(user.uid, selectedDate),
        reportAPI.getMonthlyRevenue(user.uid, new Date().getMonth() + 1, new Date().getFullYear()),
        reportAPI.getTopItems(user.uid),
        reportAPI.getRepeatCustomers(user.uid)
      ]);
      setDailyRevenue(daily);
      setMonthlyRevenue(monthly);
      setTopItems(topItm);
      setRepeatCustomers(repeat);
    } catch (e) { console.error(e); }
  };

  const handleExport = async () => {
    if (!exportStartDate || !exportEndDate) {
      return showToast({ type: 'warning', message: 'Please select both start and end dates.' });
    }
    setExporting(true);
    try {
      const blob = await backendAPI.exportRevenue(exportStartDate, exportEndDate);
      if (!(blob instanceof Blob)) {
        throw new Error('Backend export unavailable');
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revenue_report_${exportStartDate}_${exportEndDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast({ type: 'success', message: 'Report downloaded successfully.' });
    } catch (e) {
      showToast({ type: 'error', message: 'Unable to export the report right now. Please try again.' });
    }
    setExporting(false);
  };

  const rev = (val) => showRevenue ? `₹${val?.toFixed(0) || 0}` : '₹ ••••';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, fontSize: 13 }}>Track your business performance</p>
        </div>
        <button className="btn btn-ghost" onClick={() => setShowRevenue(!showRevenue)}>
          <i className={`fas ${showRevenue ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          {showRevenue ? 'Hide' : 'Show'} Revenue
        </button>
      </div>

      {/* Daily */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="report-section-title"><i className="fas fa-calendar-day" style={{ color: '#6366f1' }}></i> Daily Performance</div>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{ padding: '8px 12px', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        </div>
        {dailyRevenue && (
          <div className="reports-stat-grid">
            <div className="report-stat-card" style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}>
              <i className="fas fa-file-invoice-dollar report-stat-icon"></i>
              <div><div className="report-stat-label">Total Bills</div><div className="report-stat-value">{dailyRevenue.total_bills || 0}</div></div>
            </div>
            <div className="report-stat-card" style={{ background: 'linear-gradient(135deg, #f43f5e, #fb7185)' }}>
              <i className="fas fa-indian-rupee-sign report-stat-icon"></i>
              <div><div className="report-stat-label">Revenue</div><div className="report-stat-value">{rev(dailyRevenue.total_revenue)}</div></div>
            </div>
            <div className="report-stat-card" style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' }}>
              <i className="fas fa-chart-line report-stat-icon"></i>
              <div><div className="report-stat-label">Avg Bill</div><div className="report-stat-value">{rev(dailyRevenue.avg_bill_amount)}</div></div>
            </div>
          </div>
        )}
      </div>

      {/* Monthly */}
      <div className="card">
        <div className="report-section-title" style={{ marginBottom: 16 }}>
          <i className="fas fa-calendar-alt" style={{ color: '#8b5cf6' }}></i> Monthly Overview
        </div>
        {monthlyRevenue && (
          <div className="reports-stat-grid">
            <div className="report-stat-card" style={{ background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' }}>
              <i className="fas fa-receipt report-stat-icon"></i>
              <div><div className="report-stat-label">Monthly Bills</div><div className="report-stat-value">{monthlyRevenue.total_bills || 0}</div></div>
            </div>
            <div className="report-stat-card" style={{ background: 'linear-gradient(135deg, #22c55e, #4ade80)' }}>
              <i className="fas fa-coins report-stat-icon"></i>
              <div><div className="report-stat-label">Revenue</div><div className="report-stat-value">{rev(monthlyRevenue.total_revenue)}</div></div>
            </div>
            <div className="report-stat-card" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
              <i className="fas fa-calculator report-stat-icon"></i>
              <div><div className="report-stat-label">Avg Bill</div><div className="report-stat-value">{rev(monthlyRevenue.avg_bill_amount)}</div></div>
            </div>
          </div>
        )}
      </div>

      {/* Top Items */}
      <div className="card">
        <div className="report-section-title">
          <i className="fas fa-trophy" style={{ color: '#f59e0b' }}></i> Top Items
        </div>
        {topItems.length === 0 ? (
          <div className="empty-state"><i className="fas fa-chart-bar"></i><p>No item data yet</p></div>
        ) : topItems.slice(0, 5).map((item, i) => (
          <div key={i} className="top-service-row">
            <div className="top-service-rank" style={{ background: rankColors[i] }}>{i + 1}</div>
            <div>
              <div className="top-service-name">{item.item_name}</div>
              <div className="top-service-meta">Sold {item.times_sold} times · Qty: {item.total_quantity}</div>
            </div>
            <div className="top-service-revenue">{rev(item.total_revenue)}</div>
          </div>
        ))}
      </div>

      {/* Loyal Customers */}
      <div className="card">
        <div className="report-section-title">
          <i className="fas fa-star" style={{ color: '#f43f5e' }}></i> Loyal Customers
        </div>
        {repeatCustomers.length === 0 ? (
          <div className="empty-state"><i className="fas fa-users"></i><p>No repeat customers yet</p></div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, padding: '8px 14px', marginBottom: 4 }}>
              {['Customer', 'Visits', 'Total Spent', 'Last Visit'].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)' }}>{h}</span>
              ))}
            </div>
            {repeatCustomers.slice(0, 10).map(c => (
              <div key={c.id} className="loyal-customer-row">
                <div>
                  <div className="loyal-customer-name">{c.name}</div>
                  <div className="loyal-customer-mobile">{c.mobile}</div>
                </div>
                <div>
                  <div className="loyal-stat-label">Visits</div>
                  <div className="loyal-stat-value" style={{ color: '#6366f1' }}>{c.visit_count}</div>
                </div>
                <div>
                  <div className="loyal-stat-label">Spent</div>
                  <div className="loyal-stat-value" style={{ color: '#16a34a' }}>{rev(c.total_spent)}</div>
                </div>
                <div>
                  <div className="loyal-stat-label">Last Visit</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                    {formatDateTime(c.last_visit).split(' ')[0]}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Export */}
      <div className="export-banner">
        <h3><i className="fas fa-file-excel" style={{ marginRight: 8 }}></i>Export Revenue Report</h3>
        <p>Download detailed revenue report in Excel format</p>
        <div className="export-inputs">
          <div>
            <label>Start Date</label>
            <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} />
          </div>
          <div>
            <label>End Date</label>
            <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} />
          </div>
          <button className="btn-export" onClick={handleExport} disabled={exporting}>
            <i className="fas fa-download"></i> {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Reports;
