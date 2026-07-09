import { Navigate, Outlet } from 'react-router-dom';

import useAuthStore from '~/stores/auth.store';

export default function GuestRoute() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    const initialized = useAuthStore((state) => state.initialized);

    if (!initialized) {
        return null;
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
