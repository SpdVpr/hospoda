'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { getMyProfile } from '@/lib/data';
import { UserProfile } from '@/types';

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    error: string | null;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    /** Resolves to true when the account still has to be confirmed by e-mail. */
    signUpWithEmail: (email: string, password: string, displayName: string) => Promise<boolean>;
    signInWithGoogle: () => Promise<void>;
    signInWithApple: () => Promise<void>;
    /** E-mail with a link to /nove-heslo (forgotten or first password after the move from Firebase). */
    sendPasswordReset: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    needsMfa: boolean;
    isAdmin: boolean;
    isShiftManager: boolean;
    canManageShifts: boolean; // admin OR shift_manager
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needsMfa, setNeedsMfa] = useState(false);

    // The member row is created by the database on sign-up (and matched by e-mail
    // to people migrated from Firebase), so here it is only read.
    const loadProfile = useCallback(async (u: User | null) => {
        if (!u) {
            setUserProfile(null);
            return;
        }
        try {
            const profile = await getMyProfile(u.id);
            const { data: assurance } = await getSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
            setNeedsMfa(profile?.role === 'admin' && assurance?.currentLevel !== 'aal2');
            setUserProfile(profile);
        } catch (err) {
            console.error('Error loading profile:', err);
            setUserProfile(null);
        }
    }, []);

    useEffect(() => {
        const supabase = getSupabase();
        let currentId: string | undefined;
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            const next = session?.user ?? null;
            setUser(next);
            // Token refreshes fire this too – reload the profile only when the account changes.
            if (next?.id !== currentId || _event === 'MFA_CHALLENGE_VERIFIED' || _event === 'TOKEN_REFRESHED') {
                currentId = next?.id;
                // Deferred: Supabase calls must not run inside this callback.
                setTimeout(() => {
                    loadProfile(next).finally(() => setLoading(false));
                }, 0);
            } else {
                setLoading(false);
            }
        });
        return () => data.subscription.unsubscribe();
    }, [loadProfile]);

    const run = async <T,>(fallback: string, fn: () => Promise<T>): Promise<T> => {
        try {
            setError(null);
            return await fn();
        } catch (err) {
            const message = err instanceof Error ? err.message : fallback;
            setError(message);
            throw err;
        }
    };

    const signInWithEmail = (email: string, password: string) =>
        run('Chyba při přihlášení', async () => {
            const { error } = await getSupabase().auth.signInWithPassword({ email, password });
            if (error) throw error;
        });

    const signUpWithEmail = (email: string, password: string, displayName: string) =>
        run('Chyba při registraci', async () => {
            const { data, error } = await getSupabase().auth.signUp({
                email,
                password,
                options: { data: { display_name: displayName.trim() }, emailRedirectTo: `${window.location.origin}/` },
            });
            if (error) throw error;
            return !data.session;
        });

    const signInWithOAuth = (provider: 'google' | 'apple', fallback: string) =>
        run(fallback, async () => {
            const { error } = await getSupabase().auth.signInWithOAuth({
                provider,
                options: { redirectTo: `${window.location.origin}/` },
            });
            if (error) throw error;
        });

    const signInWithGoogle = () => signInWithOAuth('google', 'Chyba při přihlášení přes Google');
    const signInWithApple = () => signInWithOAuth('apple', 'Chyba při přihlášení přes Apple');

    const sendPasswordReset = (email: string) =>
        run('Chyba při odesílání e-mailu', async () => {
            const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/nove-heslo`,
            });
            if (error) throw error;
        });

    const signOut = () =>
        run('Chyba při odhlášení', async () => {
            const { error } = await getSupabase().auth.signOut();
            if (error) throw error;
            setUserProfile(null);
        });

    const refreshProfile = () => loadProfile(user);

    const isAdmin = !needsMfa && userProfile?.role === 'admin';
    const isShiftManager = userProfile?.role === 'shift_manager';
    const canManageShifts = isAdmin || isShiftManager;

    return (
        <AuthContext.Provider
            value={{
                user,
                userProfile,
                loading,
                error,
                signInWithEmail,
                signUpWithEmail,
                signInWithGoogle,
                signInWithApple,
                sendPasswordReset,
                signOut,
                refreshProfile,
                needsMfa,
                isAdmin,
                isShiftManager,
                canManageShifts,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
