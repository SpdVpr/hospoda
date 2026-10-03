'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { assignShift, createShifts, createTasks, deleteShift, deleteTask, listShifts, listTasks, releaseShift } from '@/lib/data';
import { Shift, TaskPriority } from '@/types';
import styles from './page.module.css';

interface ShiftTask {
    title: string;
    priority: TaskPriority;
}

const defaultTasks: ShiftTask[] = [
    { title: 'Úklid před otevřením', priority: 'medium' },
    { title: 'Kontrola zásob', priority: 'low' },
    { title: 'Příprava baru', priority: 'medium' },
];

interface ShiftTemplate {
    name: string;
    startTime: string;
    endTime: string;
    icon: string;
}

const shiftTemplates: ShiftTemplate[] = [
    { name: 'Ranní', startTime: '06:00', endTime: '14:00', icon: '🌅' },
    { name: 'Odpolední', startTime: '14:00', endTime: '22:00', icon: '☀️' },
    { name: 'Večerní', startTime: '18:00', endTime: '02:00', icon: '🌙' },
    { name: 'Celý den', startTime: '10:00', endTime: '22:00', icon: '📅' },
];

const positions = ['Barman / Barmanka', 'Číšník / Servírka', 'Kuchař'];

export default function CalendarPage() {
    const { userProfile, isAdmin } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
    const [selectedDayForDetail, setSelectedDayForDetail] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<ShiftTemplate | null>(null);
    const [customShift, setCustomShift] = useState({ startTime: '16:00', endTime: '21:00', position: 'Číšník / Servírka', notes: '' });
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [shiftTasks, setShiftTasks] = useState<ShiftTask[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
    // For adding task to existing shift
    const [addTaskToShiftId, setAddTaskToShiftId] = useState<string | null>(null);
    const [existingShiftTask, setExistingShiftTask] = useState({ title: '', priority: 'medium' as TaskPriority });
    const [shiftTasksMap, setShiftTasksMap] = useState<Record<string, any[]>>({});
    const dayDetailRef = useRef<HTMLDivElement>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    useEffect(() => {
        const fetchShifts = async () => {
            setLoading(true);
            try {
                const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
                const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
                setShifts(await listShifts({ from: firstDay, to: lastDay }));
            } catch (error) {
                console.error('Error fetching shifts:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchShifts();
    }, [year, month]);

    // Fetch tasks for shifts when day is selected
    useEffect(() => {
        const fetchTasksForDay = async () => {
            if (!selectedDayForDetail) return;
            const dayShifts = shifts.filter(s => s.date === selectedDayForDetail);
            if (dayShifts.length === 0) return;

            const newTasksMap: Record<string, any[]> = {};
            try {
                const tasks = await listTasks({ shiftIds: dayShifts.map(s => s.id) });
                for (const shift of dayShifts) {
                    newTasksMap[shift.id] = tasks.filter(t => t.shiftId === shift.id);
                }
            } catch (error) {
                console.error('Error fetching tasks for shift:', error);
            }
            setShiftTasksMap(newTasksMap);
        };
        fetchTasksForDay();
    }, [selectedDayForDetail, shifts]);

    const getDaysInMonth = () => {
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const days: { day: number; isCurrentMonth: boolean; isToday: boolean; dateStr: string }[] = [];
        const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

        for (let i = startDay - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            days.push({ day: d, isCurrentMonth: false, isToday: false, dateStr: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
        }

        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            days.push({ day: i, isCurrentMonth: true, isToday: today.getDate() === i && today.getMonth() === month && today.getFullYear() === year, dateStr });
        }

        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            days.push({ day: i, isCurrentMonth: false, isToday: false, dateStr: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}` });
        }
        return days;
    };

    const getShiftsForDay = (dateStr: string) => shifts.filter(s => s.date === dateStr);

    const handleDayClick = (dateStr: string, isCurrentMonth: boolean) => {
        if (!isCurrentMonth) return;

        if (isSelectionMode && isAdmin) {
            setSelectedDays(prev => {
                const newSet = new Set(prev);
                if (newSet.has(dateStr)) {
                    newSet.delete(dateStr);
                } else {
                    newSet.add(dateStr);
                }
                return newSet;
            });
        } else {
            setSelectedDayForDetail(selectedDayForDetail === dateStr ? null : dateStr);
            // Scroll to detail after a short delay to allow render
            if (selectedDayForDetail !== dateStr) {
                setTimeout(() => {
                    dayDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    };

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedDays(new Set());
        setSelectedDayForDetail(null);
    };

    const openCreateModal = () => {
        if (selectedDays.size === 0) {
            alert('Nejprve vyberte alespoň jeden den');
            return;
        }
        setShowCreateModal(true);
    };

    const addTask = () => {
        if (!newTaskTitle.trim()) return;
        setShiftTasks([...shiftTasks, { title: newTaskTitle.trim(), priority: newTaskPriority }]);
        setNewTaskTitle('');
        setNewTaskPriority('medium');
    };

    const removeTask = (index: number) => {
        setShiftTasks(shiftTasks.filter((_, i) => i !== index));
    };

    const addDefaultTask = (task: ShiftTask) => {
        if (!shiftTasks.find(t => t.title === task.title)) {
            setShiftTasks([...shiftTasks, task]);
        }
    };

    const handleCreateShifts = async () => {
        if (!userProfile || !isAdmin) return;
        setSubmitting(true);

        const startTime = selectedTemplate ? selectedTemplate.startTime : customShift.startTime;
        const endTime = selectedTemplate ? selectedTemplate.endTime : customShift.endTime;

        try {
            // Create shifts and collect their IDs
            const createdShiftIds = await createShifts(
                Array.from(selectedDays).map(date => ({
                    date,
                    startTime,
                    endTime,
                    position: customShift.position,
                    notes: customShift.notes,
                })),
                userProfile.uid
            );

            // Create tasks for each shift if any tasks were added
            if (shiftTasks.length > 0) {
                await createTasks(
                    createdShiftIds.flatMap(shiftId => shiftTasks.map(task => ({ title: task.title, priority: task.priority, shiftId }))),
                    userProfile.uid
                );
            }

            // Refresh shifts
            const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
            const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
            setShifts(await listShifts({ from: firstDay, to: lastDay }));

            setShowCreateModal(false);
            setSelectedDays(new Set());
            setIsSelectionMode(false);
            setSelectedTemplate(null);
            setShiftTasks([]);
        } catch (error) {
            console.error('Error creating shifts:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddTaskToShift = async (shiftId: string) => {
        if (!userProfile || !existingShiftTask.title.trim()) return;
        setSubmitting(true);
        try {
            await createTasks([{ title: existingShiftTask.title.trim(), priority: existingShiftTask.priority, shiftId }], userProfile.uid);

            // Refresh tasks for this shift
            const shiftTasksList = await listTasks({ shiftIds: [shiftId] });
            setShiftTasksMap(prev => ({
                ...prev,
                [shiftId]: shiftTasksList
            }));

            setExistingShiftTask({ title: '', priority: 'medium' });
            setAddTaskToShiftId(null);
        } catch (error) {
            console.error('Error adding task to shift:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteTaskFromShift = async (taskId: string, shiftId: string) => {
        if (!isAdmin) return;
        try {
            await deleteTask(taskId);
            setShiftTasksMap(prev => ({
                ...prev,
                [shiftId]: (prev[shiftId] || []).filter(t => t.id !== taskId)
            }));
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    const handleTakeShift = async (shift: Shift) => {
        if (!userProfile) return;
        try {
            await assignShift(shift.id, userProfile);
            setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, status: 'assigned', assignedTo: userProfile.uid, assignedToName: userProfile.displayName } : s));
        } catch (error) {
            console.error('Error taking shift:', error);
        }
    };

    const handleReleaseShift = async (shift: Shift) => {
        if (!userProfile) return;
        try {
            await releaseShift(shift.id);
            setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, status: 'open', assignedTo: undefined, assignedToName: undefined } : s));
        } catch (error) {
            console.error('Error releasing shift:', error);
        }
    };

    const handleDeleteShift = async (shift: Shift) => {
        if (!isAdmin || !confirm('Smazat tuto směnu?')) return;
        try {
            await deleteShift(shift.id);
            setShifts(prev => prev.filter(s => s.id !== shift.id));
        } catch (error) {
            console.error('Error deleting shift:', error);
        }
    };

    const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDays(new Set()); setSelectedDayForDetail(null); };
    const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDays(new Set()); setSelectedDayForDetail(null); };
    const goToToday = () => { setCurrentDate(new Date()); };

    const weekDays = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
    const days = getDaysInMonth();
    const isPast = (dateStr: string) => new Date(dateStr) < new Date(new Date().toISOString().split('T')[0]);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Kalendář směn</h1>
                    <p className={styles.subtitle}>Přehled a plánování směn</p>
                </div>
                {isAdmin && (
                    <div className={styles.headerActions}>
                        <button
                            className={`${styles.selectionBtn} ${isSelectionMode ? styles.active : ''}`}
                            onClick={toggleSelectionMode}
                        >
                            {isSelectionMode ? 'Zrušit výběr' : 'Vybrat dny'}
                        </button>
                        {isSelectionMode && selectedDays.size > 0 && (
                            <button className={styles.createBtn} onClick={openCreateModal}>
                                + Vytvořit směny ({selectedDays.size})
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className={styles.calendarContainer}>
                <div className={styles.calendarHeader}>
                    <button className={styles.navBtn} onClick={prevMonth}>←</button>
                    <h2 className={styles.monthTitle}>{currentDate.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}</h2>
                    <button className={styles.navBtn} onClick={nextMonth}>→</button>
                    <button className={styles.todayBtn} onClick={goToToday}>Dnes</button>
                </div>

                <div className={styles.legend}>
                    <span className={styles.legendItem}><span className={`${styles.legendBox} ${styles.openShift}`}></span> Volné směny</span>
                    <span className={styles.legendItem}><span className={`${styles.legendBox} ${styles.assignedShift}`}></span> Obsazené směny</span>
                    <span className={styles.legendItem}><span className={`${styles.legendBox} ${styles.myShift}`}></span> Moje směny</span>
                </div>

                <div className={styles.calendar}>
                    <div className={styles.weekDays}>
                        {weekDays.map(day => <div key={day} className={styles.weekDay}>{day}</div>)}
                    </div>

                    <div className={styles.days}>
                        {days.map((dayData, index) => {
                            const dayShifts = getShiftsForDay(dayData.dateStr);
                            const isSelected = selectedDays.has(dayData.dateStr);
                            const hasOpenShifts = dayShifts.some(s => s.status === 'open');
                            const hasMyShift = dayShifts.some(s => s.assignedTo === userProfile?.uid);

                            return (
                                <div
                                    key={index}
                                    className={`
                    ${styles.day} 
                    ${!dayData.isCurrentMonth ? styles.otherMonth : ''} 
                    ${dayData.isToday ? styles.today : ''} 
                    ${isSelected ? styles.selected : ''}
                    ${selectedDayForDetail === dayData.dateStr ? styles.detailSelected : ''}
                    ${isPast(dayData.dateStr) && dayData.isCurrentMonth ? styles.past : ''}
                  `}
                                    onClick={() => handleDayClick(dayData.dateStr, dayData.isCurrentMonth)}
                                >
                                    <span className={styles.dayNumber}>{dayData.day}</span>

                                    {dayData.isCurrentMonth && dayShifts.length > 0 && (
                                        <div className={styles.dayShifts}>
                                            {dayShifts.slice(0, 3).map((shift, i) => (
                                                <div
                                                    key={shift.id}
                                                    className={`
                            ${styles.shiftBlock}
                            ${shift.status === 'open' ? styles.shiftOpen : ''}
                            ${shift.status === 'assigned' && shift.assignedTo === userProfile?.uid ? styles.shiftMine : ''}
                            ${shift.status === 'assigned' && shift.assignedTo !== userProfile?.uid ? styles.shiftAssigned : ''}
                          `}
                                                    title={`${shift.startTime}-${shift.endTime} ${shift.position}${shift.assignedToName ? ` (${shift.assignedToName})` : ''}`}
                                                >
                                                    <span className={styles.shiftTime}>{shift.startTime}</span>
                                                    <span className={styles.shiftPos}>{shift.position.slice(0, 3)}</span>
                                                </div>
                                            ))}
                                            {dayShifts.length > 3 && (
                                                <div className={styles.moreShifts}>+{dayShifts.length - 3}</div>
                                            )}
                                        </div>
                                    )}

                                    {isSelectionMode && isSelected && (
                                        <div className={styles.checkmark}>✓</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Day Detail Panel */}
            {selectedDayForDetail && !isSelectionMode && (
                <div ref={dayDetailRef} className={styles.dayDetail}>
                    <div className={styles.dayDetailHeader}>
                        <h3>{new Date(selectedDayForDetail).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                        <button className={styles.closeBtn} onClick={() => setSelectedDayForDetail(null)}>✕</button>
                    </div>

                    {getShiftsForDay(selectedDayForDetail).length === 0 ? (
                        <div className={styles.noShifts}>
                            <p>Žádné směny pro tento den</p>
                            {isAdmin && (
                                <button className={styles.addShiftBtn} onClick={() => { setSelectedDays(new Set([selectedDayForDetail])); setShowCreateModal(true); }}>
                                    + Přidat směnu
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className={styles.shiftsList}>
                            {getShiftsForDay(selectedDayForDetail).map(shift => {
                                const shiftTasksList = shiftTasksMap[shift.id] || [];
                                return (
                                    <div key={shift.id} className={`${styles.shiftCard} ${shift.status === 'open' ? styles.open : styles.assigned}`}>
                                        <div className={styles.shiftInfo}>
                                            <div className={styles.shiftHeader}>
                                                <span className={styles.shiftTimeRange}>{shift.startTime} - {shift.endTime}</span>
                                                <span className={`${styles.shiftStatus} ${shift.status === 'open' ? styles.statusOpen : styles.statusAssigned}`}>
                                                    {shift.status === 'open' ? 'Volná' : 'Obsazená'}
                                                </span>
                                            </div>
                                            <div className={styles.shiftPosition}>{shift.position}</div>
                                            {shift.assignedToName && <div className={styles.shiftAssignee}>{shift.assignedToName}</div>}
                                            {shift.notes && <div className={styles.shiftNotes}>{shift.notes}</div>}

                                            {/* Tasks section */}
                                            {shiftTasksList.length > 0 && (
                                                <div className={styles.shiftTasksSection}>
                                                    <div className={styles.shiftTasksTitle}>Úkoly ({shiftTasksList.length})</div>
                                                    {shiftTasksList.map((task: any) => (
                                                        <div key={task.id} className={styles.shiftTaskItem}>
                                                            <span className={styles.taskPriorityIcon}>
                                                                {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}
                                                            </span>
                                                            <span className={`${styles.shiftTaskTitle} ${task.status === 'completed' ? styles.completed : ''}`}>
                                                                {task.title}
                                                            </span>
                                                            {isAdmin && (
                                                                <button
                                                                    className={styles.deleteTaskBtn}
                                                                    onClick={() => handleDeleteTaskFromShift(task.id, shift.id)}
                                                                >✕</button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Add task form */}
                                            {addTaskToShiftId === shift.id && (
                                                <div className={styles.addTaskForm}>
                                                    <input
                                                        type="text"
                                                        placeholder="Nový úkol..."
                                                        value={existingShiftTask.title}
                                                        onChange={e => setExistingShiftTask({ ...existingShiftTask, title: e.target.value })}
                                                        onKeyPress={e => e.key === 'Enter' && handleAddTaskToShift(shift.id)}
                                                        autoFocus
                                                    />
                                                    <select
                                                        value={existingShiftTask.priority}
                                                        onChange={e => setExistingShiftTask({ ...existingShiftTask, priority: e.target.value as TaskPriority })}
                                                    >
                                                        <option value="low">🟢</option>
                                                        <option value="medium">🟡</option>
                                                        <option value="high">🔴</option>
                                                    </select>
                                                    <button
                                                        className={styles.confirmTaskBtn}
                                                        onClick={() => handleAddTaskToShift(shift.id)}
                                                        disabled={submitting}
                                                    >✓</button>
                                                    <button
                                                        className={styles.cancelTaskBtn}
                                                        onClick={() => { setAddTaskToShiftId(null); setExistingShiftTask({ title: '', priority: 'medium' }); }}
                                                    >✕</button>
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.shiftActions}>
                                            {isAdmin && addTaskToShiftId !== shift.id && (
                                                <button
                                                    className={styles.addTaskBtn}
                                                    onClick={() => setAddTaskToShiftId(shift.id)}
                                                >
                                                    + Úkol
                                                </button>
                                            )}
                                            {shift.status === 'open' && !isPast(shift.date) && (
                                                <button className={styles.takeBtn} onClick={() => handleTakeShift(shift)}>Vzít směnu</button>
                                            )}
                                            {isAdmin && shift.status === 'assigned' && !isPast(shift.date) && (
                                                <button className={styles.releaseBtn} onClick={() => handleReleaseShift(shift)}>Uvolnit</button>
                                            )}
                                            {isAdmin && (
                                                <button className={styles.deleteBtn} onClick={() => handleDeleteShift(shift)}>Smazat</button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {isAdmin && (
                                <button className={styles.addMoreBtn} onClick={() => { setSelectedDays(new Set([selectedDayForDetail])); setShowCreateModal(true); }}>
                                    + Přidat další směnu
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Create Shifts Modal */}
            {showCreateModal && (
                <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Vytvořit směny</h2>
                            <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)}>✕</button>
                        </div>

                        <div className={styles.modalContent}>
                            <div className={styles.selectedDaysInfo}>
                                <strong>Vybrané dny ({selectedDays.size}):</strong>
                                <div className={styles.selectedDaysList}>
                                    {Array.from(selectedDays).sort().map(date => (
                                        <span key={date} className={styles.selectedDayChip}>
                                            {new Date(date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.templates}>
                                <label className={styles.formLabel}>Rychlé šablony</label>
                                <div className={styles.templateGrid}>
                                    {shiftTemplates.map(template => (
                                        <button
                                            key={template.name}
                                            className={`${styles.templateBtn} ${selectedTemplate?.name === template.name ? styles.selected : ''}`}
                                            onClick={() => setSelectedTemplate(selectedTemplate?.name === template.name ? null : template)}
                                        >
                                            <span className={styles.templateName}>{template.name}</span>
                                            <span className={styles.templateTime}>{template.startTime} - {template.endTime}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.divider}><span>nebo vlastní čas</span></div>

                            <div className={styles.customTime}>
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label>Od</label>
                                        <input
                                            type="time"
                                            value={selectedTemplate ? selectedTemplate.startTime : customShift.startTime}
                                            onChange={e => { setCustomShift({ ...customShift, startTime: e.target.value }); setSelectedTemplate(null); }}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Do</label>
                                        <input
                                            type="time"
                                            value={selectedTemplate ? selectedTemplate.endTime : customShift.endTime}
                                            onChange={e => { setCustomShift({ ...customShift, endTime: e.target.value }); setSelectedTemplate(null); }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Pozice</label>
                                <select value={customShift.position} onChange={e => setCustomShift({ ...customShift, position: e.target.value })}>
                                    {positions.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Poznámka (volitelné)</label>
                                <input
                                    type="text"
                                    value={customShift.notes}
                                    onChange={e => setCustomShift({ ...customShift, notes: e.target.value })}
                                    placeholder="např. Speciální akce, důležité info..."
                                />
                            </div>

                            <div className={styles.divider}><span>Úkoly pro směnu</span></div>

                            <div className={styles.tasksSection}>
                                <div className={styles.quickTasks}>
                                    <label className={styles.formLabel}>Rychlé přidání</label>
                                    <div className={styles.quickTaskBtns}>
                                        {defaultTasks.map(task => (
                                            <button
                                                key={task.title}
                                                type="button"
                                                className={`${styles.quickTaskBtn} ${shiftTasks.find(t => t.title === task.title) ? styles.added : ''}`}
                                                onClick={() => addDefaultTask(task)}
                                            >
                                                {shiftTasks.find(t => t.title === task.title) ? '✓ ' : '+ '}{task.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles.addTaskRow}>
                                    <input
                                        type="text"
                                        value={newTaskTitle}
                                        onChange={e => setNewTaskTitle(e.target.value)}
                                        placeholder="Vlastní úkol..."
                                        onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addTask())}
                                    />
                                    <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as TaskPriority)}>
                                        <option value="low">🟢 Nízká</option>
                                        <option value="medium">🟡 Střední</option>
                                        <option value="high">🔴 Vysoká</option>
                                    </select>
                                    <button type="button" className={styles.addTaskBtn} onClick={addTask}>+</button>
                                </div>

                                {shiftTasks.length > 0 && (
                                    <div className={styles.tasksList}>
                                        <label className={styles.formLabel}>Přidané úkoly ({shiftTasks.length})</label>
                                        {shiftTasks.map((task, index) => (
                                            <div key={index} className={styles.taskItem}>
                                                <span className={styles.taskPriority}>
                                                    {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}
                                                </span>
                                                <span className={styles.taskTitle}>{task.title}</span>
                                                <button type="button" className={styles.removeTaskBtn} onClick={() => removeTask(index)}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setShowCreateModal(false)}>Zrušit</button>
                            <button className={styles.confirmBtn} onClick={handleCreateShifts} disabled={submitting}>
                                {submitting ? 'Vytvářím...' : `Vytvořit ${selectedDays.size} směn`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
