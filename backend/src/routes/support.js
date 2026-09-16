const express = require('express');
const { requireAuth } = require('../lib/tenant');
const { getAdminClient } = require('../lib/supabase');

const router = express.Router();

/* Every authenticated route here requires a valid Supabase JWT. */
router.use(requireAuth);

const APPS = ['billing'];
const CATEGORIES = ['bug', 'feature', 'billing', 'account', 'other'];
const MAX_REPLY_LENGTH = 4000;
const REOPEN_WINDOW_DAYS = 15;
const REOPENABLE_STATUSES = ['resolved', 'closed'];

/**
 * POST /api/support
 * Raise a support ticket (any MyBeezNus app). Body: { app, category, subject, message }
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const app = APPS.includes(body.app) ? body.app : 'billing';
    const category = CATEGORIES.includes(body.category) ? body.category : 'other';
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();

    if (subject.length < 3 || subject.length > 120) {
      return res.status(400).json({ error: 'Subject must be 3-120 characters.' });
    }
    if (message.length < 5 || message.length > 4000) {
      return res.status(400).json({ error: 'Message must be 5-4000 characters.' });
    }

    const { data, error } = await getAdminClient()
      .from('support_tickets')
      .insert({ user_id: req.user.uid, app: app, category: category, subject: subject, message: message })
      .select('id, app, category, subject, status, created_at')
      .single();
    if (error) throw error;

    return res.status(201).json({ ticket: data });
  } catch (err) {
    console.error('[support] create failed:', err);
    return res.status(500).json({ error: 'Could not submit your ticket. Please try again.' });
  }
});

/**
 * GET /api/support/mine
 * The caller's own tickets, newest first (status + admin replies included).
 */
router.get('/mine', async (req, res) => {
  try {
    const { data, error } = await getAdminClient()
      .from('support_tickets')
      .select('id, app, category, subject, message, status, admin_reply, created_at, updated_at, resolved_at, closed_at, reopened_at, ticket_replies(id, sender, message, created_at)')
      .eq('user_id', req.user.uid)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const tickets = (data || []).map((ticket) => ({
      ...ticket,
      replies: (ticket.ticket_replies || []).sort(
        (left, right) => new Date(left.created_at) - new Date(right.created_at)
      ),
      ticket_replies: undefined,
    }));

    return res.json({ tickets });
  } catch (err) {
    console.error('[support] list failed:', err);
    return res.status(500).json({ error: 'Could not load your tickets.' });
  }
});

/**
 * POST /api/support/:ticketId/replies
 * Add a user follow-up to one of the caller's open tickets.
 */
router.post('/:ticketId/replies', async (req, res) => {
  try {
    const ticketId = String(req.params.ticketId || '').trim();
    const message = String(req.body?.message || '').trim();

    if (!ticketId) return res.status(400).json({ error: 'Ticket ID is required.' });
    if (message.length < 1 || message.length > MAX_REPLY_LENGTH) {
      return res.status(400).json({ error: `Message must be 1-${MAX_REPLY_LENGTH} characters.` });
    }

    const client = getAdminClient();
    const { data: ticket, error: ticketError } = await client
      .from('support_tickets')
      .select('id, status')
      .eq('id', ticketId)
      .eq('user_id', req.user.uid)
      .maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    if (['resolved', 'closed'].includes(ticket.status)) {
      return res.status(409).json({ error: 'Reopen this ticket before sending a follow-up.' });
    }

    const { data: reply, error: replyError } = await client
      .from('ticket_replies')
      .insert({ ticket_id: ticket.id, user_id: req.user.uid, sender: 'user', message })
      .select('id, ticket_id, sender, message, created_at')
      .single();
    if (replyError) throw replyError;

    return res.status(201).json({ reply });
  } catch (err) {
    console.error('[support] reply failed:', err);
    return res.status(500).json({ error: 'Could not add your follow-up. Please try again.' });
  }
});

/**
 * POST /api/support/:ticketId/reopen
 * Reopen a resolved or closed ticket within the 15-day customer window.
 */
router.post('/:ticketId/reopen', async (req, res) => {
  try {
    const ticketId = String(req.params.ticketId || '').trim();
    if (!ticketId) return res.status(400).json({ error: 'Ticket ID is required.' });

    const client = getAdminClient();
    const { data: ticket, error: ticketError } = await client
      .from('support_tickets')
      .select('id, status, resolved_at, closed_at, updated_at')
      .eq('id', ticketId)
      .eq('user_id', req.user.uid)
      .maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    if (!REOPENABLE_STATUSES.includes(ticket.status)) {
      return res.status(409).json({ error: 'Only resolved or closed tickets can be reopened.' });
    }

    const lifecycleDate = ticket.closed_at || ticket.resolved_at || ticket.updated_at;
    const lifecycleTime = new Date(lifecycleDate).getTime();
    const ageMs = Date.now() - lifecycleTime;
    if (!Number.isFinite(lifecycleTime) || ageMs < 0 || ageMs > REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      return res.status(409).json({ error: `Tickets can only be reopened within ${REOPEN_WINDOW_DAYS} days.` });
    }

    const now = new Date().toISOString();
    const { data: reopened, error: updateError } = await client
      .from('support_tickets')
      .update({ status: 'reopened', reopened_at: now, updated_at: now })
      .eq('id', ticket.id)
      .eq('user_id', req.user.uid)
      .select('id, status, updated_at, reopened_at')
      .single();
    if (updateError) throw updateError;

    return res.json({ ticket: reopened });
  } catch (err) {
    console.error('[support] reopen failed:', err);
    return res.status(500).json({ error: 'Could not reopen your ticket. Please try again.' });
  }
});

module.exports = router;