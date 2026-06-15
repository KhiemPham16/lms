import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { routes } from '~/config/routes';
import { useAuthStore } from '~/stores/authStore';

export default function ProtectedRoute() {
    const location = useLocation();
    const accessToken = useAuthStore((state) => state.accessToken);

    if (!accessToken) {
        return <Navigate to={routes.login} replace state={{ from: location }} />;
    }

    return <Outlet />;
}
