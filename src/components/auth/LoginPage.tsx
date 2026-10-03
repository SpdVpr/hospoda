'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import styles from './LoginPage.module.css';

type AuthMode = 'login' | 'register' | 'reset';

// Apple sign-in needs an Apple Developer account configured in Supabase Auth.
const APPLE_LOGIN = process.env.NEXT_PUBLIC_APPLE_LOGIN === '1';

/** Supabase Auth error → Czech message. */
function authMessage(message: string): string {
    if (/invalid login credentials/i.test(message)) return 'Nesprávný email nebo heslo';
    if (/email not confirmed/i.test(message)) return 'Email ještě není potvrzený – klikněte na odkaz, který jsme vám poslali.';
    if (/already registered|already exists/i.test(message)) return 'Email je již registrován';
    if (/password should be|weak password/i.test(message)) return 'Heslo musí mít alespoň 6 znaků';
    if (/invalid.*email|unable to validate email/i.test(message)) return 'Neplatný formát emailu';
    if (/provider is not enabled|unsupported provider/i.test(message)) return 'Tento způsob přihlášení zatím není zapnutý.';
    if (/rate limit/i.test(message)) return 'Příliš mnoho pokusů, zkuste to prosím za chvíli.';
    return message;
}

export default function LoginPage() {
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, sendPasswordReset } = useAuth();

    const switchMode = (next: AuthMode) => {
        setMode(next);
        setError(null);
        setNotice(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setNotice(null);
        setIsLoading(true);

        try {
            if (mode === 'login') {
                await signInWithEmail(email, password);
            } else if (mode === 'reset') {
                await sendPasswordReset(email);
                setNotice('Pokud u nás účet s tímto emailem je, poslali jsme na něj odkaz pro nastavení hesla.');
            } else {
                if (!displayName.trim()) {
                    setError('Vyplňte prosím jméno');
                    setIsLoading(false);
                    return;
                }
                const needsConfirmation = await signUpWithEmail(email, password, displayName);
                if (needsConfirmation) {
                    setNotice('Hotovo! Poslali jsme vám email s odkazem pro potvrzení účtu.');
                }
            }
        } catch (err) {
            setError(authMessage(err instanceof Error ? err.message : 'Došlo k chybě'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setIsLoading(true);
        try {
            await signInWithGoogle();
        } catch (err) {
            setError(authMessage(err instanceof Error ? err.message : 'Chyba při přihlášení přes Google'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleAppleLogin = async () => {
        setError(null);
        setIsLoading(true);
        try {
            await signInWithApple();
        } catch (err) {
            setError(authMessage(err instanceof Error ? err.message : 'Chyba při přihlášení přes Apple'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.bgDecoration}>
                <div className={styles.bgCircle1}></div>
                <div className={styles.bgCircle2}></div>
                <div className={styles.bgCircle3}></div>
            </div>

            <div className={styles.content}>
                <div className={styles.header}>
                    <div className={styles.logo}>
                        <img src="/logo-vesnice-main.png" alt="Vesnice" className={styles.logoMain} />
                    </div>
                    <h1 className={styles.title}>
                        {mode === 'login' ? 'Vítejte zpět!' : mode === 'reset' ? 'Nové heslo' : 'Vytvořte účet'}
                    </h1>
                    <p className={styles.subtitle}>
                        {mode === 'login'
                            ? 'Přihlaste se do docházkového systému'
                            : mode === 'reset'
                                ? 'Pošleme vám odkaz pro nastavení hesla'
                                : 'Zaregistrujte se pro přístup do systému'}
                    </p>
                </div>

                <div className={styles.card}>
                    {mode !== 'reset' && (<>
                    <div className={styles.socialButtons}>
                        <button
                            className={styles.googleBtn}
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                            type="button"
                        >
                            <svg className={styles.socialIcon} viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Google
                        </button>

                        {APPLE_LOGIN && (
                        <button
                            className={styles.appleBtn}
                            onClick={handleAppleLogin}
                            disabled={isLoading}
                            type="button"
                        >
                            <svg className={styles.socialIcon} viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                            </svg>
                            Apple
                        </button>
                        )}
                    </div>

                    <div className={styles.divider}>
                        <span>nebo emailem</span>
                    </div>
                    </>)}

                    <form onSubmit={handleSubmit} className={styles.form}>
                        {mode === 'register' && (
                            <div className={styles.formGroup}>
                                <label htmlFor="displayName" className={styles.label}>
                                    Jméno a příjmení
                                </label>
                                <input
                                    type="text"
                                    id="displayName"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className={styles.input}
                                    placeholder="Jan Novák"
                                    required={mode === 'register'}
                                    disabled={isLoading}
                                />
                            </div>
                        )}

                        <div className={styles.formGroup}>
                            <label htmlFor="email" className={styles.label}>
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.input}
                                placeholder="vas@email.cz"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        {mode !== 'reset' && (
                        <div className={styles.formGroup}>
                            <label htmlFor="password" className={styles.label}>
                                Heslo
                            </label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={styles.input}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                disabled={isLoading}
                            />
                            {mode === 'register' && (
                                <p className={styles.hint}>Minimálně 6 znaků</p>
                            )}
                        </div>
                        )}
                        {mode === 'login' && (
                            <button type="button" onClick={() => switchMode('reset')} className={styles.toggleBtn} style={{ alignSelf: 'flex-end', fontSize: '0.85rem' }}>
                                Zapomenuté heslo?
                            </button>
                        )}

                        {error && (
                            <div className={styles.error}>
                                <svg className={styles.errorIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {notice && <div className={styles.notice}>{notice}</div>}

                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className={styles.spinner}></span>
                            ) : (
                                mode === 'login' ? 'Přihlásit se' : mode === 'reset' ? 'Poslat odkaz' : 'Vytvořit účet'
                            )}
                        </button>
                    </form>

                    <p className={styles.toggleMode}>
                        {mode === 'login' ? (
                            <>
                                Nemáte účet?{' '}
                                <button
                                    type="button"
                                    onClick={() => switchMode('register')}
                                    className={styles.toggleBtn}
                                >
                                    Zaregistrujte se
                                </button>
                            </>
                        ) : (
                            <>
                                Máte již účet?{' '}
                                <button
                                    type="button"
                                    onClick={() => switchMode('login')}
                                    className={styles.toggleBtn}
                                >
                                    Přihlaste se
                                </button>
                            </>
                        )}
                    </p>
                </div>

                <p className={styles.footer}>
                    Docházkový systém pro hospody a restaurace
                </p>
            </div>
        </div>
    );
}
