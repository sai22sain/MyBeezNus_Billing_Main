import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

const API_URL = process.env.REACT_APP_API_URL ?? '';

const CATEGORIES = [
  { value: 'bug', label: 'Bug / something not working' },
  { value: 'feature', label: 'Feature request' },
  { value: 'billing', label: 'Billing / payment issue' },
  { value: 'account', label: 'Account issue' },
  { value: 'other', label: 'Other' },
];

/**
 * Tickets modal, opened from the sidebar support item.
 * Controlled component: pass `open` / `onClose`. Submits to the same
 * /api/support endpoint used by the admin ticket system.
 */
function SupportButton({ open, onClose }) {
  const [form, setForm] = useState({ category: 'bug', subject: '', message: '' });
  const [tickets, setTickets] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const authedFetch = useCallback(async (method, url, body) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      const r = await authedFetch('GET', `${API_URL}/api/support/mine`);
      setTickets(r.tickets || []);
    } catch {
      /* non-critical */
    }
  }, [authedFetch]);

  useEffect(() => {
    if (open) loadTickets();
  }, [open, loadTickets]);

  const handleSubmit = async () => {
    const subject = form.subject.trim();
    const message = form.message.trim();
    if (subject.length < 3) { setMsg('Subject must be at least 3 characters.'); return; }
    if (message.length < 5) { setMsg('Please describe the issue (at least 5 characters).'); return; }
    setBusy(true);
    setMsg('');
    try {
      await authedFetch('POST', `${API_URL}/api/support`, { app: 'billing', ...form, subject, message });
      setForm(p => ({ ...p, subject: '', message: '' }));
      setMsg('Ticket submitted. Our team will get back to you here.');
      await loadTickets();
    } catch (e) {
      setMsg('Could not submit ticket: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="support-overlay" onClick={onClose}>
      <div className="support-modal" onClick={e => e.stopPropagation()}>
            <div className="support-modal-header">
              <div>
                <div className="support-modal-title"><i className="fas fa-headset"></i> Tickets</div>
                <div className="support-modal-sub">Raise a ticket — the admin team will reply here</div>
              </div>
              <button className="support-modal-close" onClick={onClose} aria-label="Close">×</button>
            </div>

            <div className="support-modal-body">
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Subject</label>
                <input
                  value={form.subject}
                  maxLength={120}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="Short summary (e.g. Bill PDF not opening)"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={4}
                  maxLength={4000}
                  value={form.message}
                  onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Tell us what happened, what you expected and what went wrong..."
                />
              </div>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={busy} style={{ padding: '9px 22px' }}>
                {busy ? <><i className="fas fa-spinner fa-spin"></i> Sending...</> : <><i className="fas fa-paper-plane"></i> Submit ticket</>}
              </button>
              {msg && <div style={{ fontSize: 13, marginTop: 8, color: 'var(--color-text-muted)' }}>{msg}</div>}

              {tickets.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div className="support-modal-sub" style={{ marginBottom: 4 }}>Your recent tickets</div>
                  {tickets.map(t => (
                    <div key={t.id} className="support-ticket-item">
                      <div className="support-ticket-head">
                        <strong>{t.subject}</strong>
                        <span className={`support-ticket-status support-ticket-status--${t.status}`}>
                          {String(t.status).replace('_', ' ')}
                        </span>
                      </div>
                      <div className="support-ticket-meta">
                        {new Date(t.created_at).toLocaleString('en-IN')} &middot; {t.app}
                      </div>
                      {t.admin_reply && (
                        <div className="support-ticket-reply"><strong>Support:</strong> {t.admin_reply}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
  );
}

export default SupportButton;