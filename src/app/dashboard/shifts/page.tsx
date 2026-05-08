'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Shift, ShiftStatus, ShiftCategory, UserProfile } from '@/types';
import styles from './page.module.css';

interface ShiftFormData {
    date: string;
    startTime: string;
    endTime: string;
    position: string;
    category: ShiftCategory;
    notes: string;
}

const initialFormData: ShiftFormData = {
    date: new Date().toISOString().split('T')[0],
    startTime: '16:00',
    endTime: '21:00',
    position: 'Číšník / Servírka',
    category: 'all',
    notes: '',
};

export default function ShiftsPage() {
    const { userProfile, isAdmin, canManageShifts, canTakeShiftCategory } = useAuth();
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [formData, setFormData] = useState<ShiftFormData>(initialFormData);
    const [filter, setFilter] = useState<'all' | 'open' | 'mine'>('all');
    const [submitting, setSubmitting] = useState(false);

    // Admin assign feature
    const [employees, setEmployees] = useState<UserProfile[]>([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assigningShift, setAssigningShift] = useState<Shift | null>(null);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

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

    // Fetch employees for admin assign feature
    const fetchEmployees = async () => {
        try {
            const usersQuery = query(collection(db, 'users'), orderBy('displayName', 'asc'));
            const usersSnap = await getDocs(usersQuery);
            setEmployees(usersSnap.docs.filter(d => d.data().isActive !== false).map(doc => ({ ...doc.data(), uid: doc.id })) as UserProfile[]);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    useEffect(() => { fetchShifts(); }, []);
    useEffect(() => { if (canManageShifts) { fetchEmployees(); } }, [canManageShifts]);

    // Admin assign shift to specific employee
    const handleOpenAssignModal = (shift: Shift) => {
        setAssigningShift(shift);
        setSelectedEmployeeId('');
        setShowAssignModal(true);
    };

    const handleAssignShift = async () => {
        if (!assigningShift || !selectedEmployeeId || !userProfile) return;
        const selectedEmployee = employees.find(e => e.uid === selectedEmployeeId);
        if (!selectedEmployee) return;

        if (assigningShift.category === 'senior_only' && selectedEmployee.role === 'brigadnik_junior') {
            if (!confirm(`${selectedEmployee.displayName} je brigádník junior, ale směna je v kategorii "pouze senior". Opravdu přiřadit?`)) return;
        }

        try {
            await updateDoc(doc(db, 'shifts', assigningShift.id), {
                status: 'assigned',
                assignedTo: selectedEmployee.uid,
                assignedToName: selectedEmployee.displayName,
                updatedAt: serverTimestamp()
            });
            setShowAssignModal(false);
            setAssigningShift(null);
            fetchShifts();
        } catch (error) {
            console.error('Error assigning shift:', error);
        }
    };

    // Print export function
    const handlePrintExport = () => {
        // Get future shifts sorted by date
        const today = new Date().toISOString().split('T')[0];
        const futureShifts = shifts
            .filter(s => s.date >= today)
            .sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return a.startTime.localeCompare(b.startTime);
            });

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            const days = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
            return `${days[date.getDay()]} ${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
        };

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Přehled směn - Vesnice</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: Arial, sans-serif; padding: 20px; font-size: 14px; }
                    h1 { text-align: center; margin-bottom: 20px; font-size: 20px; }
                    .print-date { text-align: center; color: #666; margin-bottom: 20px; font-size: 12px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #333; padding: 10px 8px; text-align: left; }
                    th { background: #f0f0f0; font-weight: bold; }
                    .empty-slot { 
                        min-width: 150px; 
                        border-bottom: 1px solid #999; 
                        display: inline-block; 
                        height: 20px;
                    }
                    .assigned-name { font-weight: bold; }
                    .position { color: #555; font-size: 12px; }
                    @media print {
                        body { padding: 10px; }
                        @page { margin: 1cm; }
                    }
                </style>
            </head>
            <body>
                <h1>📋 Přehled směn - Vesnice</h1>
                <p class="print-date">Vygenerováno: ${new Date().toLocaleDateString('cs-CZ')} ${new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</p>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 140px;">Datum</th>
                            <th style="width: 100px;">Čas</th>
                            <th style="width: 140px;">Pozice</th>
                            <th>Jméno</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${futureShifts.map(shift => {
                const catLabel = shift.category === 'senior_only'
                    ? '<span style="background:#fde68a;color:#92400e;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;margin-left:6px;">SENIOR</span>'
                    : '';
                return `
                            <tr>
                                <td>${formatDate(shift.date)}</td>
                                <td>${shift.startTime} - ${shift.endTime}</td>
                                <td class="position">${shift.position}${catLabel}</td>
                                <td>
                                    ${shift.assignedToName
                        ? `<span class="assigned-name">${shift.assignedToName}</span>`
                        : '<span class="empty-slot"></span>'}
                                </td>
                            </tr>
                        `;
            }).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.print();
        };
    };

    const handleOpenModal = (shift?: Shift) => {
        if (shift) {
            setEditingShift(shift);
            setFormData({ date: shift.date, startTime: shift.startTime, endTime: shift.endTime, position: shift.position, category: shift.category || 'all', notes: shift.notes || '' });
        } else {
            setEditingShift(null);
            setFormData(initialFormData);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => { setShowModal(false); setEditingShift(null); setFormData(initialFormData); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile || !canManageShifts) return;
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
        if (!canTakeShiftCategory(shift.category)) {
            alert('Tato směna je pouze pro brigádníky senior.');
            return;
        }
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
        if (!canManageShifts || !confirm('Opravdu chcete smazat tuto směnu?')) return;
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
                    <h1 className={styles.title}>Směny</h1>
                    <p className={styles.subtitle}>{isAdmin ? 'Spravujte směny zaměstnanců' : 'Přehled a přihlašování na směny'}</p>
                </div>
                <div className={styles.headerActions}>
                    {canManageShifts && (
                        <button className={styles.printBtn} onClick={handlePrintExport} title="Export pro tisk">
                            🖨️ Tisk
                        </button>
                    )}
                    {canManageShifts && (
                        <button className={styles.createBtn} onClick={() => handleOpenModal()}>
                            <span>+</span><span>Nová směna</span>
                        </button>
                    )}
                </div>
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
                    <p className={styles.emptyText}>Žádné směny</p>
                    {canManageShifts && <button className={styles.emptyBtn} onClick={() => handleOpenModal()}>Vytvořit první směnu</button>}
                </div>
            ) : (
                <div className={styles.shiftsList}>
                    {filteredShifts.map((shift) => {
                        const isSeniorOnly = shift.category === 'senior_only';
                        const allowedToTake = canTakeShiftCategory(shift.category);
                        return (
                        <div key={shift.id} className={`${styles.shiftCard} ${isPast(shift.date) ? styles.past : ''} ${shift.status === 'open' ? styles.open : ''} ${isSeniorOnly ? styles.seniorOnly : styles.allCategory}`}>
                            <div className={styles.shiftDate}>
                                <span className={styles.dateDay}>{new Date(shift.date).getDate()}</span>
                                <span className={styles.dateMonth}>{new Date(shift.date).toLocaleDateString('cs-CZ', { month: 'short' })}</span>
                            </div>
                            <div className={styles.shiftInfo}>
                                <div className={styles.shiftTime}>{shift.startTime} - {shift.endTime}</div>
                                <div className={styles.shiftPosition}>
                                    {shift.position}
                                    <span className={`${styles.categoryBadge} ${isSeniorOnly ? styles.categorySenior : styles.categoryAll}`}>
                                        {isSeniorOnly ? 'Senior' : 'Vše'}
                                    </span>
                                </div>
                                {shift.assignedToName && <div className={styles.shiftAssignee}>{shift.assignedToName}</div>}
                            </div>
                            <div className={styles.shiftStatus}>
                                {shift.status === 'open' && <span className={styles.statusOpen}>Volná</span>}
                                {shift.status === 'assigned' && <span className={styles.statusAssigned}>Obsazená</span>}
                            </div>
                            <div className={styles.shiftActions}>
                                {shift.status === 'open' && !isPast(shift.date) && allowedToTake && (
                                    <button className={styles.takeBtn} onClick={() => handleTakeShift(shift)}>Vzít</button>
                                )}
                                {shift.status === 'open' && !isPast(shift.date) && !allowedToTake && (
                                    <span className={styles.lockedBadge} title="Tato směna je pouze pro brigádníky senior">🔒 Jen senior</span>
                                )}
                                {canManageShifts && shift.status === 'open' && !isPast(shift.date) && (
                                    <button className={styles.assignBtn} onClick={() => handleOpenAssignModal(shift)}>Přiřadit</button>
                                )}
                                {canManageShifts && shift.status === 'assigned' && !isPast(shift.date) && (
                                    <button className={styles.releaseBtn} onClick={() => handleReleaseShift(shift)}>Uvolnit</button>
                                )}
                                {canManageShifts && (
                                    <>
                                        <button className={styles.editBtn} onClick={() => handleOpenModal(shift)}>✏️</button>
                                        <button className={styles.deleteBtn} onClick={() => handleDeleteShift(shift)}>🗑️</button>
                                    </>
                                )}
                            </div>
                        </div>
                        );
                    })}
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
                                    <option>Barman / Barmanka</option>
                                    <option>Číšník / Servírka</option>
                                    <option>Kuchař</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="category">Kategorie směny</label>
                                <select id="category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as ShiftCategory })}>
                                    <option value="all">Kategorie 2 — všichni brigádníci (junior i senior)</option>
                                    <option value="senior_only">Kategorie 1 — pouze brigádník senior</option>
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

            {/* Assign Shift Modal */}
            {showAssignModal && assigningShift && (
                <div className={styles.modalOverlay} onClick={() => setShowAssignModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Přiřadit směnu</h2>
                            <button className={styles.closeBtn} onClick={() => setShowAssignModal(false)}>✕</button>
                        </div>
                        <div className={styles.form}>
                            <div className={styles.assignInfo}>
                                <p><strong>Datum:</strong> {new Date(assigningShift.date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                <p><strong>Čas:</strong> {assigningShift.startTime} - {assigningShift.endTime}</p>
                                <p><strong>Pozice:</strong> {assigningShift.position}</p>
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="employee">Vyberte zaměstnance</label>
                                <select
                                    id="employee"
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                >
                                    <option value="">-- Vyberte zaměstnance --</option>
                                    {employees.map(emp => (
                                        <option key={emp.uid} value={emp.uid}>
                                            {emp.displayName} {emp.position ? `(${emp.position})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.modalFooter}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setShowAssignModal(false)}>Zrušit</button>
                                <button
                                    type="button"
                                    className={styles.submitBtn}
                                    onClick={handleAssignShift}
                                    disabled={!selectedEmployeeId}
                                >
                                    Přiřadit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
