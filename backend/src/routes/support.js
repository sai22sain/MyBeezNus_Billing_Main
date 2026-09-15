const express = require('express');
const { requireAuth } = require('../lib/tenant');
const { getAdminClient } = require('../lib/supabase');

const router = express.Router();

/* Every authenticated route here requires a valid Supabase JWT. */
router.use(requireAuth);

const APPS = ['billing'];
const CATEGORIES = ['bug', 'feature', 'billing', 'account', 'other'];

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
      .select('id, app, category, subject, message, status, admin_reply, created_at, updated_at')
      .eq('user_id', req.user.uid)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    return res.json({ tickets: data || [] });
  } catch (err) {
    console.error('[support] list failed:', err);
    return res.status(500).json({ error: 'Could not load your tickets.' });
  }
});

module.exports = router;