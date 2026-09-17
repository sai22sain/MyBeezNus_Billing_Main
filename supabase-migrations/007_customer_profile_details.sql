-- Optional customer profile details used by the customer context and history views.
-- Existing rows remain valid and RLS policies are unchanged.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS customer_type TEXT;