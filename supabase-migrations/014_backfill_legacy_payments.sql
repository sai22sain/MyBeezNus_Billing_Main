-- Preserve existing bill-level payments in the new transaction ledger.
-- This is idempotent and only creates a row when no transaction exists yet.
INSERT INTO public.payment_transactions (
  user_id, bill_id, customer_id, amount, payment_mode, payment_date, notes, created_at
)
SELECT
  b.user_id,
  b.id,
  b.customer_id,
  b.paid_amount,
  COALESCE(NULLIF(b.payment_mode, ''), 'Cash'),
  COALESCE(b.created_at::date, CURRENT_DATE),
  'Imported from bill payment total',
  b.created_at
FROM public.bills b
WHERE b.paid_amount > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.payment_transactions p
    WHERE p.user_id = b.user_id AND p.bill_id = b.id
  );