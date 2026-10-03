'use client';

// DEV ONLY – one-off migration of the staff app data from Firebase to Supabase.
// 1) sign in to the new app as admin (Supabase), 2) "Převést" exports Firestore
// (server-side as the old shared admin, or as a manually signed-in Firebase user),
// imports it (RPC team_import, also removing rows deleted in Firebase since the last run)
// and copies INSTAVES photos to Supabase Storage.
// Remove this page, /api/migrace and src/lib/firebase.ts once the migration is done.

import { useState } from 'react';
import Link from 'next/link';
import { collection, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth as fbAuth, db as fbDb, googleProvider } from '@/lib/firebase';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const COLLECTIONS = ['users', 'shifts', 'tasks', 'announcements', 'gallery'] as const;
type Export = Record<string, Record<string, unknown>[]>;

/** Firestore Timestamps → ISO strings, recursively. */
function plain(value: unknown): unknown {
    if (value && typeof value === 'object') {
        if ('toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
            return (value as { toDate: () => Date }).toDate().toISOString();
        }
        if (value instanceof Date) return value.toISOString();
        if (Array.isArray(value)) return value.map(plain);
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
    }
    return value;
}

const box: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 4px 20px rgba(0,0,0,.06)' };
const btn: React.CSSProperties = { padding: '10px 18px', borderRadius: 999, border: 0, background: '#1d3c24', color: '#fff', fontWeight: 600, cursor: 'pointer', marginRight: 8 };
const input: React.CSSProperties = { padding: 10, borderRadius: 8, border: '1px solid #ccc', marginRight: 8, minWidth: 220 };

