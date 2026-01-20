'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './page.module.css';

interface ProfileFormData { displayName: string; phone: string; address: string; birthDate: string; }

export default function ProfilePage() {
    const { userProfile, user } = useAuth();
    const [formData, setFormData] = useState<ProfileFormData>({ displayName: '', phone: '', address: '', birthDate: '' });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (userProfile) { setFormData({ displayName: userProfile.displayName || '', phone: userProfile.phone || '', address: userProfile.address || '', birthDate: userProfile.birthDate || '' }); }
    }, [userProfile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) return;
        setSaving(true); setSaved(false);
        try {
            await updateDoc(doc(db, 'users', userProfile.uid), { ...formData, updatedAt: serverTimestamp() });
            setSaved(true); setTimeout(() => setSaved(false), 3000);
        } catch (error) { console.error('Error updating profile:', error); }
        finally { setSaving(false); }
    };

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const formatDate = (timestamp: any) => { if (!timestamp) return 'Neznámé'; const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp); return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }); };

    return (
        <div className={styles.container}>
            <div className={styles.header}><h1 className={styles.title}>Můj profil</h1><p className={styles.subtitle}>Vaše osobní údaje a nastavení</p></div>

            <div className={styles.content}>
                <div className={styles.profileCard}>
                    <div className={styles.profileHeader}>
                        <div className={styles.avatar}>{userProfile?.photoURL ? <img src={userProfile.photoURL} alt="" /> : <span>{getInitials(userProfile?.displayName || 'U')}</span>}</div>
                        <div className={styles.profileInfo}>
                            <h2>{userProfile?.displayName}</h2>
                            <p>{userProfile?.email}</p>
                            <span className={styles.roleBadge}>{userProfile?.role === 'admin' ? 'Admin' : 'Zaměstnanec'}</span>
                        </div>
                    </div>
                    <div className={styles.profileStats}>
                        <div className={styles.profileStat}><span className={styles.statLabel}>Pozice</span><span className={styles.statValue}>{userProfile?.position || 'Nezadáno'}</span></div>
                        <div className={styles.profileStat}><span className={styles.statLabel}>Člen od</span><span className={styles.statValue}>{formatDate(userProfile?.createdAt)}</span></div>
                        <div className={styles.profileStat}><span className={styles.statLabel}>Nástup</span><span className={styles.statValue}>{userProfile?.startDate ? new Date(userProfile.startDate).toLocaleDateString('cs-CZ') : 'Nezadáno'}</span></div>
                    </div>
                </div>

                <div className={styles.editCard}>
                    <h3 className={styles.cardTitle}>Upravit údaje</h3>
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.formGroup}><label htmlFor="displayName">Jméno a příjmení</label><input type="text" id="displayName" value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} required /></div>
                        <div className={styles.formGroup}><label htmlFor="phone">Telefon</label><input type="tel" id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+420 XXX XXX XXX" /></div>
                        <div className={styles.formGroup}><label htmlFor="birthDate">Datum narození</label><input type="date" id="birthDate" value={formData.birthDate} onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })} /></div>
                        <div className={styles.formGroup}><label htmlFor="address">Adresa</label><textarea id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Ulice, číslo, město, PSČ" rows={2} /></div>
                        <div className={styles.formActions}>{saved && <span className={styles.savedMessage}>✓ Uloženo</span>}<button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? 'Ukládám...' : 'Uložit změny'}</button></div>
                    </form>
                </div>

                <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>Informace o účtu</h3>
                    <div className={styles.infoList}>
                        <div className={styles.infoItem}><span className={styles.infoLabel}>Email</span><span className={styles.infoValue}>{userProfile?.email}</span></div>
                        <div className={styles.infoItem}><span className={styles.infoLabel}>ID uživatele</span><span className={styles.infoValue}>{user?.uid}</span></div>
                        <div className={styles.infoItem}><span className={styles.infoLabel}>Přihlášení</span><span className={styles.infoValue}>{user?.providerData[0]?.providerId === 'google.com' ? 'Google' : 'Email a heslo'}</span></div>
                        <div className={styles.infoItem}><span className={styles.infoLabel}>Stav</span><span className={`${styles.infoValue} ${userProfile?.isActive ? styles.active : styles.inactive}`}>{userProfile?.isActive ? '✓ Aktivní' : '✕ Neaktivní'}</span></div>
                    </div>
                    <div className={styles.infoNote}><p>💡 Pro změnu emailu nebo hesla kontaktujte administrátora.</p></div>
                </div>
            </div>
        </div>
    );
}
