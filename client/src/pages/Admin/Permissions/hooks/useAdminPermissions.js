import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { getDefaultOpenPermissionGroups, permissionRoles } from '~/config/permissionManagement';
import { roleService } from '~/services/roleService';
import { useAuthStore } from '~/stores/useAuthStore';
import {
    defaultRolePermissions,
    saveDashboardPermissions,
    toBackendPermissions,
    toClientPermissions
} from '~/utils/permissions';

const getInitialRolePermissions = () => ({
    ...defaultRolePermissions,
    ADMIN: ['*']
});

export function useAdminPermissions() {
    const [initialPermissions, setInitialPermissions] = useState(getInitialRolePermissions);
    const [activeRole, setActiveRole] = useState('HR');
    const [permissions, setPermissions] = useState(initialPermissions);
    const [rolePublicIds, setRolePublicIds] = useState({});
    const [openGroups, setOpenGroups] = useState(getDefaultOpenPermissionGroups);
    const [showAudit, setShowAudit] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fetchMe = useAuthStore((state) => state.fetchMe);

    const activeRoleLabel = permissionRoles.find((role) => role.id === activeRole)?.label || activeRole;
    const selectedPermissions = permissions[activeRole] || [];
    const hasWildcard = selectedPermissions.includes('*');

    const hasChanges = useMemo(
        () => JSON.stringify(permissions) !== JSON.stringify(initialPermissions),
        [initialPermissions, permissions]
    );

    useEffect(() => {
        const loadPermissions = async () => {
            try {
                setIsLoading(true);
                const roles = await roleService.getRoles();
                const nextPermissions = { ...defaultRolePermissions, ADMIN: ['*'] };
                const nextRolePublicIds = {};

                roles.forEach((role) => {
                    nextRolePublicIds[role.code] = role.publicId;

                    if (role.code !== 'ADMIN') {
                        nextPermissions[role.code] = toClientPermissions(role.permissionCodes || []).filter(
                            (permission) => permission !== 'permissions.manage'
                        );
                    }
                });

                setPermissions(nextPermissions);
                setInitialPermissions(nextPermissions);
                setRolePublicIds(nextRolePublicIds);
            } catch (error) {
                console.error(error);
                toast.error(error?.response?.data?.message || 'Không tải được cấu hình phân quyền');
            } finally {
                setIsLoading(false);
            }
        };

        loadPermissions();
    }, []);

    const togglePermission = (permissionId) => {
        if (permissionId === 'permissions.manage' && activeRole !== 'ADMIN') {
            toast.error('Chỉ ADMIN được quản lý phân quyền');
            return;
        }

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
        const permissionIds = group.permissions
            .map((permission) => permission.id)
            .filter((permissionId) => activeRole === 'ADMIN' || permissionId !== 'permissions.manage');
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

    const savePermissions = async () => {
        try {
            setIsSaving(true);

            const publicId = rolePublicIds[activeRole];

            if (!publicId) {
                toast.error('Không tìm thấy vai trò cần lưu');
                return;
            }

            const selectedRolePermissions = (permissions[activeRole] || []).filter(
                (permission) => permission !== 'permissions.manage'
            );

            const updatedRole = await roleService.updateRolePermissions(
                publicId,
                toBackendPermissions(selectedRolePermissions)
            );

            const nextPermissions = {
                ...permissions,
                [activeRole]: toClientPermissions(updatedRole.permissionCodes || []).filter(
                    (permission) => permission !== 'permissions.manage'
                ),
                ADMIN: ['*']
            };

            saveDashboardPermissions(nextPermissions);
            setPermissions(nextPermissions);
            setInitialPermissions(nextPermissions);
            await fetchMe();
            toast.success('Đã lưu cấu hình phân quyền');
            setShowAudit(true);
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.message || 'Lưu cấu hình phân quyền thất bại');
        } finally {
            setIsSaving(false);
        }
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
        isLoading,
        isSaving,
        setActiveRole,
        setShowAudit,
        togglePermission,
        toggleGroup,
        toggleOpenGroup,
        resetChanges,
        savePermissions
    };
}
