import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './supabase-env';

// Same Supabase project as the website hospodavesnice.cz (project "hospoda-vesnice").
// The URL and publishable key are public by design; env vars can override them.

let client: SupabaseClient | null = null;

/**
 * Browser client with host-only cookies. Both apps share accounts, not tokens.
 */
export function getSupabase(): SupabaseClient {
    if (!client) {
        client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
            cookieOptions: { secure: typeof window !== 'undefined' && window.location.protocol === 'https:', sameSite: 'lax' },
        });
    }
    return client;
}
