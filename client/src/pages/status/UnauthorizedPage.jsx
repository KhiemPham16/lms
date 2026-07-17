import { FiShield } from 'react-icons/fi';
import { Link } from 'react-router-dom';

import ui from '~/shared/styles/ui.module.scss';
import styles from './StatusPage.module.scss';

export function UnauthorizedPage() {
    return (
        <main className={styles.page}>
            <FiShield />
            <h1>Không có quyền truy cập</h1>
            <p>Route này không nằm trong vai trò hiện tại của bạn.</p>
            <Link className={ui.primaryButton} to="/dashboard">
                Về dashboard
            </Link>
        </main>
    );
}
