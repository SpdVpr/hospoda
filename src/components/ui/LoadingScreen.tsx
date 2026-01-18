import styles from './LoadingScreen.module.css';

export default function LoadingScreen() {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.logo}>
                    <span className={styles.logoIcon}>🍺</span>
                    <span className={styles.logoText}>Hospoda</span>
                </div>
                <div className={styles.spinner}></div>
                <p className={styles.text}>Načítám...</p>
            </div>
        </div>
    );
}
