-- Atomic, user-scoped stock movement operation. Quantity is signed for
-- adjustments/sales and positive for stock-in/opening entries.
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_stock_quantity_non_negative;

CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  p_user_id UUID,
  p_item_id UUID,
  p_quantity NUMERIC,
  p_movement_type TEXT,
  p_bill_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.stock_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.items;
  v_allow_negative BOOLEAN;
  v_next NUMERIC;
  v_movement public.stock_movements;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'User identity mismatch';
  END IF;
  IF p_item_id IS NULL OR p_quantity IS NULL OR p_quantity = 0 THEN
    RAISE EXCEPTION 'A non-zero stock quantity is required';
  END IF;
  IF p_movement_type NOT IN ('OPENING', 'STOCK_IN', 'ADJUSTMENT', 'SALE', 'SALE_REVERSAL') THEN
    RAISE EXCEPTION 'Unsupported stock movement type';
  END IF;

  SELECT * INTO v_item
  FROM public.items
  WHERE id = p_item_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF v_item.item_type <> 'PRODUCT' OR NOT v_item.track_inventory THEN
    RAISE EXCEPTION 'Inventory is not enabled for this item';
  END IF;

  SELECT COALESCE(allow_negative_stock, false) INTO v_allow_negative
  FROM public.profiles WHERE user_id = p_user_id;
  v_next := v_item.stock_quantity + p_quantity;
  IF v_next < 0 AND NOT v_allow_negative THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  UPDATE public.items SET stock_quantity = v_next
  WHERE id = p_item_id AND user_id = p_user_id;

  INSERT INTO public.stock_movements(user_id, item_id, bill_id, movement_type, quantity, balance_after, notes)
  VALUES (p_user_id, p_item_id, p_bill_id, p_movement_type, p_quantity, v_next, p_notes)
  RETURNING * INTO v_movement;
  RETURN v_movement;
END;
$$;