import { FiCompass } from 'react-icons/fi';
import { Link } from 'react-router-dom';

import ui from '~/shared/styles/ui.module.scss';
import styles from './StatusPage.module.scss';

export function NotFoundPage() {
    return (
        <main className={styles.page}>
            <FiCompass />
            <h1>Không tìm thấy trang</h1>
            <p>Đường dẫn không tồn tại hoặc module chưa được mở.</p>
            <Link className={ui.primaryButton} to="/dashboard">
                Về dashboard
            </Link>
        </main>
    );
}
