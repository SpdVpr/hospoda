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
    OAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
import { UserProfile } from '@/types';

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    error: string | null;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signInWithApple: () => Promise<void>;
    signOut: () => Promise<void>;
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

    // Fetch or create user profile
    const fetchOrCreateProfile = async (firebaseUser: User): Promise<UserProfile | null> => {
        try {
            const profileRef = doc(db, 'users', firebaseUser.uid);
            const profileSnap = await getDoc(profileRef);

            if (profileSnap.exists()) {
                return { ...profileSnap.data(), uid: firebaseUser.uid } as UserProfile;
            }

            // Create new profile for first-time users – always as employee.
            // Admin role is granted only by another admin (Zaměstnanci page);
            // firestore.rules reject any other role or extra fields here.
            // Build profile object — IMPORTANT: exclude undefined values (Firestore rejects them)
            const newProfile: Record<string, any> = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Uživatel',
                role: 'employee',
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            // Only include photoURL if it's a real value
            if (firebaseUser.photoURL) {
                newProfile.photoURL = firebaseUser.photoURL;
            }

            // Attempt to create with retry
            let writeSuccess = false;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    await setDoc(profileRef, newProfile);
                    writeSuccess = true;
                    console.log(`✓ Profile created for ${firebaseUser.email || firebaseUser.uid}`);
                    break;
                } catch (writeErr) {
                    console.error(`Profile create attempt ${attempt + 1} failed:`, writeErr);
                    if (attempt === 0) {
                        // Wait 1s before retry
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            if (writeSuccess) {
                return { ...newProfile, createdAt: new Date(), updatedAt: new Date() } as UserProfile;
            }

            // Fallback: return a temporary profile from Auth data so UI doesn't break
            console.warn('Could not create Firestore profile, using fallback from Auth data');
            return {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Uživatel',
                role: 'employee',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as UserProfile;
        } catch (err) {
            console.error('Error fetching/creating profile:', err);
            // Even on total failure, return fallback so UI shows something useful
            return {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || 'Uživatel',
                role: 'employee',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as UserProfile;
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
            await signInWithEmailAndPassword(auth, email, password);
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

    const signInWithApple = async () => {
        try {
            setError(null);
            const appleProvider = new OAuthProvider('apple.com');
            appleProvider.addScope('email');
            appleProvider.addScope('name');
            await signInWithPopup(auth, appleProvider);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Chyba při přihlášení přes Apple';
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
                signOut,
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
