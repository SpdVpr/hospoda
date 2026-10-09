'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function VerificationPage() {
  const { user, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true); setError('');
    try {
      const client = getSupabase();
      const factors = await client.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const verified = factors.data.totp.find(f => f.status === 'verified');
      if (verified) { setFactorId(verified.id); return; }
      for (const f of factors.data.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified')) await client.auth.mfa.unenroll({ factorId: f.id });
      const enrolled = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Vesnice – ověřovací aplikace', issuer: 'Hospoda Vesnice' });
      if (enrolled.error) throw enrolled.error;
      setFactorId(enrolled.data.id); setQr(enrolled.data.totp.qr_code);
    } catch { setError('Ověření se nepodařilo zahájit. Zkuste to znovu.'); }
    finally { setPending(false); }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError('');
    const { error } = await getSupabase().auth.mfa.challengeAndVerify({ factorId, code });
    if (error) { setError('Kód není platný nebo vypršel. Zkuste nový kód.'); setPending(false); return; }
    await refreshProfile(); router.replace('/dashboard');
  }

  if (!user) return <main style={{ padding: '3rem' }}><Link href="/">Nejprve se přihlaste</Link></main>;
  return <main style={{ maxWidth: 480, margin: '3rem auto', padding: '2rem' }}>
    <h1>Dvoufaktorové ověření</h1>
    <p>Přístup správce chrání kód z ověřovací aplikace.</p>
    {!factorId && <button disabled={pending} onClick={start}>{pending ? 'Načítám…' : 'Pokračovat'}</button>}
    {qr && <img src={qr} width={240} height={240} alt="QR kód pro nastavení ověřovací aplikace" />}
    {factorId && <form onSubmit={verify} style={{ display: 'grid', gap: 16, marginTop: 24 }}>
      <label>Ověřovací kód <input value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required /></label>
      <button disabled={pending}>{pending ? 'Ověřuji…' : 'Ověřit a pokračovat'}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    <p>Pokud jste ztratili ověřovací aplikaci, kontaktujte správce účtů.</p>
    <button onClick={() => signOut()}>Odhlásit se</button>
  </main>;
}
