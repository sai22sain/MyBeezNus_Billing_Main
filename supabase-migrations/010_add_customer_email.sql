-- Optional customer email for Gmail compose workflows.
-- Existing customers remain valid with email = NULL; RLS is unchanged.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS email TEXT;
