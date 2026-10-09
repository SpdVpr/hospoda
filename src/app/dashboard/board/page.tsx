'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { createAnnouncement, deleteAnnouncement, listAnnouncements, updateAnnouncement } from '@/lib/data';
import { Announcement } from '@/types';
import styles from './page.module.css';

interface AnnouncementFormData { title: string; content: string; priority: 'normal' | 'important' | 'urgent'; }
const initialFormData: AnnouncementFormData = { title: '', content: '', priority: 'normal' };

export default function BoardPage() {
    const { userProfile, isAdmin } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
    const [formData, setFormData] = useState<AnnouncementFormData>(initialFormData);
    const [submitting, setSubmitting] = useState(false);

    const fetchAnnouncements = async () => {
        try {
            setAnnouncements(await listAnnouncements({ activeOnly: true }));
        } catch (error) { console.error('Error fetching announcements:', error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAnnouncements(); }, []);

    const handleOpenModal = (announcement?: Announcement) => {
        if (announcement) { setEditingAnnouncement(announcement); setFormData({ title: announcement.title, content: announcement.content, priority: announcement.priority }); }
        else { setEditingAnnouncement(null); setFormData(initialFormData); }
        setShowModal(true);
    };

    const handleCloseModal = () => { setShowModal(false); setEditingAnnouncement(null); setFormData(initialFormData); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile || !isAdmin) return;
        setSubmitting(true);
        try {
            if (editingAnnouncement) { await updateAnnouncement(editingAnnouncement.id, formData); }
            else { await createAnnouncement(formData, userProfile); }
            handleCloseModal(); fetchAnnouncements();
        } catch (error) { console.error('Error saving announcement:', error); }
        finally { setSubmitting(false); }
    };

    const handleDeleteAnnouncement = async (announcement: Announcement) => {
        if (!isAdmin || !confirm('Opravdu chcete smazat toto oznámení?')) return;
        try { await deleteAnnouncement(announcement.id); fetchAnnouncements(); }
        catch (error) { console.error('Error deleting announcement:', error); }
    };

    const getPriorityIcon = (priority: string) => priority === 'urgent' ? '🚨' : priority === 'important' ? '⚠️' : '📌';
    const getPriorityLabel = (priority: string) => priority === 'urgent' ? 'Urgentní' : priority === 'important' ? 'Důležité' : 'Běžné';

    const formatDate = (timestamp?: Date) => {
        if (!timestamp) return '';
        const date = timestamp;
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) { const hours = Math.floor(diff / (1000 * 60 * 60)); if (hours === 0) { return `před ${Math.floor(diff / (1000 * 60))} minutami`; } return `před ${hours} hodinami`; }
        if (days === 1) return 'včera';
        if (days < 7) return `před ${days} dny`;
        return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div><h1 className={styles.title}>Nástěnka</h1><p className={styles.subtitle}>Oznámení a důležité informace</p></div>
                {isAdmin && (<button className={styles.createBtn} onClick={() => handleOpenModal()}><span>+</span><span>Nové oznámení</span></button>)}
            </div>

            {loading ? (<div className={styles.loading}>{[...Array(3)].map((_, i) => <div key={i} className={styles.skeleton}></div>)}</div>
            ) : announcements.length === 0 ? (<div className={styles.empty}><p className={styles.emptyText}>Zatím žádná oznámení</p>{isAdmin && <button className={styles.emptyBtn} onClick={() => handleOpenModal()}>Přidat první oznámení</button>}</div>
            ) : (
                <div className={styles.announcementsList}>
                    {announcements.map((announcement) => (
                        <article key={announcement.id} className={`${styles.announcement} ${styles[announcement.priority]}`}>
                            <div className={styles.announcementHeader}>
                                <div className={styles.priorityBadge}><span>{getPriorityIcon(announcement.priority)}</span><span>{getPriorityLabel(announcement.priority)}</span></div>
                                {isAdmin && (<div className={styles.actions}><button className={styles.editBtn} onClick={() => handleOpenModal(announcement)}>✏️</button><button className={styles.deleteBtn} onClick={() => handleDeleteAnnouncement(announcement)}>🗑️</button></div>)}
                            </div>
                            <h2 className={styles.announcementTitle}>{announcement.title}</h2>
                            <p className={styles.announcementContent}>{announcement.content}</p>
                            <div className={styles.announcementMeta}><span className={styles.author}>{announcement.createdByName}</span><span className={styles.date}>{formatDate(announcement.createdAt)}</span></div>
                        </article>
                    ))}
                </div>
            )}

            {showModal && (
                <div className={styles.modalOverlay} onClick={handleCloseModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}><h2>{editingAnnouncement ? 'Upravit oznámení' : 'Nové oznámení'}</h2><button className={styles.closeBtn} onClick={handleCloseModal}>✕</button></div>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.formGroup}><label htmlFor="title">Nadpis</label><input type="text" id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Nadpis oznámení" required /></div>
                            <div className={styles.formGroup}><label htmlFor="content">Obsah</label><textarea id="content" value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} placeholder="Text oznámení..." rows={5} required /></div>
                            <div className={styles.formGroup}><label htmlFor="priority">Priorita</label><select id="priority" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as Announcement['priority'] })}><option value="normal">📌 Běžné</option><option value="important">⚠️ Důležité</option><option value="urgent">🚨 Urgentní</option></select></div>
                            <div className={styles.modalFooter}><button type="button" className={styles.cancelBtn} onClick={handleCloseModal}>Zrušit</button><button type="submit" className={styles.submitBtn} disabled={submitting}>{submitting ? 'Ukládám...' : (editingAnnouncement ? 'Uložit' : 'Publikovat')}</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
