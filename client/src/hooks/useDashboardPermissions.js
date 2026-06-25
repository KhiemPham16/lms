import { useEffect, useMemo, useState } from 'react';

import {
    DASHBOARD_PERMISSIONS_UPDATED_EVENT,
    buildDashboardPermissionsFromUser,
    readDashboardPermissions
} from '~/utils/permissions';
import { useAuthStore } from '~/stores/useAuthStore';

export function useDashboardPermissions() {
    const currentUser = useAuthStore((state) => state.user);
    const [permissionsVersion, setPermissionsVersion] = useState(0);

    useEffect(() => {
        const syncPermissions = () => {
            setPermissionsVersion((version) => version + 1);
        };

        window.addEventListener(DASHBOARD_PERMISSIONS_UPDATED_EVENT, syncPermissions);
        window.addEventListener('storage', syncPermissions);

        return () => {
            window.removeEventListener(DASHBOARD_PERMISSIONS_UPDATED_EVENT, syncPermissions);
            window.removeEventListener('storage', syncPermissions);
        };
    }, []);

    return useMemo(() => {
        const storedPermissions = permissionsVersion >= 0 ? readDashboardPermissions() : {};

        return {
            ...storedPermissions,
            ...buildDashboardPermissionsFromUser(currentUser)
        };
    }, [currentUser, permissionsVersion]);
}
