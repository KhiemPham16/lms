import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthStore } from '~/shared/store/authStore.js';

export function GuestRoute() {
    const location = useLocation();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const user = useAuthStore((state) => state.user);

    if (isAuthenticated) {
        return <Navigate to={location.state?.from?.pathname ?? user?.homePath ?? '/dashboard'} replace />;
    }

    return <Outlet />;
}
