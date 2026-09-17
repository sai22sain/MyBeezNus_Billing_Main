-- Restore user-owned numbering. Existing records and their numbers are preserved.
-- The user-scoped unique indexes created by the base schema remain authoritative.

DROP INDEX IF EXISTS public.idx_bills_bill_number_global_unique;
DROP INDEX IF EXISTS public.idx_customers_customer_id_global_unique;

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
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  IF v_entity_type NOT IN ('bill', 'customer') THEN
    RAISE EXCEPTION 'Unsupported sequence entity type: %', p_entity_type;
  END IF;

  -- The sequence row is unique per user and entity, so this lock only
  -- serializes concurrent allocations within one user's sequence.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_entity_type, 0));

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
      SELECT 1 FROM public.bills WHERE user_id = p_user_id AND bill_number = v_candidate
    )) OR (v_entity_type = 'customer' AND NOT EXISTS (
      SELECT 1 FROM public.customers WHERE user_id = p_user_id AND customer_id = v_candidate
    )) THEN
      RETURN v_candidate;
    END IF;
  END LOOP;
END;
$$;