'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
    User,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut as firebaseSignOut,
    updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
import { UserProfile, UserRole } from '@/types';

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    error: string | null;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch or create user profile
    const fetchOrCreateProfile = async (firebaseUser: User): Promise<UserProfile | null> => {
        try {
            const profileRef = doc(db, 'users', firebaseUser.uid);
            const profileSnap = await getDoc(profileRef);

            // Check if this is the special admin user
            const isAdminUser = firebaseUser.email === 'admin@hospoda.local';

            if (profileSnap.exists()) {
                const existingProfile = { ...profileSnap.data(), uid: firebaseUser.uid } as UserProfile;

                // ALWAYS enforce admin role for admin@hospoda.local
                if (isAdminUser && existingProfile.role !== 'admin') {
                    await setDoc(profileRef, {
                        ...existingProfile,
                        role: 'admin',
                        displayName: 'Administrátor',
                        updatedAt: serverTimestamp(),
                    }, { merge: true });
                    return { ...existingProfile, role: 'admin', displayName: 'Administrátor' };
                }

                return existingProfile;
            }

            // Create new profile for first-time users
            const usersSnap = await getDoc(doc(db, 'meta', 'stats'));
            const isFirstUser = !usersSnap.exists() || (usersSnap.data()?.userCount || 0) === 0;

            // Determine role: admin@hospoda.local is ALWAYS admin, first user is admin, others are employees
            const userRole = isAdminUser || isFirstUser ? 'admin' : 'employee';

            const newProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: isAdminUser ? 'Administrátor' : (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Uživatel'),
                photoURL: firebaseUser.photoURL || undefined,
                role: userRole,
                isActive: true,
            };

            await setDoc(profileRef, {
                ...newProfile,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // Update user count
            await setDoc(doc(db, 'meta', 'stats'), {
                userCount: (usersSnap.data()?.userCount || 0) + 1,
            }, { merge: true });

            return { ...newProfile, createdAt: new Date(), updatedAt: new Date() } as UserProfile;
        } catch (err) {
            console.error('Error fetching/creating profile:', err);
            return null;
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                const profile = await fetchOrCreateProfile(firebaseUser);
                setUserProfile(profile);
            } else {
                setUserProfile(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithEmail = async (email: string, password: string) => {
        try {
            setError(null);

            // Special admin login: if email is "admin", convert to admin@hospoda.local
            let loginEmail = email;
            let loginPassword = password;

            if (email.toLowerCase() === 'admin') {
                const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

                if (!adminPassword) {
                    throw new Error('Admin heslo není nakonfigurované v .env.local');
                }

                if (password !== adminPassword) {
                    throw new Error('Nesprávné admin heslo');
                }

                loginEmail = 'admin@hospoda.local';
                loginPassword = adminPassword;

                // Try to sign in, if user doesn't exist, create it
                try {
                    await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
                } catch (signInError: any) {
                    if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
                        // Create admin user if it doesn't exist
                        const result = await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
                        await updateProfile(result.user, { displayName: 'Administrátor' });

                        // Force admin role for this user
                        const profileRef = doc(db, 'users', result.user.uid);
                        await setDoc(profileRef, {
                            uid: result.user.uid,
                            email: loginEmail,
                            displayName: 'Administrátor',
                            role: 'admin',
                            isActive: true,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                        });
                    } else {
                        throw signInError;
                    }
                }
                return;
            }

            await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Chyba při přihlášení';
            setError(message);
            throw err;
        }
    };

    const signUpWithEmail = async (email: string, password: string, displayName: string) => {
        try {
            setError(null);
            const result = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(result.user, { displayName });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Chyba při registraci';
            setError(message);
            throw err;
        }
    };

    const signInWithGoogle = async () => {
        try {
            setError(null);
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Chyba při přihlášení přes Google';
            setError(message);
            throw err;
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setUserProfile(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Chyba při odhlášení';
            setError(message);
            throw err;
        }
    };

    const isAdmin = userProfile?.role === 'admin';

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
                signOut,
                isAdmin,
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
