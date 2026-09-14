import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://jmkeprzrtfmoymwnqfpu.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impta2VwcnpydGZtb3ltd25xZnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTMyNTQsImV4cCI6MjEwNDYyOTI1NH0.yK5DRoBtisTodlBNkij3-mGnFyB7IXIYRPE8K6i30lY';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.info('Using built-in Supabase project fallback (set REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY to override)');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = true;
