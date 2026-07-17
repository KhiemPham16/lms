import { Outlet } from 'react-router-dom';

import styles from './AuthLayout.module.scss';
import ui from '~/shared/styles/ui.module.scss';

export function AuthLayout() {
    return (
        <main className={styles.layout}>
            <section className={styles.hero} aria-label="SMART LMS">
                <div>
                    <p className={ui.eyebrow}>SMART LMS</p>
                    <h1>Hệ thống quản lý học tập cho nhiều vai trò vận hành</h1>
                </div>
            </section>
            <section className={styles.panel}>
                <Outlet />
            </section>
        </main>
    );
}
