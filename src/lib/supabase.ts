import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// Same Supabase project as the website hospodavesnice.cz (project "hospoda-vesnice").
// The URL and publishable key are public by design; env vars can override them.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ucxnvmvxwvhcakradpgg.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ig8rfPAJlf8lok1j6R35lw_rsGdvjFr';

let client: SupabaseClient | null = null;

/**
 * Browser client. On *.hospodavesnice.cz the session cookie is shared with the
 * website admin (www.hospodavesnice.cz/admin), so one login works for both.
 */
export function getSupabase(): SupabaseClient {
    if (!client) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
            cookieOptions: host.endsWith('hospodavesnice.cz') ? { domain: '.hospodavesnice.cz' } : undefined,
        });
    }
    return client;
}
