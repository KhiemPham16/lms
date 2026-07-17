import { FiAlertTriangle, FiClock } from 'react-icons/fi';
import { Outlet } from 'react-router-dom';

import ui from '~/shared/styles/ui.module.scss';
import styles from './ExamLayout.module.scss';

export function ExamLayout() {
    return (
        <main className={styles.layout}>
            <header className={styles.header}>
                <div>
                    <p className={ui.eyebrow}>Chế độ làm bài</p>
                    <h1>Kiểm tra / Thi</h1>
                </div>
                <div className={styles.status}>
                    <span>
                        <FiClock /> Đồng hồ máy chủ
                    </span>
                    <span>
                        <FiAlertTriangle /> Ghi nhận rời trang
                    </span>
                </div>
            </header>
            <Outlet />
        </main>
    );
}
