import { createClient } from '@supabase/supabase-js';

// These come from the .env file locally, and from Netlify's environment variables online.
// The publishable (anon) key is safe in the browser: the database rules only let it ADD rows.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. See README step 2.');
}

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key', {
  auth: { persistSession: false },
});
