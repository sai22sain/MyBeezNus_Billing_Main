-- ============================================
-- Migration: 002_create_deleted_accounts_log.sql
-- Purpose: Keep an audit trail of accounts that the admin deleted, so the
--          admin dashboard can show "recent actions" even though the user
--          row itself (and their delete_requests rows) are gone.
-- Apply in Supabase Dashboard > SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.deleted_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT,
  business_name TEXT,
  owner_name TEXT,
  phone TEXT,
  bills_count INTEGER NOT NULL DEFAULT 0,
  customers_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by TEXT NOT NULL DEFAULT 'admin-dashboard',
  notes TEXT
);

-- Dashboard reads this table with the service-role key only.
ALTER TABLE public.deleted_accounts ENABLE ROW LEVEL SECURITY;
-- (no policies on purpose: only the service-role client can read/write it)

CREATE INDEX IF NOT EXISTS idx_deleted_accounts_deleted_at
  ON public.deleted_accounts(deleted_at DESC);

COMMENT ON TABLE public.deleted_accounts IS
  'Audit log written by the admin dashboard right before an account is permanently deleted.';