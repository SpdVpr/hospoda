'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile, UserRole } from '@/types';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function EmployeesPage() {
    const { userProfile, isAdmin } = useAuth();
    const router = useRouter();
    const [employees, setEmployees] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState<UserProfile | null>(null);
    const [editData, setEditData] = useState({ role: 'employee' as UserRole, position: '', hourlyRate: 0, adminNotes: '', isActive: true });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => { if (!isAdmin && !loading) { router.push('/dashboard'); } }, [isAdmin, loading, router]);

    const fetchEmployees = async () => {
        try {
            const usersQuery = query(collection(db, 'users'), orderBy('displayName', 'asc'));
            const usersSnap = await getDocs(usersQuery);
            setEmployees(usersSnap.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as UserProfile[]);
        } catch (error) { console.error('Error fetching employees:', error); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (isAdmin) { fetchEmployees(); } }, [isAdmin]);

    const handleSelectEmployee = (employee: UserProfile) => {
        setSelectedEmployee(employee);
        setEditData({ role: employee.role, position: employee.position || '', hourlyRate: employee.hourlyRate || 0, adminNotes: employee.adminNotes || '', isActive: employee.isActive });
    };

    const handleSave = async () => {
        if (!selectedEmployee) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', selectedEmployee.uid), { ...editData, updatedAt: new Date() });
            fetchEmployees(); setSelectedEmployee(null);
        } catch (error) { console.error('Error updating employee:', error); }
        finally { setSaving(false); }
    };

    const handleDeleteEmployee = async () => {
        if (!selectedEmployee || selectedEmployee.uid === userProfile?.uid) return;
        if (!confirm(`Opravdu chcete smazat zaměstnance ${selectedEmployee.displayName}? Tato akce je nevratná!`)) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, 'users', selectedEmployee.uid));
            fetchEmployees(); setSelectedEmployee(null);
        } catch (error) { console.error('Error deleting employee:', error); }
        finally { setDeleting(false); }
    };

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    if (!isAdmin) { return null; }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div><h1 className={styles.title}>👥 Zaměstnanci</h1><p className={styles.subtitle}>Správa zaměstnanců a oprávnění</p></div>
                <div className={styles.stats}>
                    <div className={styles.stat}><span className={styles.statValue}>{employees.length}</span><span className={styles.statLabel}>Celkem</span></div>
                    <div className={styles.stat}><span className={styles.statValue}>{employees.filter(e => e.isActive).length}</span><span className={styles.statLabel}>Aktivních</span></div>
                    <div className={styles.stat}><span className={styles.statValue}>{employees.filter(e => e.role === 'admin').length}</span><span className={styles.statLabel}>Adminů</span></div>
                </div>
            </div>

            <div className={styles.content}>
                <div className={styles.employeesList}>
                    <h2 className={styles.sectionTitle}>Seznam zaměstnanců</h2>
                    {loading ? (<div className={styles.loading}>{[...Array(5)].map((_, i) => <div key={i} className={styles.skeleton}></div>)}</div>
                    ) : employees.length === 0 ? (<div className={styles.empty}><span className={styles.emptyIcon}>👥</span><p>Zatím žádní zaměstnanci</p></div>
                    ) : (
                        <div className={styles.list}>
                            {employees.map((employee) => (
                                <button key={employee.uid} className={`${styles.employeeCard} ${selectedEmployee?.uid === employee.uid ? styles.selected : ''} ${!employee.isActive ? styles.inactive : ''}`} onClick={() => handleSelectEmployee(employee)}>
                                    <div className={styles.avatar}>{employee.photoURL ? <img src={employee.photoURL} alt="" /> : <span>{getInitials(employee.displayName)}</span>}</div>
                                    <div className={styles.employeeInfo}><span className={styles.employeeName}>{employee.displayName}</span><span className={styles.employeeEmail}>{employee.email}</span></div>
                                    <div className={styles.employeeMeta}>
                                        {employee.role === 'admin' && <span className={styles.adminBadge}>👑 Admin</span>}
                                        {employee.position && <span className={styles.positionBadge}>{employee.position}</span>}
                                        {!employee.isActive && <span className={styles.inactiveBadge}>Neaktivní</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {selectedEmployee && (
                    <div className={styles.employeeDetail}>
                        <div className={styles.detailHeader}><h2>Detail zaměstnance</h2><button className={styles.closeBtn} onClick={() => setSelectedEmployee(null)}>✕</button></div>
                        <div className={styles.detailProfile}>
                            <div className={styles.detailAvatar}>{selectedEmployee.photoURL ? <img src={selectedEmployee.photoURL} alt="" /> : <span>{getInitials(selectedEmployee.displayName)}</span>}</div>
                            <div className={styles.detailInfo}><h3>{selectedEmployee.displayName}</h3><p>{selectedEmployee.email}</p></div>
                        </div>
                        <form className={styles.editForm} onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                            <div className={styles.formGroup}>
                                <label htmlFor="role">Role</label>
                                <select id="role" value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value as UserRole })} disabled={selectedEmployee.uid === userProfile?.uid}><option value="employee">Zaměstnanec</option><option value="admin">Admin</option></select>
                                {selectedEmployee.uid === userProfile?.uid && <span className={styles.hint}>Nemůžete změnit vlastní roli</span>}
                            </div>
                            <div className={styles.formGroup}><label htmlFor="position">Pozice</label><input type="text" id="position" value={editData.position} onChange={(e) => setEditData({ ...editData, position: e.target.value })} placeholder="např. Číšník, Barman..." /></div>
                            <div className={styles.formGroup}><label htmlFor="hourlyRate">Hodinová mzda (Kč)</label><input type="number" id="hourlyRate" value={editData.hourlyRate} onChange={(e) => setEditData({ ...editData, hourlyRate: Number(e.target.value) })} min="0" step="10" /></div>
                            <div className={styles.formGroup}><label htmlFor="adminNotes">Poznámky (pouze pro admina)</label><textarea id="adminNotes" value={editData.adminNotes} onChange={(e) => setEditData({ ...editData, adminNotes: e.target.value })} placeholder="Interní poznámky..." rows={3} /></div>
                            <div className={styles.formGroup}><label className={styles.checkboxLabel}><input type="checkbox" checked={editData.isActive} onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })} disabled={selectedEmployee.uid === userProfile?.uid} /><span>Aktivní zaměstnanec</span></label></div>
                            <div className={styles.formActions}>
                                {selectedEmployee.uid !== userProfile?.uid && (
                                    <button type="button" className={styles.deleteBtn} onClick={handleDeleteEmployee} disabled={deleting}>
                                        {deleting ? 'Mažu...' : '🗑️ Smazat'}
                                    </button>
                                )}
                                <button type="button" className={styles.cancelBtn} onClick={() => setSelectedEmployee(null)}>Zrušit</button>
                                <button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? 'Ukládám...' : 'Uložit změny'}</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
