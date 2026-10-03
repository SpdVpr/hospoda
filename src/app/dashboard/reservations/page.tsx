'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useEffect, useState } from 'react';
import { listReservations, type Reservation } from '@/lib/data';
import styles from './page.module.css';

// Reservations from the public website (same Supabase project). Only people whose
// e-mail is on the website admin allow-list may read them (team_reservations).

const STATUS_LABELS: Record<string, string> = {
    pending: 'Čeká na potvrzení',
    confirmed: 'Potvrzeno',
    seated: 'Dorazili',
};

const pragueToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());

const shiftDate = (date: string, days: number) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

const formatDay = (date: string) =>
    new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
        new Date(`${date}T12:00:00Z`),
    );

const osob = (n: number) => (n === 1 ? '1 osoba' : n >= 2 && n <= 4 ? `${n} osoby` : `${n} osob`);

export default function ReservationsPage() {
    const { user } = useAuth();
    const [date, setDate] = useState(pragueToday);
    const [items, setItems] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            setItems(await listReservations(date));
        } catch (err) {
            setItems([]);
            setError(err instanceof Error && /NOT_ALLOWED/.test(err.message)
                ? 'Váš e-mail zatím nemá přístup k rezervacím. Požádejte vedoucího, ať vás přidá v administraci webu (Uživatelé → role Obsluha).'
                : 'Rezervace se teď nepodařilo načíst. Zkuste to prosím za chvíli.');
        } finally {
            setLoading(false);
        }
    }, [user, date]);

    useEffect(() => {
        load();
    }, [load]);

    const guests = items.reduce((sum, r) => sum + r.party_size, 0);
    const today = pragueToday();

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Rezervace</h1>
                    <p className={styles.subtitle}>Rezervace z webu a telefonu – kdo k nám dnes přijde.</p>
                </div>
                <button className={styles.refreshBtn} onClick={load} disabled={loading}>
                    {loading ? 'Načítám…' : 'Obnovit'}
                </button>
            </div>

            <div className={styles.dayNav}>
                <button className={styles.navBtn} onClick={() => setDate((d) => shiftDate(d, -1))} aria-label="Předchozí den">
                    ←
                </button>
                <div className={styles.dayLabel}>
                    <span className={styles.dayName}>{formatDay(date)}</span>
                    {date !== today ? (
                        <button className={styles.todayBtn} onClick={() => setDate(today)}>
                            Dnes
                        </button>
                    ) : (
                        <span className={styles.todayBadge}>Dnes</span>
                    )}
                </div>
                <button className={styles.navBtn} onClick={() => setDate((d) => shiftDate(d, 1))} aria-label="Další den">
                    →
                </button>
            </div>

            <div className={styles.stats}>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{items.length}</span>
                    <span className={styles.statLabel}>rezervací</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{guests}</span>
                    <span className={styles.statLabel}>hostů</span>
                </div>
            </div>

            {error ? <div className={styles.error}>{error}</div> : null}

            {!error && !loading && items.length === 0 ? (
                <div className={styles.empty}>Na tento den zatím nikdo nerezervoval.</div>
            ) : null}

            <ul className={styles.list}>
                {items.map((r, i) => (
                    <li key={`${r.time}-${r.name}-${i}`} className={`${styles.card} ${r.status === 'pending' ? styles.cardPending : ''}`}>
                        <div className={styles.time}>{r.time}</div>
                        <div className={styles.body}>
                            <div className={styles.row}>
                                <span className={styles.name}>{r.name}</span>
                                <span className={`${styles.badge} ${styles[`badge_${r.status}`]}`}>{STATUS_LABELS[r.status]}</span>
                            </div>
                            <div className={styles.meta}>
                                {osob(r.party_size)}
                                {r.table_label ? ` · stůl ${r.table_label}` : ''}
                                {' · '}
                                <a href={`tel:${r.phone}`} className={styles.phone}>
                                    {r.phone}
                                </a>
                            </div>
                            {r.note ? <p className={styles.note}>Host: „{r.note}“</p> : null}
                            {r.internal_note ? <p className={styles.internal}>Pozn.: {r.internal_note}</p> : null}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
