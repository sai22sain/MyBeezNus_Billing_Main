-- Ensure customer and bill numbers are globally unique across all businesses.
-- Existing duplicate values are preserved for the oldest record and the later
-- records receive a traceable legacy suffix before unique indexes are created.

DO $$
DECLARE
  duplicate_row RECORD;
BEGIN
  FOR duplicate_row IN
    SELECT id, customer_id,
           row_number() OVER (PARTITION BY customer_id ORDER BY created_at, id) AS duplicate_rank
    FROM public.customers
    WHERE customer_id IS NOT NULL
  LOOP
    IF duplicate_row.duplicate_rank > 1 THEN
      UPDATE public.customers
      SET customer_id = duplicate_row.customer_id || '-LEGACY-' || replace(duplicate_row.id::text, '-', '')
      WHERE id = duplicate_row.id;
    END IF;
  END LOOP;

  FOR duplicate_row IN
    SELECT id, bill_number,
           row_number() OVER (PARTITION BY bill_number ORDER BY created_at, id) AS duplicate_rank
    FROM public.bills
    WHERE bill_number IS NOT NULL
  LOOP
    IF duplicate_row.duplicate_rank > 1 THEN
      UPDATE public.bills
      SET bill_number = duplicate_row.bill_number || '-LEGACY-' || replace(duplicate_row.id::text, '-', '')
      WHERE id = duplicate_row.id;
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_customer_id_global_unique
  ON public.customers(customer_id)
  WHERE customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_bill_number_global_unique
  ON public.bills(bill_number)
  WHERE bill_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.next_sequence_number(
  p_user_id uuid,
  p_entity_type text,
  p_prefix text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type text := lower(p_entity_type);
  v_prefix text := upper(coalesce(p_prefix, CASE WHEN v_entity_type = 'customer' THEN 'CUST' ELSE 'BILL' END));
  v_last bigint;
  v_candidate text;
BEGIN
  IF v_entity_type NOT IN ('bill', 'customer') THEN
    RAISE EXCEPTION 'Unsupported sequence entity type: %', p_entity_type;
  END IF;

  -- Serialize allocation for a prefix/entity pair across all businesses.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_entity_type || ':' || v_prefix, 0));

  LOOP
    INSERT INTO public.sequences (user_id, entity_type, prefix, last_number)
    VALUES (p_user_id, v_entity_type, v_prefix, 1)
    ON CONFLICT (user_id, entity_type)
    DO UPDATE SET last_number = public.sequences.last_number + 1,
                  prefix = excluded.prefix,
                  updated_at = now()
    RETURNING last_number INTO v_last;

    v_candidate := v_prefix || '-' || lpad(v_last::text, 5, '0');

    IF (v_entity_type = 'bill' AND NOT EXISTS (
      SELECT 1 FROM public.bills WHERE bill_number = v_candidate
    )) OR (v_entity_type = 'customer' AND NOT EXISTS (
      SELECT 1 FROM public.customers WHERE customer_id = v_candidate
    )) THEN
      RETURN v_candidate;
    END IF;
  END LOOP;
END;
$$;
