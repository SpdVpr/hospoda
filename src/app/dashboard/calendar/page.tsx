'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Shift } from '@/types';
import styles from './page.module.css';

export default function CalendarPage() {
    const { userProfile } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    useEffect(() => {
        const fetchShifts = async () => {
            setLoading(true);
            try {
                const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
                const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
                const shiftsQuery = query(collection(db, 'shifts'), where('date', '>=', firstDay), where('date', '<=', lastDay));
                const shiftsSnap = await getDocs(shiftsQuery);
                setShifts(shiftsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Shift[]);
            } catch (error) {
                console.error('Error fetching shifts:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchShifts();
    }, [year, month]);

    const getDaysInMonth = () => {
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const days: { day: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
        const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
        for (let i = startDay - 1; i >= 0; i--) { days.push({ day: daysInPrevMonth - i, isCurrentMonth: false, isToday: false }); }
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, isCurrentMonth: true, isToday: today.getDate() === i && today.getMonth() === month && today.getFullYear() === year });
        }
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) { days.push({ day: i, isCurrentMonth: false, isToday: false }); }
        return days;
    };

    const getShiftsForDay = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return shifts.filter(s => s.date === dateStr);
    };

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date().getDate()); };

    const weekDays = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
    const days = getDaysInMonth();

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>🗓️ Kalendář</h1>
                    <p className={styles.subtitle}>Měsíční přehled směn</p>
                </div>
            </div>

            <div className={styles.calendarHeader}>
                <button className={styles.navBtn} onClick={prevMonth}>←</button>
                <h2 className={styles.monthTitle}>{currentDate.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}</h2>
                <button className={styles.navBtn} onClick={nextMonth}>→</button>
                <button className={styles.todayBtn} onClick={goToToday}>Dnes</button>
            </div>

            <div className={styles.legend}>
                <span><span className={styles.legendDot} style={{ background: 'var(--accent-success)' }}></span> Volné směny</span>
                <span><span className={styles.legendDot} style={{ background: 'var(--accent-primary)' }}></span> Moje směny</span>
                <span><span className={styles.legendDot} style={{ background: 'var(--text-muted)' }}></span> Obsazené</span>
            </div>

            <div className={styles.calendar}>
                <div className={styles.weekDays}>
                    {weekDays.map(day => <div key={day} className={styles.weekDay}>{day}</div>)}
                </div>
                <div className={styles.days}>
                    {days.map((day, index) => {
                        const dayShifts = day.isCurrentMonth ? getShiftsForDay(day.day) : [];
                        const hasOpen = dayShifts.some(s => s.status === 'open');
                        const hasMine = dayShifts.some(s => s.assignedTo === userProfile?.uid);
                        const hasOther = dayShifts.some(s => s.status === 'assigned' && s.assignedTo !== userProfile?.uid);
                        return (
                            <button
                                key={index}
                                className={`${styles.day} ${!day.isCurrentMonth ? styles.otherMonth : ''} ${day.isToday ? styles.today : ''} ${selectedDay === day.day && day.isCurrentMonth ? styles.selected : ''}`}
                                onClick={() => day.isCurrentMonth && setSelectedDay(day.day === selectedDay ? null : day.day)}
                                disabled={!day.isCurrentMonth}
                            >
                                <span className={styles.dayNumber}>{day.day}</span>
                                {dayShifts.length > 0 && (
                                    <div className={styles.indicators}>
                                        {hasOpen && <span className={styles.indicator} style={{ background: 'var(--accent-success)' }} />}
                                        {hasMine && <span className={styles.indicator} style={{ background: 'var(--accent-primary)' }} />}
                                        {hasOther && <span className={styles.indicator} style={{ background: 'var(--text-muted)' }} />}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedDay && (
                <div className={styles.dayDetail}>
                    <h3 className={styles.dayDetailTitle}>
                        {selectedDay}. {currentDate.toLocaleDateString('cs-CZ', { month: 'long' })}
                    </h3>
                    {getShiftsForDay(selectedDay).length === 0 ? (
                        <p className={styles.noShifts}>Žádné směny</p>
                    ) : (
                        <div className={styles.dayShifts}>
                            {getShiftsForDay(selectedDay).map(shift => (
                                <div key={shift.id} className={styles.dayShift}>
                                    <div className={styles.shiftTime}>{shift.startTime} - {shift.endTime}</div>
                                    <div className={styles.shiftPosition}>{shift.position}</div>
                                    <div className={styles.shiftStatus}>
                                        {shift.status === 'open' ? '🟢 Volná' : shift.assignedTo === userProfile?.uid ? '🟡 Moje' : `👤 ${shift.assignedToName}`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
