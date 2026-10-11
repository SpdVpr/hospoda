import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase-env';
import { safeAuthDestination } from '@/lib/auth-redirect';

/** Finish PKCE on the same host where the login started. Never send a session to the public site. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const destination = safeAuthDestination(request.nextUrl.searchParams.get('next'));
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.nextUrl.origin));
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  };
  if (code && !request.nextUrl.searchParams.has('error')) {
    const store = await cookies();
    const client = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookieOptions: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' },
      cookies: {
        getAll: () => store.getAll(),
        setAll: values => values.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    });
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return redirect(destination);
  }
  return redirect('/?chyba=odkaz');
}
