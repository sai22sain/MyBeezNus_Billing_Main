import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { showToast } from '../services/notificationService';

const API_URL = process.env.REACT_APP_API_URL ?? '';
const MAX_MESSAGE_LENGTH = 4000;
const CATEGORIES = [
  { value: 'bug', label: 'Bug / something not working' },
  { value: 'feature', label: 'Feature request' },
  { value: 'billing', label: 'Billing / payment issue' },
  { value: 'account', label: 'Account issue' },
  { value: 'other', label: 'Other' },
];
const STATUS_COLORS = { open: '#f59e0b', in_progress: '#3b82f6', awaiting_user_info: '#8b5cf6', resolved: '#22c55e', closed: '#6b7280', reopened: '#0ea5e9' };
const STATUS_LABELS = { open: 'Open', in_progress: 'In progress', awaiting_user_info: 'Awaiting your info', resolved: 'Resolved', closed: 'Closed', reopened: 'Reopened' };
const ticketRef = (id) => String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();

const formatTime = (value) => value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const formatPreviewTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toDateString() === new Date().toDateString() ? date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const getMessages = (ticket) => {
  if (!ticket) return [];
  const initial = ticket.message ? [{ id: `initial-${ticket.id}`, sender: 'user', message: ticket.message, created_at: ticket.created_at }] : [];
  const replies = (ticket.replies || []).map(reply => ({ ...reply, sender: reply.sender || 'admin' }));
  const legacy = ticket.admin_reply && !replies.some(reply => reply.message === ticket.admin_reply) ? [{ id: `legacy-admin-${ticket.id}`, sender: 'admin', message: ticket.admin_reply, created_at: ticket.updated_at || ticket.created_at }] : [];
  return [...initial, ...replies, ...legacy].sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
};

