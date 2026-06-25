import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { routes } from '~/config/routes';
import { useAuthStore } from '~/stores/useAuthStore';
import {
    buildDashboardPermissionsFromUser,
    canAccessDashboardRoute,
    dashboardRoutes,
    getDefaultDashboardPath,
    normalizeRole
} from '~/utils/permissions';

export default function ProtectedRoute() {
    const location = useLocation();

    const accessToken = useAuthStore((state) => state.accessToken);
    const user = useAuthStore((state) => state.user);
    const loading = useAuthStore((state) => state.loading);
    const refresh = useAuthStore((state) => state.refresh);
    const fetchMe = useAuthStore((state) => state.fetchMe);

    const [starting, setStarting] = useState(true);

    useEffect(() => {
        const init = async () => {
            const currentToken = useAuthStore.getState().accessToken;

            if (!currentToken) {
                await refresh();
            }

            const latestToken = useAuthStore.getState().accessToken;
            if (latestToken) {
                await fetchMe();
            }

            setStarting(false);
        };

        init();
    }, [refresh, fetchMe]);

    useEffect(() => {
        const syncCurrentUser = () => {
            const currentToken = useAuthStore.getState().accessToken;

            if (currentToken) {
                fetchMe({ silent: true });
            }
        };

        const syncWhenVisible = () => {
            if (document.visibilityState === 'visible') {
                syncCurrentUser();
            }
        };

        window.addEventListener('focus', syncCurrentUser);
        document.addEventListener('visibilitychange', syncWhenVisible);
        const intervalId = window.setInterval(syncCurrentUser, 5000);

        return () => {
            window.removeEventListener('focus', syncCurrentUser);
            document.removeEventListener('visibilitychange', syncWhenVisible);
            window.clearInterval(intervalId);
        };
    }, [fetchMe]);

    if (starting || loading) {
        return <div>Đang tải trang...</div>;
    }

    if (!accessToken) {
        return <Navigate to={routes.login} replace state={{ from: location }} />;
    }

    const currentRole = normalizeRole(user?.role || user?.roleDetail?.code);
    const route = dashboardRoutes
        .filter((item) =>
            item.end ? location.pathname === item.path : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
        )
        .sort((a, b) => b.path.length - a.path.length)[0];

    if (route && currentRole) {
        const permissions = buildDashboardPermissionsFromUser(user);
        if (!canAccessDashboardRoute(currentRole, route, permissions)) {
            return <Navigate to={getDefaultDashboardPath(currentRole, permissions)} replace />;
        }
    }

    return <Outlet />;
}
