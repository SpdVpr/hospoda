export function safeAuthDestination(next: string | null): '/dashboard' | '/nove-heslo' {
  return next === '/nove-heslo' ? '/nove-heslo' : '/dashboard';
}

export function authCallbackUrl(origin: string, next: '/dashboard' | '/nove-heslo' = '/dashboard'): string {
  const url = new URL('/auth/callback', origin);
  url.searchParams.set('next', next);
  return url.toString();
}
