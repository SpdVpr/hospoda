import styles from './LoadingScreen.module.css';

export default function LoadingScreen() {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.logo}>
                    <img src="/logo-vesnice-icon.png" alt="Vesnice" className={styles.logoIcon} />
                    <span className={styles.logoText}>Vesnice</span>
                </div>
                <div className={styles.spinner}></div>
                <p className={styles.text}>Načítám...</p>
            </div>
        </div>
    );
}
