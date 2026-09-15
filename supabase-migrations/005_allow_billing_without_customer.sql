ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allow_billing_without_customer BOOLEAN NOT NULL DEFAULT false;
