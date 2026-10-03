'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import LoadingScreen from '@/components/ui/LoadingScreen';
import styles from '@/components/auth/LoginPage.module.css';

/** Target of the password e-mail: the link signs the user in, here they choose a password. */
export default function NewPasswordPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (loading) return <LoadingScreen />;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password.length < 8) return setError('Heslo musí mít alespoň 8 znaků.');
        if (password !== password2) return setError('Hesla se neshodují.');
        setSaving(true);
        const { error: updateError } = await getSupabase().auth.updateUser({ password });
        setSaving(false);
        if (updateError) return setError('Heslo se nepodařilo uložit. Otevřete prosím odkaz z e-mailu znovu.');
        router.push('/dashboard');
    };

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Nové heslo</h1>
                    <p className={styles.subtitle}>
                        {user ? `Účet ${user.email}` : 'Odkaz už neplatí nebo byl otevřen v jiném prohlížeči.'}
                    </p>
                </div>
                <div className={styles.card}>
                    {user ? (
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label htmlFor="password" className={styles.label}>Nové heslo</label>
                                <input type="password" id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.input} required minLength={8} />
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="password2" className={styles.label}>Heslo znovu</label>
                                <input type="password" id="password2" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} className={styles.input} required minLength={8} />
                            </div>
                            {error && <div className={styles.error}>{error}</div>}
                            <button type="submit" className={styles.submitBtn} disabled={saving}>
                                {saving ? <span className={styles.spinner}></span> : 'Uložit heslo'}
                            </button>
                        </form>
                    ) : (
                        <p className={styles.toggleMode}>
                            <Link href="/" className={styles.toggleBtn}>Zpět na přihlášení</Link> a nechte si poslat nový odkaz (Zapomenuté heslo).
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
