'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingScreen from '@/components/ui/LoadingScreen';
import styles from './layout.module.css';

interface NavItem {
    href: string;
    label: string;
    icon: string;
    adminOnly?: boolean;
}

const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Přehled', icon: '' },
    { href: '/dashboard/shifts', label: 'Směny', icon: '' },
    { href: '/dashboard/calendar', label: 'Kalendář', icon: '' },
    { href: '/dashboard/tasks', label: 'Úkoly', icon: '' },
    { href: '/dashboard/board', label: 'Nástěnka', icon: '' },
    { href: '/dashboard/gallery', label: 'Galerie', icon: '' },
    { href: '/dashboard/employees', label: 'Zaměstnanci', icon: '', adminOnly: true },
    { href: '/dashboard/profile', label: 'Profil', icon: '' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, userProfile, loading, signOut, isAdmin, isShiftManager, canManageShifts } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        }
    }, [user, loading, router]);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    if (loading || !user) {
        return <LoadingScreen />;
    }

    const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className={styles.layout}>
            <header className={styles.mobileHeader}>
                <button className={styles.menuBtn} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    <span>{isMobileMenuOpen ? '✕' : '☰'}</span>
                </button>
                <Link href="/dashboard" className={styles.mobileLogo}>
                    <img src="/logo-vesnice-icon.png" alt="Vesnice" className={styles.mobileLogoImg} />
                </Link>
                <div className={styles.mobileAvatar}>
                    {userProfile?.photoURL ? (
                        <img src={userProfile.photoURL} alt="" />
                    ) : (
                        <span>{getInitials(userProfile?.displayName || 'U')}</span>
                    )}
                </div>
            </header>

            <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarContent}>
                    <Link href="/dashboard" className={styles.logo}>
                        <img src="/logo-vesnice-sidebar.png" alt="Vesnice" className={styles.logoImg} />
                    </Link>

                    <nav className={styles.nav}>
                        {filteredNavItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`}
                            >
                                <span className={styles.navLabel}>{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    <div className={styles.sidebarFooter}>
                        <div className={styles.userInfo}>
                            <div className={styles.userAvatar}>
                                {userProfile?.photoURL ? (
                                    <img src={userProfile.photoURL} alt="" className={styles.avatarImg} />
                                ) : (
                                    <span>{getInitials(userProfile?.displayName || 'U')}</span>
                                )}
                            </div>
                            <div className={styles.userDetails}>
                                <span className={styles.userName}>{userProfile?.displayName || 'Uživatel'}</span>
                                <span className={styles.userRole}>
                                    {isAdmin ? 'Admin' : isShiftManager ? 'Vedoucí směny' : 'Zaměstnanec'}
                                </span>
                            </div>
                        </div>
                        <button className={styles.logoutBtn} onClick={() => signOut()}>
                            Odhlásit se
                        </button>
                    </div>
                </div>
            </aside>

            {isMobileMenuOpen && <div className={styles.overlay} onClick={() => setIsMobileMenuOpen(false)} />}

            <main className={styles.main}>
                {children}
            </main>
        </div>
    );
}
