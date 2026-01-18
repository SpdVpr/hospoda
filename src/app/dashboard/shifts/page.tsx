'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Shift, ShiftStatus } from '@/types';
import styles from './page.module.css';

interface ShiftFormData {
    date: string;
    startTime: string;
    endTime: string;
    position: string;
    notes: string;
}

const initialFormData: ShiftFormData = {
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    position: 'Číšník',
    notes: '',
};

export default function ShiftsPage() {
    const { userProfile, isAdmin } = useAuth();
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [formData, setFormData] = useState<ShiftFormData>(initialFormData);
    const [filter, setFilter] = useState<'all' | 'open' | 'mine'>('all');
    const [submitting, setSubmitting] = useState(false);

    const fetchShifts = async () => {
        try {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            const shiftsQuery = query(collection(db, 'shifts'), where('date', '>=', lastWeek.toISOString().split('T')[0]), orderBy('date', 'asc'));
            const shiftsSnap = await getDocs(shiftsQuery);
            setShifts(shiftsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Shift[]);
        } catch (error) {
            console.error('Error fetching shifts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchShifts(); }, []);

    const handleOpenModal = (shift?: Shift) => {
        if (shift) {
            setEditingShift(shift);
            setFormData({ date: shift.date, startTime: shift.startTime, endTime: shift.endTime, position: shift.position, notes: shift.notes || '' });
        } else {
            setEditingShift(null);
            setFormData(initialFormData);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => { setShowModal(false); setEditingShift(null); setFormData(initialFormData); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile || !isAdmin) return;
        setSubmitting(true);
        try {
            if (editingShift) {
                await updateDoc(doc(db, 'shifts', editingShift.id), { ...formData, updatedAt: serverTimestamp() });
            } else {
                await addDoc(collection(db, 'shifts'), { ...formData, status: 'open' as ShiftStatus, createdBy: userProfile.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            }
            handleCloseModal();
            fetchShifts();
        } catch (error) {
            console.error('Error saving shift:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleTakeShift = async (shift: Shift) => {
        if (!userProfile) return;
        try {
            await updateDoc(doc(db, 'shifts', shift.id), { status: 'assigned', assignedTo: userProfile.uid, assignedToName: userProfile.displayName, updatedAt: serverTimestamp() });
            fetchShifts();
        } catch (error) {
            console.error('Error taking shift:', error);
        }
    };

    const handleReleaseShift = async (shift: Shift) => {
        if (!userProfile) return;
        try {
            await updateDoc(doc(db, 'shifts', shift.id), { status: 'open', assignedTo: null, assignedToName: null, updatedAt: serverTimestamp() });
            fetchShifts();
        } catch (error) {
            console.error('Error releasing shift:', error);
        }
    };

    const handleDeleteShift = async (shift: Shift) => {
        if (!isAdmin || !confirm('Opravdu chcete smazat tuto směnu?')) return;
        try {
            await deleteDoc(doc(db, 'shifts', shift.id));
            fetchShifts();
        } catch (error) {
            console.error('Error deleting shift:', error);
        }
    };

    const filteredShifts = shifts.filter(shift => {
        if (filter === 'open') return shift.status === 'open';
        if (filter === 'mine') return shift.assignedTo === userProfile?.uid;
        return true;
    });

    const isPast = (dateStr: string) => new Date(dateStr) < new Date(new Date().toISOString().split('T')[0]);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>📅 Směny</h1>
                    <p className={styles.subtitle}>{isAdmin ? 'Spravujte směny zaměstnanců' : 'Přehled a přihlašování na směny'}</p>
                </div>
                {isAdmin && (
                    <button className={styles.createBtn} onClick={() => handleOpenModal()}>
                        <span>+</span><span>Nová směna</span>
                    </button>
                )}
            </div>

            <div className={styles.filters}>
                <button className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`} onClick={() => setFilter('all')}>Všechny</button>
                <button className={`${styles.filterBtn} ${filter === 'open' ? styles.active : ''}`} onClick={() => setFilter('open')}>Volné</button>
                <button className={`${styles.filterBtn} ${filter === 'mine' ? styles.active : ''}`} onClick={() => setFilter('mine')}>Moje</button>
            </div>

            {loading ? (
                <div className={styles.loading}>{[...Array(3)].map((_, i) => <div key={i} className={styles.skeleton}></div>)}</div>
            ) : filteredShifts.length === 0 ? (
                <div className={styles.empty}>
                    <span className={styles.emptyIcon}>📅</span>
                    <p className={styles.emptyText}>Žádné směny</p>
                    {isAdmin && <button className={styles.emptyBtn} onClick={() => handleOpenModal()}>Vytvořit první směnu</button>}
                </div>
            ) : (
                <div className={styles.shiftsList}>
                    {filteredShifts.map((shift) => (
                        <div key={shift.id} className={`${styles.shiftCard} ${isPast(shift.date) ? styles.past : ''} ${shift.status === 'open' ? styles.open : ''}`}>
                            <div className={styles.shiftDate}>
                                <span className={styles.dateDay}>{new Date(shift.date).getDate()}</span>
                                <span className={styles.dateMonth}>{new Date(shift.date).toLocaleDateString('cs-CZ', { month: 'short' })}</span>
                            </div>
                            <div className={styles.shiftInfo}>
                                <div className={styles.shiftTime}>{shift.startTime} - {shift.endTime}</div>
                                <div className={styles.shiftPosition}>{shift.position}</div>
                                {shift.assignedToName && <div className={styles.shiftAssignee}>👤 {shift.assignedToName}</div>}
                            </div>
                            <div className={styles.shiftStatus}>
                                {shift.status === 'open' && <span className={styles.statusOpen}>Volná</span>}
                                {shift.status === 'assigned' && <span className={styles.statusAssigned}>Obsazená</span>}
                            </div>
                            <div className={styles.shiftActions}>
                                {shift.status === 'open' && !isPast(shift.date) && (
                                    <button className={styles.takeBtn} onClick={() => handleTakeShift(shift)}>Vzít</button>
                                )}
                                {shift.assignedTo === userProfile?.uid && !isPast(shift.date) && (
                                    <button className={styles.releaseBtn} onClick={() => handleReleaseShift(shift)}>Uvolnit</button>
                                )}
                                {isAdmin && (
                                    <>
                                        <button className={styles.editBtn} onClick={() => handleOpenModal(shift)}>✏️</button>
                                        <button className={styles.deleteBtn} onClick={() => handleDeleteShift(shift)}>🗑️</button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className={styles.modalOverlay} onClick={handleCloseModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingShift ? 'Upravit směnu' : 'Nová směna'}</h2>
                            <button className={styles.closeBtn} onClick={handleCloseModal}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label htmlFor="date">Datum</label>
                                <input type="date" id="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="startTime">Začátek</label>
                                    <input type="time" id="startTime" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} required />
                                </div>
                                <div className={styles.formGroup}>
                                    <label htmlFor="endTime">Konec</label>
                                    <input type="time" id="endTime" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} required />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="position">Pozice</label>
                                <select id="position" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })}>
                                    <option>Číšník</option>
                                    <option>Barman</option>
                                    <option>Kuchař</option>
                                    <option>Pomocná síla</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="notes">Poznámky</label>
                                <textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} placeholder="Volitelné poznámky..." />
                            </div>
                            <div className={styles.modalFooter}>
                                <button type="button" className={styles.cancelBtn} onClick={handleCloseModal}>Zrušit</button>
                                <button type="submit" className={styles.submitBtn} disabled={submitting}>{submitting ? 'Ukládám...' : (editingShift ? 'Uložit' : 'Vytvořit')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
