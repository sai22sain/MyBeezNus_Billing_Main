-- Ensure the security-definer payment function can only be called for the
-- authenticated user's own data.
CREATE OR REPLACE FUNCTION public.record_payment(
  p_user_id UUID,
  p_bill_id UUID,
  p_amount NUMERIC,
  p_payment_mode TEXT DEFAULT 'Cash',
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.payment_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill public.bills;
  v_paid NUMERIC;
  v_payment public.payment_transactions;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'User identity mismatch';
  END IF;
  IF p_bill_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'A positive payment amount and bill are required';
  END IF;

  SELECT * INTO v_bill
  FROM public.bills
  WHERE id = p_bill_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.payment_transactions
  WHERE bill_id = p_bill_id AND user_id = p_user_id;
  IF v_paid + p_amount > v_bill.final_amount THEN
    RAISE EXCEPTION 'Payment exceeds the outstanding balance';
  END IF;

  INSERT INTO public.payment_transactions(user_id, bill_id, customer_id, amount, payment_mode, payment_date, notes)
  VALUES (p_user_id, p_bill_id, v_bill.customer_id, p_amount, COALESCE(NULLIF(p_payment_mode, ''), 'Cash'), COALESCE(p_payment_date, CURRENT_DATE), p_notes)
  RETURNING * INTO v_payment;

  UPDATE public.bills
  SET paid_amount = v_paid + p_amount,
      payment_mode = COALESCE(NULLIF(p_payment_mode, ''), payment_mode)
  WHERE id = p_bill_id AND user_id = p_user_id;

  RETURN v_payment;
END;
$$;