function Support() {
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ category: 'bug', subject: '', message: '' });
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [mobileConversation, setMobileConversation] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  const authedFetch = useCallback(async (method, url, body) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }, []);

  const loadTickets = useCallback(async (keepSelection = true) => {
    setLoadError('');
    try {
      const result = await authedFetch('GET', `${API_URL}/api/support/mine`);
      const nextTickets = Array.isArray(result.tickets) ? result.tickets : [];
      setTickets(nextTickets);
      if (!keepSelection) setSelectedId(nextTickets[0]?.id || null);
    } catch {
      setLoadError('Unable to load your conversations. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { loadTickets(false); }, [loadTickets]);

  const selectedTicket = tickets.find(ticket => ticket.id === selectedId) || null;
  const messages = useMemo(() => getMessages(selectedTicket), [selectedTicket]);
  const visibleTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tickets.filter(ticket => {
      const haystack = [ticket.subject, ticket.message, ticket.app, ticket.id, ...(ticket.replies || []).map(reply => reply.message)].join(' ').toLowerCase();
      return (filter === 'all' || ticket.status === filter) && (!query || haystack.includes(query));
    });
  }, [filter, search, tickets]);

  useEffect(() => {
    if (!selectedTicket) return undefined;
    const frame = requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }));
    return () => cancelAnimationFrame(frame);
  }, [selectedId, selectedTicket, messages.length]);

  const copyTicketId = async () => {
    try {
      await navigator.clipboard.writeText(selectedTicket.id);
      setCopiedId(selectedTicket.id);
    } catch {
      showToast({ type: 'error', message: 'Could not copy the ticket ID.' });
    }
  };

  const renderStatus = (status) => <span className="support-inbox-status" style={{ color: STATUS_COLORS[status] || STATUS_COLORS.open }}><span className="support-inbox-status-dot" /><span className="support-ticket-status">{String(status || 'open').replace('_', ' ')}</span><span className="support-ticket-status-label">{STATUS_LABELS[status] || String(status || 'open').replace('_', ' ')}</span></span>;

  const handleReopenTicket = async () => {
    if (!selectedTicket || reopening) return;
    setReopening(true);
    try {
      const result = await authedFetch('POST', `${API_URL}/api/support/${selectedTicket.id}/reopen`);
      setTickets(current => current.map(ticket => ticket.id === selectedTicket.id
        ? { ...ticket, ...result.ticket }
        : ticket));
      showToast({ type: 'success', message: 'Ticket reopened. You can continue the conversation.' });
    } catch (error) {
      showToast({ type: 'error', message: error.message || 'Unable to reopen this ticket.' });
    } finally {
      setReopening(false);
    }
  };

  const handleSendReply = async () => {
    const text = composerText.trim();
    if (!selectedTicket || !text || sending) return;
    if (text.length > MAX_MESSAGE_LENGTH) return showToast({ type: 'warning', message: `Reply must be ${MAX_MESSAGE_LENGTH} characters or fewer.` });
    const optimisticReply = { id: `pending-${Date.now()}`, sender: 'user', message: text, created_at: new Date().toISOString(), pending: true };
    setSending(true);
    setComposerText('');
    setTickets(current => current.map(ticket => ticket.id === selectedTicket.id ? { ...ticket, replies: [...(ticket.replies || []), optimisticReply], updated_at: optimisticReply.created_at } : ticket));
    try {
      const result = await authedFetch('POST', `${API_URL}/api/support/${selectedTicket.id}/replies`, { message: text });
      setTickets(current => current.map(ticket => ticket.id === selectedTicket.id ? { ...ticket, replies: (ticket.replies || []).map(reply => reply.id === optimisticReply.id ? result.reply : reply), updated_at: result.reply.created_at } : ticket));
      showToast({ type: 'success', message: 'Reply sent.' });
    } catch {
      setComposerText(text);
      setTickets(current => current.map(ticket => ticket.id === selectedTicket.id ? { ...ticket, replies: (ticket.replies || []).filter(reply => reply.id !== optimisticReply.id) } : ticket));
      showToast({ type: 'error', message: 'Unable to send your reply. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  const handleCreateTicket = async () => {
    const subject = form.subject.trim();
    const message = form.message.trim();
    if (subject.length < 3) return showToast({ type: 'warning', message: 'Subject must be at least 3 characters.' });
    if (message.length < 5) return showToast({ type: 'warning', message: 'Please describe the issue in at least 5 characters.' });
    setCreating(true);
    try {
      const result = await authedFetch('POST', `${API_URL}/api/support`, { app: 'billing', ...form, subject, message });
      setForm({ category: 'bug', subject: '', message: '' });
      setShowNewTicket(false);
      await loadTickets(false);
      if (result.ticket?.id) { setSelectedId(result.ticket.id); setMobileConversation(true); }
      showToast({ type: 'success', message: 'Ticket created successfully.' });
    } catch {
      showToast({ type: 'error', message: 'Unable to create your ticket. Please try again.' });
    } finally {
      setCreating(false);
    }
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSendReply(); }
  };

  return (
    <div className="support-workspace">
      <div className="page-header support-page-header"><div><h1>Tickets</h1><p>Support conversations for your business</p></div><button className="btn btn-primary" onClick={() => setShowNewTicket(true)}><i className="fas fa-plus" /> New ticket</button></div>
      <div className="support-inbox">
        <aside className={`support-inbox-list${mobileConversation ? ' support-inbox-list--mobile-hidden' : ''}`}>
          <div className="support-inbox-list-header"><div><strong>My conversations</strong><span>{tickets.length} total</span></div><button className="support-inbox-new" type="button" onClick={() => setShowNewTicket(true)} aria-label="Create new ticket" title="Create new ticket"><i className="fas fa-plus" /></button></div>
          <label className="support-inbox-search"><i className="fas fa-search" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></label>
          <div className="support-inbox-filters" role="tablist" aria-label="Ticket filters">{[['all', 'All'], ['open', 'Open'], ['in_progress', 'In progress'], ['awaiting_user_info', 'Awaiting info'], ['reopened', 'Reopened'], ['resolved', 'Resolved'], ['closed', 'Closed']].map(([value, label]) => <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
          <div className="support-inbox-items">
            {loading && <div className="support-inbox-state"><i className="fas fa-spinner fa-spin" /> Loading conversations...</div>}
            {!loading && loadError && <div className="support-inbox-state support-inbox-state--error"><p>{loadError}</p><button className="btn btn-ghost" onClick={() => loadTickets(false)}>Try again</button></div>}
            {!loading && !loadError && visibleTickets.length === 0 && <div className="support-inbox-state"><i className="fas fa-comments" /><strong>{tickets.length ? 'No conversations found' : 'No conversations yet'}</strong><span>{tickets.length ? 'Try another search or filter.' : 'Create a support ticket and we will help you here.'}</span>{!tickets.length && <button className="btn btn-primary" onClick={() => setShowNewTicket(true)}>New ticket</button>}</div>}
            {visibleTickets.map(ticket => { const ticketMessages = getMessages(ticket); const lastMessage = ticketMessages[ticketMessages.length - 1]; return <button key={ticket.id} type="button" className={`support-inbox-item${selectedId === ticket.id ? ' is-selected' : ''}`} onClick={() => { setSelectedId(ticket.id); setMobileConversation(true); setComposerText(''); }}><span className="support-inbox-item-icon"><i className="fas fa-headset" /></span><span className="support-inbox-item-content"><span className="support-inbox-item-top"><strong>{ticket.subject}</strong><time>{formatPreviewTime(ticket.updated_at || lastMessage?.created_at || ticket.created_at)}</time></span><span className="support-inbox-item-preview">{lastMessage?.message || ticket.message}</span><span className="support-inbox-item-bottom">{renderStatus(ticket.status)}<span>Ticket #{ticketRef(ticket.id)}</span></span></span></button>; })}
          </div>
        </aside>
        <section className={`support-conversation${mobileConversation ? ' support-conversation--mobile-visible' : ''}`} aria-label="Ticket conversation">
          {!selectedTicket ? <div className="support-conversation-empty"><i className="fas fa-comments" /><h2>Select a conversation</h2><p>Choose a ticket from the inbox to read the full conversation.</p></div> : <>
            <header className="support-conversation-header"><button className="support-mobile-back" type="button" onClick={() => setMobileConversation(false)} aria-label="Back to tickets"><i className="fas fa-arrow-left" /></button><div className="support-conversation-heading"><div className="support-conversation-title-row"><h2>{selectedTicket.subject}</h2><span className="support-ticket-id"><span className="support-ticket-id-label">Ticket #{ticketRef(selectedTicket.id)}</span><button type="button" className="support-ticket-copy" onClick={copyTicketId} aria-label={`Copy ticket ID ${selectedTicket.id}`} title="Copy ticket ID"><i className={`fas ${copiedId === selectedTicket.id ? 'fa-check' : 'fa-copy'}`} /></button>{copiedId === selectedTicket.id && <span className="support-ticket-copy-hint">Copied!</span>}</span></div><div className="support-conversation-meta">{selectedTicket.app} <span>·</span> {renderStatus(selectedTicket.status)}</div></div></header>
            <div className="support-message-list"><div className="support-conversation-intro"><span className="support-conversation-intro-icon"><i className="fas fa-headset" /></span><strong>MyBeezNus Support</strong><span>Conversation started {formatTime(selectedTicket.created_at)}</span></div>{messages.map((message, index) => { const isUser = message.sender === 'user'; const grouped = messages[index - 1]?.sender === message.sender; return <div key={message.id} className={`support-message-row support-message-row--${isUser ? 'user' : 'admin'}${grouped ? ' support-message-row--grouped' : ''}`}>{!grouped && <span className="support-message-avatar"><i className={`fas ${isUser ? 'fa-user' : 'fa-user-shield'}`} /></span>}<div className="support-message-content">{!grouped && <div className="support-message-sender">{isUser ? 'You' : 'Support'}</div>}<div className={`support-message-bubble${message.pending ? ' is-pending' : ''}`}>{message.message}</div><time className="support-message-time">{message.pending ? 'Sending...' : formatTime(message.created_at)}</time></div></div>; })}<div ref={messagesEndRef} /></div>
            {['resolved', 'closed'].includes(selectedTicket.status) ? <div className="support-conversation-closed"><i className="fas fa-lock" /> This ticket is {STATUS_LABELS[selectedTicket.status].toLowerCase()}. <button className="btn btn-ghost support-reopen-btn" type="button" onClick={handleReopenTicket} disabled={reopening}>{reopening ? <><i className="fas fa-spinner fa-spin" /> Reopening...</> : <><i className="fas fa-redo" /> Reopen ticket</>}</button></div> : <div className="support-composer support-followup"><textarea className="support-followup-textarea" value={composerText} maxLength={MAX_MESSAGE_LENGTH} rows={2} onChange={event => setComposerText(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="Write a reply..." aria-label="Write a reply" /><div className="support-composer-footer"><span>Enter to send · Shift + Enter for a new line</span><button className="btn btn-primary support-followup-btn" type="button" onClick={handleSendReply} disabled={sending || !composerText.trim()}>{sending ? <><i className="fas fa-spinner fa-spin" /> Sending...</> : <><i className="fas fa-paper-plane" /> Send</>}</button></div></div>}
          </>}
        </section>
      </div>
      {showNewTicket && <div className="support-dialog-backdrop" role="presentation" onClick={() => !creating && setShowNewTicket(false)}><div className="support-dialog" role="dialog" aria-modal="true" aria-labelledby="new-ticket-title" onClick={event => event.stopPropagation()}><div className="support-dialog-header"><div><h2 id="new-ticket-title">New support ticket</h2><p>Start a conversation with the MyBeezNus team.</p></div><button type="button" onClick={() => setShowNewTicket(false)} disabled={creating} aria-label="Close"><i className="fas fa-times" /></button></div><div className="support-dialog-body"><label className="form-group"><span>Category</span><select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))}>{CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label className="form-group"><span>Subject</span><input value={form.subject} maxLength={120} onChange={event => setForm(current => ({ ...current, subject: event.target.value }))} placeholder="Short summary of the issue" /></label><label className="form-group"><span>Message</span><textarea rows={6} maxLength={MAX_MESSAGE_LENGTH} value={form.message} onChange={event => setForm(current => ({ ...current, message: event.target.value }))} placeholder="Tell us what happened and how we can help..." /></label></div><div className="support-dialog-footer"><button className="btn btn-ghost" type="button" onClick={() => setShowNewTicket(false)} disabled={creating}>Cancel</button><button className="btn btn-primary" type="button" onClick={handleCreateTicket} disabled={creating}>{creating ? <><i className="fas fa-spinner fa-spin" /> Creating...</> : <><i className="fas fa-paper-plane" /> Create ticket</>}</button></div></div></div>}
    </div>
  );
}

export default Support;
