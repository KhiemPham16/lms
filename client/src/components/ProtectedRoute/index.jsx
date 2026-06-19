import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { routes } from '~/config/routes';
import { useAuthStore } from '~/stores/useAuthStore';

export default function ProtectedRoute() {
    const location = useLocation();

    const accessToken = useAuthStore((state) => state.accessToken);
    const loading = useAuthStore((state) => state.loading);
    const refresh = useAuthStore((state) => state.refresh);
    const fetchMe = useAuthStore((state) => state.fetchMe);

    const [starting, setStarting] = useState(true);

    useEffect(() => {
        const init = async () => {
            const currentToken = useAuthStore.getState().accessToken;
            const currentUser = useAuthStore.getState().user;

            if (!currentToken) {
                await refresh();
            }

            const latestToken = useAuthStore.getState().accessToken;
            const latestUser = useAuthStore.getState().user;

            if (latestToken && !latestUser && !currentUser) {
                await fetchMe();
            }

            setStarting(false);
        };

        init();
    }, [refresh, fetchMe]);

    if (starting || loading) {
        return <div>Đang tải trang...</div>;
    }

    if (!accessToken) {
        return <Navigate to={routes.login} replace state={{ from: location }} />;
    }

    return <Outlet />;
}
