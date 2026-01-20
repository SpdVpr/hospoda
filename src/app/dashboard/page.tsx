'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Shift, Task, Announcement } from '@/types';
import Link from 'next/link';
import styles from './page.module.css';

export default function DashboardPage() {
    const { userProfile, isAdmin } = useAuth();
    const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
    const [myTasks, setMyTasks] = useState<Task[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!userProfile) return;
            try {
                const today = new Date().toISOString().split('T')[0];

                // Fetch shifts
                const shiftsQuery = query(
                    collection(db, 'shifts'),
                    where('date', '>=', today),
                    orderBy('date', 'asc'),
                    limit(5)
                );
                const shiftsSnap = await getDocs(shiftsQuery);
                const shiftsData = shiftsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Shift[];
                const filteredShifts = isAdmin ? shiftsData : shiftsData.filter(s => s.assignedTo === userProfile.uid || s.status === 'open');
                setUpcomingShifts(filteredShifts);

                // Fetch tasks
                const tasksQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(5));
                const tasksSnap = await getDocs(tasksQuery);
                const tasksData = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
                const filteredTasks = isAdmin ? tasksData : tasksData.filter(t => t.status !== 'completed' && (t.assignedTo === userProfile.uid || !t.assignedTo));
                setMyTasks(filteredTasks.slice(0, 5));

                // Fetch announcements
                const announcementsQuery = query(collection(db, 'announcements'), where('isActive', '==', true), orderBy('createdAt', 'desc'), limit(3));
                const announcementsSnap = await getDocs(announcementsQuery);
                setAnnouncements(announcementsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Announcement[]);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userProfile, isAdmin]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Dobré ráno';
        if (hour < 18) return 'Dobré odpoledne';
        return 'Dobrý večer';
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.greeting}>
                        {getGreeting()}, {userProfile?.displayName?.split(' ')[0] || 'uživateli'}!
                    </h1>
                    <p className={styles.subtitle}>
                        {new Date().toLocaleDateString('cs-CZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                {isAdmin && (
                    <Link href="/dashboard/shifts" className={styles.createBtn}>
                        <span>+</span>
                        <span>Nová směna</span>
                    </Link>
                )}
            </div>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{upcomingShifts.length}</span>
                        <span className={styles.statLabel}>Nadcházejících směn</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{myTasks.length}</span>
                        <span className={styles.statLabel}>Aktivních úkolů</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{announcements.length}</span>
                        <span className={styles.statLabel}>Oznámení</span>
                    </div>
                </div>
                {isAdmin && (
                    <div className={styles.statCard}>
                        <div className={styles.statContent}>
                            <span className={styles.statValue}>Admin</span>
                            <span className={styles.statLabel}>Vaše role</span>
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.contentGrid}>
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Nadcházející směny</h2>
                        <Link href="/dashboard/shifts" className={styles.cardLink}>Zobrazit vše →</Link>
                    </div>
                    <div className={styles.cardContent}>
                        {loading ? (
                            <div className={styles.loading}><div className={styles.skeleton}></div><div className={styles.skeleton}></div></div>
                        ) : upcomingShifts.length === 0 ? (
                            <div className={styles.empty}><p>Žádné nadcházející směny</p></div>
                        ) : (
                            <div className={styles.list}>
                                {upcomingShifts.map((shift) => (
                                    <div key={shift.id} className={styles.listItem}>
                                        <div><span className={styles.listItemDate}>{shift.date}</span><span className={styles.listItemTime}>{shift.startTime} - {shift.endTime}</span></div>
                                        <span className={styles.listItemPosition}>{shift.position}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Úkoly</h2>
                        <Link href="/dashboard/tasks" className={styles.cardLink}>Zobrazit vše →</Link>
                    </div>
                    <div className={styles.cardContent}>
                        {loading ? (
                            <div className={styles.loading}><div className={styles.skeleton}></div><div className={styles.skeleton}></div></div>
                        ) : myTasks.length === 0 ? (
                            <div className={styles.empty}><p>Žádné aktivní úkoly</p></div>
                        ) : (
                            <div className={styles.list}>
                                {myTasks.map((task) => (
                                    <div key={task.id} className={styles.listItem}>
                                        <span className={styles.listItemTitle}>{task.title}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className={`${styles.card} ${styles.cardFull}`}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Nástěnka</h2>
                        <Link href="/dashboard/board" className={styles.cardLink}>Zobrazit vše →</Link>
                    </div>
                    <div className={styles.cardContent}>
                        {loading ? (
                            <div className={styles.loading}><div className={styles.skeleton}></div></div>
                        ) : announcements.length === 0 ? (
                            <div className={styles.empty}><p>Žádná oznámení</p></div>
                        ) : (
                            <div className={styles.announcements}>
                                {announcements.map((a) => (
                                    <div key={a.id} className={styles.announcement}>
                                        <h3>{a.title}</h3>
                                        <p>{a.content}</p>
                                        <span>— {a.createdByName}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
