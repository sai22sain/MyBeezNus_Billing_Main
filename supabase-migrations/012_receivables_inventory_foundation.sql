-- Additive foundation for receivables and optional inventory tracking.
-- Existing bills/items remain valid and continue to work when inventory is disabled.

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_bill
  ON public.payment_transactions(user_id, bill_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_customer
  ON public.payment_transactions(user_id, customer_id, payment_date DESC);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_transactions_select_own ON public.payment_transactions;
CREATE POLICY payment_transactions_select_own ON public.payment_transactions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS payment_transactions_insert_own ON public.payment_transactions;
CREATE POLICY payment_transactions_insert_own ON public.payment_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'SERVICE'
    CHECK (item_type IN ('SERVICE', 'PRODUCT')),
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(14, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_stock_quantity_non_negative;
ALTER TABLE public.items
  ADD CONSTRAINT items_stock_quantity_non_negative CHECK (stock_quantity >= 0);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('OPENING', 'STOCK_IN', 'ADJUSTMENT', 'SALE', 'SALE_REVERSAL')),
  quantity NUMERIC(14, 3) NOT NULL CHECK (quantity <> 0),
  balance_after NUMERIC(14, 3) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_user_item
  ON public.stock_movements(user_id, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_bill
  ON public.stock_movements(user_id, bill_id);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_movements_select_own ON public.stock_movements;
CREATE POLICY stock_movements_select_own ON public.stock_movements
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS stock_movements_insert_own ON public.stock_movements;
CREATE POLICY stock_movements_insert_own ON public.stock_movements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS inventory_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN NOT NULL DEFAULT false;

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
  IF p_user_id IS NULL OR p_bill_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
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