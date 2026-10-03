import type { NextRequest } from 'next/server';

/**
 * DEV ONLY – one-off Firebase → Supabase migration (/migrace).
 * Firebase Storage blocks browser downloads (no CORS), so the dev server fetches
 * the photo and hands it to the page, which uploads it to Supabase Storage.
 */
export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV !== 'development') {
        return new Response('Not found', { status: 404 });
    }
    let url: URL;
    try {
        url = new URL(request.nextUrl.searchParams.get('url') ?? '');
    } catch {
        return new Response('Bad url', { status: 400 });
    }
    if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') {
        return new Response('Only Firebase Storage URLs', { status: 400 });
    }
    const upstream = await fetch(url, { cache: 'no-store' });
    if (!upstream.ok) {
        return new Response(`Firebase ${upstream.status}`, { status: 502 });
    }
    return new Response(upstream.body, {
        headers: { 'content-type': upstream.headers.get('content-type') ?? 'image/jpeg' },
    });
}
