'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { createTasks, deleteTask, listShifts, listTasks, setTaskStatus, updateTask } from '@/lib/data';
import { Task, TaskPriority, TaskStatus } from '@/types';
import styles from './page.module.css';

interface TaskFormData { title: string; description: string; priority: TaskPriority; dueDate: string; }
const initialFormData: TaskFormData = { title: '', description: '', priority: 'medium', dueDate: '' };

export default function TasksPage() {
    const { userProfile, isAdmin } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [formData, setFormData] = useState<TaskFormData>(initialFormData);
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [submitting, setSubmitting] = useState(false);

    const fetchTasks = async () => {
        if (!userProfile) return;

        try {
            // All tasks, newest first
            const allTasks = await listTasks();

            if (isAdmin) {
                // Admin sees all tasks
                setTasks(allTasks);
            } else {
                // Employee: only tasks from their own shifts
                const myShiftIds = (await listShifts())
                    .filter(shift => shift.assignedTo === userProfile.uid)
                    .map(shift => shift.id);

                setTasks(allTasks.filter(task =>
                    task.shiftId && myShiftIds.includes(task.shiftId)
                ));
            }
        } catch (error) { console.error('Error fetching tasks:', error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTasks(); }, [userProfile, isAdmin]);

    const handleOpenModal = (task?: Task) => {
        if (task) { setEditingTask(task); setFormData({ title: task.title, description: task.description || '', priority: task.priority, dueDate: task.dueDate || '' }); }
        else { setEditingTask(null); setFormData(initialFormData); }
        setShowModal(true);
    };

    const handleCloseModal = () => { setShowModal(false); setEditingTask(null); setFormData(initialFormData); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) return;
        setSubmitting(true);
        try {
            if (editingTask) { await updateTask(editingTask.id, formData); }
            else { await createTasks([formData], userProfile.uid); }
            handleCloseModal(); fetchTasks();
        } catch (error) { console.error('Error saving task:', error); }
        finally { setSubmitting(false); }
    };

    const handleToggleStatus = async (task: Task) => {
        if (!userProfile) return;
        const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
        try {
            await setTaskStatus(task.id, newStatus, userProfile.uid);
            fetchTasks();
        } catch (error) { console.error('Error updating task status:', error); }
    };

    const handleDeleteTask = async (task: Task) => {
        if (!isAdmin || !confirm('Opravdu chcete smazat tento úkol?')) return;
        try { await deleteTask(task.id); fetchTasks(); }
        catch (error) { console.error('Error deleting task:', error); }
    };

    const filteredTasks = tasks.filter(task => {
        if (filter === 'pending') return task.status !== 'completed';
        if (filter === 'completed') return task.status === 'completed';
        return true;
    });

    const getPriorityIcon = (p: TaskPriority) => p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢';

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Úkoly</h1>
                    <p className={styles.subtitle}>{isAdmin ? 'Spravujte úkoly pro zaměstnance' : 'Vaše přiřazené úkoly'}</p>
                </div>
                {isAdmin && (<button className={styles.createBtn} onClick={() => handleOpenModal()}><span>+</span><span>Nový úkol</span></button>)}
            </div>

            <div className={styles.filters}>
                <button className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`} onClick={() => setFilter('all')}>Všechny ({tasks.length})</button>
                <button className={`${styles.filterBtn} ${filter === 'pending' ? styles.active : ''}`} onClick={() => setFilter('pending')}>Aktivní ({tasks.filter(t => t.status !== 'completed').length})</button>
                <button className={`${styles.filterBtn} ${filter === 'completed' ? styles.active : ''}`} onClick={() => setFilter('completed')}>Dokončené ({tasks.filter(t => t.status === 'completed').length})</button>
            </div>

            {loading ? (<div className={styles.loading}>{[...Array(5)].map((_, i) => <div key={i} className={styles.skeleton}></div>)}</div>
            ) : filteredTasks.length === 0 ? (<div className={styles.empty}><span className={styles.emptyIcon}>✅</span><p className={styles.emptyText}>{filter === 'completed' ? 'Žádné dokončené úkoly' : 'Žádné aktivní úkoly'}</p>{isAdmin && <button className={styles.emptyBtn} onClick={() => handleOpenModal()}>Vytvořit první úkol</button>}</div>
            ) : (
                <div className={styles.tasksList}>
                    {filteredTasks.map((task) => (
                        <div key={task.id} className={`${styles.taskCard} ${task.status === 'completed' ? styles.completed : ''}`}>
                            <button className={styles.checkbox} onClick={() => handleToggleStatus(task)}>{task.status === 'completed' ? '✓' : ''}</button>
                            <div className={styles.taskMain}>
                                <div className={styles.taskHeader}><span className={styles.taskTitle}>{task.title}</span><span className={styles.priority}>{getPriorityIcon(task.priority)}</span></div>
                                {task.description && <p className={styles.taskDesc}>{task.description}</p>}
                                <div className={styles.taskMeta}>{task.dueDate && <span className={styles.dueDate}>📅 {task.dueDate}</span>}{task.assignedToName && <span className={styles.assignee}>👤 {task.assignedToName}</span>}</div>
                            </div>
                            {isAdmin && (<div className={styles.actions}><button className={styles.editBtn} onClick={() => handleOpenModal(task)}>✏️</button><button className={styles.deleteBtn} onClick={() => handleDeleteTask(task)}>🗑️</button></div>)}
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className={styles.modalOverlay} onClick={handleCloseModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}><h2>{editingTask ? 'Upravit úkol' : 'Nový úkol'}</h2><button className={styles.closeBtn} onClick={handleCloseModal}>✕</button></div>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.formGroup}><label htmlFor="title">Název úkolu</label><input type="text" id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Co je potřeba udělat?" required /></div>
                            <div className={styles.formGroup}><label htmlFor="description">Popis</label><textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Podrobnosti..." rows={3} /></div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}><label htmlFor="priority">Priorita</label><select id="priority" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}><option value="low">🟢 Nízká</option><option value="medium">🟡 Střední</option><option value="high">🔴 Vysoká</option></select></div>
                                <div className={styles.formGroup}><label htmlFor="dueDate">Termín</label><input type="date" id="dueDate" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} min={new Date().toISOString().split('T')[0]} /></div>
                            </div>
                            <div className={styles.modalFooter}><button type="button" className={styles.cancelBtn} onClick={handleCloseModal}>Zrušit</button><button type="submit" className={styles.submitBtn} disabled={submitting}>{submitting ? 'Ukládám...' : (editingTask ? 'Uložit' : 'Vytvořit')}</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
