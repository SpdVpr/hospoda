'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import styles from './LoginPage.module.css';

type AuthMode = 'login' | 'register';

export default function LoginPage() {
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (mode === 'login') {
                await signInWithEmail(email, password);
            } else {
                if (!displayName.trim()) {
                    setError('Vyplňte prosím jméno');
                    setIsLoading(false);
                    return;
                }
                await signUpWithEmail(email, password, displayName);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Došlo k chybě';
            if (message.includes('invalid-credential') || message.includes('wrong-password')) {
                setError('Nesprávný email nebo heslo');
            } else if (message.includes('user-not-found')) {
                setError('Uživatel s tímto emailem neexistuje');
            } else if (message.includes('email-already-in-use')) {
                setError('Email je již registrován');
            } else if (message.includes('weak-password')) {
                setError('Heslo musí mít alespoň 6 znaků');
            } else if (message.includes('invalid-email')) {
                setError('Neplatný formát emailu');
            } else {
                setError(message);
            }
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
            const message = err instanceof Error ? err.message : 'Chyba při přihlášení přes Google';
            if (message.includes('popup-closed')) {
                setError('Přihlašovací okno bylo zavřeno');
            } else {
                setError(message);
            }
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
            const message = err instanceof Error ? err.message : 'Chyba při přihlášení přes Apple';
            if (message.includes('popup-closed')) {
                setError('Přihlašovací okno bylo zavřeno');
            } else if (message.includes('popup-blocked')) {
                setError('Pop-up okno bylo zablokováno. Povolte pop-up okna.');
            } else {
                setError(message);
            }
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
                        {mode === 'login' ? 'Vítejte zpět!' : 'Vytvořte účet'}
                    </h1>
                    <p className={styles.subtitle}>
                        {mode === 'login'
                            ? 'Přihlaste se do docházkového systému'
                            : 'Zaregistrujte se pro přístup do systému'}
                    </p>
                </div>

                <div className={styles.card}>
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
                    </div>

                    <div className={styles.divider}>
                        <span>nebo emailem</span>
                    </div>

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
                                {mode === 'login' ? 'Email nebo login' : 'Email'}
                            </label>
                            <input
                                type={mode === 'register' ? 'email' : 'text'}
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.input}
                                placeholder={mode === 'login' ? 'admin nebo vas@email.cz' : 'vas@email.cz'}
                                required
                                disabled={isLoading}
                            />
                            {mode === 'login' && (
                                <p className={styles.hint}>Pro admin přístup zadejte: admin</p>
                            )}
                        </div>

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

                        {error && (
                            <div className={styles.error}>
                                <svg className={styles.errorIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className={styles.spinner}></span>
                            ) : (
                                mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'
                            )}
                        </button>
                    </form>

                    <p className={styles.toggleMode}>
                        {mode === 'login' ? (
                            <>
                                Nemáte účet?{' '}
                                <button
                                    type="button"
                                    onClick={() => { setMode('register'); setError(null); }}
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
                                    onClick={() => { setMode('login'); setError(null); }}
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
