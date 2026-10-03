import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * DEV ONLY – one-off Firebase → Supabase migration (/migrace).
 * Reads all Firestore collections server-side as the old shared admin account
 * (admin@hospoda.local, password from NEXT_PUBLIC_ADMIN_PASSWORD in .env.local),
 * so nobody has to sign in to the old app. Only an admin of the new app may call it.
 */

const COLLECTIONS = ['users', 'shifts', 'tasks', 'announcements', 'gallery'] as const;

type Value = {
    nullValue?: null;
    booleanValue?: boolean;
    integerValue?: string;
    doubleValue?: number;
    timestampValue?: string;
    stringValue?: string;
    referenceValue?: string;
    arrayValue?: { values?: Value[] };
    mapValue?: { fields?: Record<string, Value> };
};

function decode(v: Value): unknown {
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.timestampValue !== undefined) return v.timestampValue;
    if (v.arrayValue !== undefined) return (v.arrayValue.values ?? []).map(decode);
    if (v.mapValue !== undefined) return decodeFields(v.mapValue.fields);
    return v.referenceValue ?? null;
}

const decodeFields = (fields: Record<string, Value> = {}) =>
    Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));

async function isNewAppAdmin(request: NextRequest): Promise<boolean> {
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!token) return false;
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ucxnvmvxwvhcakradpgg.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ig8rfPAJlf8lok1j6R35lw_rsGdvjFr',
        { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
    );
    const { data } = await supabase.rpc('team_role');
    return data === 'admin';
}

export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV !== 'development') {
        return new Response('Not found', { status: 404 });
    }
    if (!(await isNewAppAdmin(request))) {
        return Response.json({ error: 'Jen pro admina nové aplikace.' }, { status: 403 });
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const password = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (!apiKey || !projectId || !password) {
        return Response.json({ error: 'V .env.local chybí Firebase konfigurace nebo NEXT_PUBLIC_ADMIN_PASSWORD.' }, { status: 400 });
    }

    const login = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'admin@hospoda.local', password, returnSecureToken: true }),
    });
    const auth = (await login.json()) as { idToken?: string; error?: { message?: string } };
    if (!login.ok || !auth.idToken) {
        return Response.json({ error: `Přihlášení původního admina selhalo: ${auth.error?.message ?? login.status}` }, { status: 502 });
    }

    const data: Record<string, unknown[]> = {};
    const errors: Record<string, string> = {};
    for (const name of COLLECTIONS) {
        const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
            method: 'POST',
            headers: { authorization: `Bearer ${auth.idToken}`, 'content-type': 'application/json' },
            body: JSON.stringify({ structuredQuery: { from: [{ collectionId: name }] } }),
        });
        const rows = (await res.json()) as Array<{ document?: { name: string; fields?: Record<string, Value> } }> | { error?: { message?: string } };
        if (!res.ok || !Array.isArray(rows)) {
            data[name] = [];
            errors[name] = (rows as { error?: { message?: string } }).error?.message ?? String(res.status);
            continue;
        }
        data[name] = rows.flatMap((r) => {
            if (!r.document) return [];
            const id = r.document.name.slice(r.document.name.lastIndexOf('/') + 1);
            return [{ ...decodeFields(r.document.fields), [name === 'users' ? 'uid' : 'id']: id }];
        });
    }

    return Response.json({ data, errors });
}
