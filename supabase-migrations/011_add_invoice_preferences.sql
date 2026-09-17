ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invoice_template TEXT,
  ADD COLUMN IF NOT EXISTS invoice_accent_color TEXT;
