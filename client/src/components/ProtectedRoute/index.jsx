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
        let cancelled = false;

        const initSession = async () => {
            const currentToken = useAuthStore.getState().accessToken;
            let hasToken = Boolean(currentToken);

            if (!hasToken) {
                hasToken = await refresh({ silent: true });
            }

            if (hasToken) {
                await fetchMe({ silent: true, clearOnFailure: true });
            }

            if (!cancelled) {
                setStarting(false);
            }
        };

        initSession();

        return () => {
            cancelled = true;
        };
    }, [refresh, fetchMe]);

    useEffect(() => {
        const syncCurrentUser = () => {
            const currentToken = useAuthStore.getState().accessToken;

            if (currentToken) {
                fetchMe({ silent: true, clearOnFailure: true });
            }
        };

        const syncWhenVisible = () => {
            if (document.visibilityState === 'visible') {
                syncCurrentUser();
            }
        };

        window.addEventListener('focus', syncCurrentUser);
        document.addEventListener('visibilitychange', syncWhenVisible);

        return () => {
            window.removeEventListener('focus', syncCurrentUser);
            document.removeEventListener('visibilitychange', syncWhenVisible);
        };
    }, [fetchMe]);

    if (starting || loading) {
        return <div>Đang tải trang...</div>;
    }

    if (!accessToken || !user) {
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
