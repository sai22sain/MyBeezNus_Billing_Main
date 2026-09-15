const express = require('express');
const { requireAuth } = require('../lib/tenant');
const { getAdminClient } = require('../lib/supabase');

const router = express.Router();
router.use(requireAuth);

const TENANT_TABLES = [
  'ticket_replies',
  'support_tickets',
  'bills',
  'items',
  'categories',
  'customers',
  'sequences',
  'subscriptions',
  'profiles',
];

/** Permanently delete the authenticated admin's tenant and auth account. */
router.delete('/', async (req, res) => {
  const client = getAdminClient();
  const uid = req.user.uid;

  try {
    const { data: profile } = await client
      .from('profiles')
      .select('business_name, owner_name, phone')
      .eq('user_id', uid)
      .maybeSingle();

    const counts = await Promise.all(['bills', 'customers'].map(async (table) => {
      const { count, error } = await client
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid);
      if (error) throw error;
      return count || 0;
    }));

    const authUser = await client.auth.admin.getUserById(uid);
    if (authUser.error) throw authUser.error;

    const { error: auditError } = await client.from('deleted_accounts').insert({
      user_id: uid,
      email: authUser.data.user?.email || req.user.email || '',
      business_name: profile?.business_name || '',
      owner_name: profile?.owner_name || '',
      phone: profile?.phone || '',
      bills_count: counts[0],
      customers_count: counts[1],
      deleted_by: 'billing-admin',
    });
    if (auditError) throw auditError;

    for (const table of TENANT_TABLES) {
      const { error } = await client.from(table).delete().eq('user_id', uid);
      if (error) throw error;
    }

    const { error: authError } = await client.auth.admin.deleteUser(uid);
    if (authError) throw authError;

    return res.status(204).send();
  } catch (error) {
    console.error('[account] deletion failed:', error);
    return res.status(500).json({ error: 'Could not delete the account. No account changes were completed.' });
  }
});

module.exports = router;