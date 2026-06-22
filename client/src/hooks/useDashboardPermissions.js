import { useEffect, useState } from 'react';

import {
    DASHBOARD_PERMISSIONS_UPDATED_EVENT,
    buildDashboardPermissionsFromUser,
    readDashboardPermissions
} from '~/utils/permissions';
import { useAuthStore } from '~/stores/useAuthStore';

export function useDashboardPermissions() {
    const currentUser = useAuthStore((state) => state.user);
    const [permissions, setPermissions] = useState(() => buildDashboardPermissionsFromUser(currentUser));

    useEffect(() => {
        const syncPermissions = () => {
            setPermissions(buildDashboardPermissionsFromUser(useAuthStore.getState().user) || readDashboardPermissions());
        };

        window.addEventListener(DASHBOARD_PERMISSIONS_UPDATED_EVENT, syncPermissions);
        window.addEventListener('storage', syncPermissions);

        return () => {
            window.removeEventListener(DASHBOARD_PERMISSIONS_UPDATED_EVENT, syncPermissions);
            window.removeEventListener('storage', syncPermissions);
        };
    }, []);

    useEffect(() => {
        setPermissions(buildDashboardPermissionsFromUser(currentUser));
    }, [currentUser]);

    return permissions;
}
