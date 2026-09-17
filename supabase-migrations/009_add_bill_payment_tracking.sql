-- Add payment inputs used to derive bill payment status.
-- Existing bills remain unpaid by default; no historical amounts are changed.
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE public.bills
  DROP CONSTRAINT IF EXISTS bills_paid_amount_non_negative;

ALTER TABLE public.bills
  ADD CONSTRAINT bills_paid_amount_non_negative CHECK (paid_amount >= 0);

ALTER TABLE public.bills
  DROP CONSTRAINT IF EXISTS bills_paid_amount_not_over_total;

ALTER TABLE public.bills
  ADD CONSTRAINT bills_paid_amount_not_over_total CHECK (paid_amount <= final_amount);

CREATE INDEX IF NOT EXISTS idx_bills_due_date
  ON public.bills(user_id, due_date)
  WHERE due_date IS NOT NULL;
