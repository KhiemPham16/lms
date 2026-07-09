import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { canAccessPath, getDefaultPathForUser } from '~/config/navigation';
import useAuthStore from '~/stores/auth.store';

export default function ProtectedRoute() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const user = useAuthStore((state) => state.user);
    const location = useLocation();

    const initialized = useAuthStore((state) => state.initialized);

    if (!initialized) {
        return null;
    }

    if (!isAuthenticated) {
        return <Navigate to="/auth/login" replace />;
    }

    if (!canAccessPath(user, location.pathname)) {
        return <Navigate to={getDefaultPathForUser(user)} replace />;
    }

    return <Outlet />;
}
