import { Navigate, Outlet, useLocation } from 'react-router-dom';

import styles from '~/pages/status/StatusPage.module.scss';
import { useAuthBootstrap } from '~/shared/hooks/useAuthBootstrap.js';
import { useAuthStore } from '~/shared/store/authStore.js';

export function ProtectedRoute({ allowedRoles, children }) {
    const location = useLocation();
    const { isBootstrapping } = useAuthBootstrap();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const user = useAuthStore((state) => state.user);

    if (isBootstrapping) {
        return <div className={styles.loader}>Đang tải phiên làm việc...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (allowedRoles?.length && !allowedRoles.includes(user?.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return children ?? <Outlet />;
}
