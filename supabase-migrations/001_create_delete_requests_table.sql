-- ============================================
-- Migration: 001_create_delete_requests_table.sql
-- Purpose: Track user-initiated account deletion requests
-- Apply in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.delete_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT
);

-- 2. Enable RLS
ALTER TABLE public.delete_requests ENABLE ROW LEVEL SECURITY;

-- 3. Users may create a request only for their own account
DROP POLICY IF EXISTS users_create_request ON public.delete_requests;
CREATE POLICY users_create_request ON public.delete_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Users may view their own requests
DROP POLICY IF EXISTS users_view_own_request ON public.delete_requests;
CREATE POLICY users_view_own_request ON public.delete_requests
  FOR SELECT USING (auth.uid() = user_id);

-- 5. The admin dashboard uses the service-role key, which bypasses RLS
--    entirely, so no admin policy is required here.

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_delete_requests_user_id
  ON public.delete_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_delete_requests_status
  ON public.delete_requests(status, requested_at DESC);

-- 7. Only one pending request per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_delete_requests_one_pending
  ON public.delete_requests(user_id)
  WHERE status = 'pending';

-- 8. Documentation
COMMENT ON TABLE public.delete_requests IS
  'User-initiated account deletion requests. Status: pending -> approved/rejected by admin.';