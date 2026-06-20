import { useEffect, useState } from 'react';

import {
    DASHBOARD_PERMISSIONS_UPDATED_EVENT,
    readDashboardPermissions
} from '~/utils/permissions';

export function useDashboardPermissions() {
    const [permissions, setPermissions] = useState(readDashboardPermissions);

    useEffect(() => {
        const syncPermissions = () => {
            setPermissions(readDashboardPermissions());
        };

        window.addEventListener(DASHBOARD_PERMISSIONS_UPDATED_EVENT, syncPermissions);
        window.addEventListener('storage', syncPermissions);

        return () => {
            window.removeEventListener(DASHBOARD_PERMISSIONS_UPDATED_EVENT, syncPermissions);
            window.removeEventListener('storage', syncPermissions);
        };
    }, []);

    return permissions;
}
