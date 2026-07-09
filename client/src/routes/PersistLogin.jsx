import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

import authService from '~/services/auth.service';
import useAuthStore from '~/stores/auth.store';
// import {} from '~/config/axios';
import { setAccessToken, getAccessToken, removeAccessToken } from '~/utils/token';
export default function PersistLogin() {
    const [loading, setLoading] = useState(true);

    const initialize = useAuthStore((state) => state.initialize);

    useEffect(() => {
        let ignore = false;

        const init = async () => {
            const pathname = window.location.pathname;

            if (pathname.startsWith('/auth')) {
                initialize(null);
                if (!ignore) setLoading(false);
                return;
            }

            try {
                let token = getAccessToken();

                if (!token) {
                    const { accessToken } = await authService.refresh();

                    setAccessToken(accessToken);
                    token = accessToken;
                }

                const user = await authService.me();

                if (!ignore) {
                    initialize(user);
                }
            } catch {
                removeAccessToken();

                if (!ignore) {
                    initialize(null);
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        };

        init();

        return () => {
            ignore = true;
        };
    }, [initialize]);

    if (loading) {
        return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
    }

    return <Outlet />;
}