export default function MigrationPage() {
    const { userProfile, isAdmin, loading } = useAuth();
    const [fbUser, setFbUser] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [log, setLog] = useState<string[]>([]);
    const say = (line: string) => setLog((l) => [...l, line]);

    if (process.env.NODE_ENV !== 'development') {
        return <p style={{ padding: 40 }}>Nenalezeno.</p>;
    }

    const firebaseLogin = async (google: boolean) => {
        try {
            const cred = google ? await signInWithPopup(fbAuth, googleProvider) : await signInWithEmailAndPassword(fbAuth, email, password);
            setFbUser(cred.user.email ?? cred.user.uid);
            setPassword('');
        } catch (err) {
            say(`Přihlášení do Firebase selhalo: ${err instanceof Error ? err.message : err}`);
        }
    };

    /** Export as the manually signed-in Firebase user (fallback). `complete` = collections read in full. */
    const exportInBrowser = async (): Promise<{ data: Export; complete: string[] }> => {
        const data: Export = {};
        const complete: string[] = [];
        for (const name of COLLECTIONS) {
            try {
                const snap = await getDocs(collection(fbDb, name));
                data[name] = snap.docs.map((d) => ({ ...(plain(d.data()) as Record<string, unknown>), [name === 'users' ? 'uid' : 'id']: d.id }));
                complete.push(name);
            } catch (err) {
                data[name] = [];
                say(`Firebase ${name}: NELZE PŘEČÍST (${err instanceof Error ? err.message : err})`);
            }
        }
        return { data, complete };
    };

    /** Export on the dev server as the old shared admin account. */
    const exportOnServer = async (): Promise<{ data: Export; complete: string[] }> => {
        const { data: session } = await getSupabase().auth.getSession();
        const res = await fetch('/api/migrace/export', { headers: { Authorization: `Bearer ${session.session?.access_token ?? ''}` } });
        const body = (await res.json()) as { data?: Export; errors?: Record<string, string>; error?: string };
        if (!res.ok || !body.data) throw new Error(body.error ?? `Export selhal (${res.status})`);
        for (const [name, message] of Object.entries(body.errors ?? {})) say(`Firebase ${name}: NELZE PŘEČÍST (${message})`);
        return { data: body.data, complete: COLLECTIONS.filter((name) => !body.errors?.[name]) };
    };

    const migrate = async () => {
        setBusy(true);
        setLog([]);
        const supabase = getSupabase();
        try {
            // 1) Export
            const { data, complete } = fbUser ? await exportInBrowser() : await exportOnServer();
            for (const name of COLLECTIONS) say(`Firebase ${name}: ${data[name]?.length ?? 0}`);

            // 2) Import (+ removal of rows deleted in Firebase, only for collections read in full)
            const { data: result, error } = await supabase.rpc('team_import', { p_data: { ...data, complete } });
            if (error) throw new Error(error.message);
            say(`Supabase import: ${JSON.stringify(result)}`);

            // 3) Photos
            const { data: photos, error: photoError } = await supabase
                .from('team_photos')
                .select('id, image_url, uploaded_by, legacy_id')
                .is('storage_path', null)
                .like('image_url', 'https://firebasestorage.googleapis.com/%');
            if (photoError) throw new Error(photoError.message);
            say(`Fotek ke zkopírování: ${photos.length}`);
            let copied = 0;
            for (const p of photos) {
                try {
                    const res = await fetch(`/api/migrace/image?url=${encodeURIComponent(p.image_url)}`);
                    if (!res.ok) throw new Error(await res.text());
                    const blob = await res.blob();
                    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
                    const path = `${p.uploaded_by ?? 'legacy'}/legacy-${p.legacy_id ?? p.id}.${ext}`;
                    const up = await supabase.storage.from('instaves').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
                    if (up.error && !/exists/i.test(up.error.message)) throw new Error(up.error.message);
                    const url = supabase.storage.from('instaves').getPublicUrl(path).data.publicUrl;
                    const { error: updError } = await supabase.from('team_photos').update({ image_url: url, storage_path: path }).eq('id', p.id);
                    if (updError) throw new Error(updError.message);
                    copied++;
                } catch (err) {
                    say(`Fotka ${p.legacy_id}: ${err instanceof Error ? err.message : err}`);
                }
            }
            say(`Zkopírováno fotek: ${copied} / ${photos.length}`);
            say('Hotovo.');
        } catch (err) {
            say(`CHYBA: ${err instanceof Error ? err.message : err}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <main style={{ maxWidth: 760, margin: '40px auto', padding: 16, fontFamily: 'system-ui, sans-serif', color: '#1d1d1d' }}>
            <h1 style={{ marginBottom: 8 }}>Převod dat z Firebase do Supabase</h1>
            <p style={{ marginBottom: 24, color: '#555' }}>Jednorázový nástroj, běží jen lokálně. Převod lze bezpečně spustit opakovaně – nic se nezdvojí.</p>

            <section style={box}>
                <h2>1. Nová aplikace (Supabase)</h2>
                {loading ? <p>Načítám…</p> : isAdmin ? (
                    <p>✓ Přihlášen jako admin: {userProfile?.email}</p>
                ) : (
                    <p>Přihlaste se nejdřív <Link href="/" style={{ textDecoration: 'underline' }}>do nové aplikace</Link> jako admin (např. admin@hospodavesnice.cz) a vraťte se sem.</p>
                )}
            </section>

            <section style={box}>
                <h2>2. Stará aplikace (Firebase)</h2>
                {fbUser ? (
                    <p>✓ Data se načtou jako {fbUser} <button style={{ ...btn, background: '#888', marginLeft: 8 }} onClick={() => signOut(fbAuth).then(() => setFbUser(null))}>Zrušit</button></p>
                ) : (
                    <>
                        <p>Není potřeba nic dělat – data se načtou přes původní admin účet aplikace (heslo z <code>.env.local</code>).</p>
                        <details style={{ marginTop: 12 }}>
                            <summary style={{ cursor: 'pointer' }}>Nebo se přihlásit do Firebase ručně</summary>
                            <div style={{ marginTop: 12 }}>
                                <button style={btn} onClick={() => firebaseLogin(true)}>Přihlásit přes Google</button>
                                <form style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); firebaseLogin(false); }}>
                                    <input style={input} type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                                    <input style={input} type="password" placeholder="heslo" value={password} onChange={(e) => setPassword(e.target.value)} />
                                    <button style={btn} type="submit">Přihlásit e-mailem</button>
                                </form>
                            </div>
                        </details>
                    </>
                )}
            </section>

            <section style={box}>
                <h2>3. Převod</h2>
                <button style={{ ...btn, opacity: !isAdmin || busy ? 0.5 : 1 }} disabled={!isAdmin || busy} onClick={migrate}>
                    {busy ? 'Převádím…' : 'Převést'}
                </button>
                {log.length > 0 && (
                    <pre style={{ marginTop: 16, background: '#f6f2ee', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{log.join('\n')}</pre>
                )}
            </section>
        </main>
    );
}
