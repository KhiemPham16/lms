import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
    getDefaultOpenPermissionGroups,
    permissionRoles
} from '~/config/permissionManagement';
import { defaultRolePermissions, readDashboardPermissions, saveDashboardPermissions } from '~/utils/permissions';

const getInitialRolePermissions = () => ({
    ...defaultRolePermissions,
    ...readDashboardPermissions(),
    ADMIN: ['*']
});

export function useAdminPermissions() {
    const [initialPermissions, setInitialPermissions] = useState(getInitialRolePermissions);
    const [activeRole, setActiveRole] = useState('TRAINING_OFFICER');
    const [permissions, setPermissions] = useState(initialPermissions);
    const [openGroups, setOpenGroups] = useState(getDefaultOpenPermissionGroups);
    const [showAudit, setShowAudit] = useState(false);

    const activeRoleLabel = permissionRoles.find((role) => role.id === activeRole)?.label || activeRole;
    const selectedPermissions = permissions[activeRole] || [];
    const hasWildcard = selectedPermissions.includes('*');

    const hasChanges = useMemo(
        () => JSON.stringify(permissions) !== JSON.stringify(initialPermissions),
        [initialPermissions, permissions]
    );

    const togglePermission = (permissionId) => {
        setPermissions((prev) => {
            const rolePermissions = prev[activeRole] || [];
            const nextPermissions = rolePermissions.includes(permissionId)
                ? rolePermissions.filter((item) => item !== permissionId)
                : [...rolePermissions, permissionId];

            return {
                ...prev,
                [activeRole]: nextPermissions
            };
        });
    };

    const toggleGroup = (group) => {
        const permissionIds = group.permissions.map((permission) => permission.id);
        const allSelected = permissionIds.every((id) => selectedPermissions.includes(id));

        setPermissions((prev) => {
            const current = prev[activeRole] || [];
            const next = allSelected
                ? current.filter((id) => !permissionIds.includes(id))
                : [...new Set([...current, ...permissionIds])];

            return {
                ...prev,
                [activeRole]: next
            };
        });
    };

    const toggleOpenGroup = (groupId) => {
        setOpenGroups((prev) => ({
            ...prev,
            [groupId]: !prev[groupId]
        }));
    };

    const resetChanges = () => {
        setPermissions(initialPermissions);
    };

    const savePermissions = () => {
        const nextPermissions = { ...permissions, ADMIN: ['*'] };
        saveDashboardPermissions(nextPermissions);
        setPermissions(nextPermissions);
        setInitialPermissions(nextPermissions);
        toast.success('Đã lưu cấu hình phân quyền');
        setShowAudit(true);
    };

    return {
        activeRole,
        activeRoleLabel,
        permissions,
        selectedPermissions,
        hasWildcard,
        openGroups,
        hasChanges,
        showAudit,
        setActiveRole,
        setShowAudit,
        togglePermission,
        toggleGroup,
        toggleOpenGroup,
        resetChanges,
        savePermissions
    };
}
