import { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import {
    FiAlertTriangle,
    FiBookOpen,
    FiCheck,
    FiChevronDown,
    FiClipboard,
    FiClock,
    FiCopy,
    FiDatabase,
    FiEdit3,
    FiKey,
    FiLayers,
    FiList,
    FiRefreshCw,
    FiRotateCcw,
    FiSave,
    FiSearch,
    FiShield,
    FiTrash2,
    FiUserCheck,
    FiUsers,
    FiX
} from 'react-icons/fi';
import { toast } from 'sonner';

import AppSidebar from '~/components/AppSidebar';
import { auditLogService } from '~/services/auditLogService';
import { roleService } from '~/services/roleService';
import { userService } from '~/services/userService';
import { getPayloadItems, unwrapApiPayload } from '~/lib/apiPayload';
import { useAuthStore } from '~/stores/useAuthStore';
import { userHasBackendPermission } from '~/utils/permissions';
import layoutStyles from '~/pages/FlowWorkbench/FlowWorkbench.module.scss';
import permissionStyles from './Permissions.module.scss';

const styles = { ...layoutStyles, ...permissionStyles };
const cx = classNames.bind(styles);

const fallbackRoles = [
    { code: 'ADMIN', name: 'Admin', description: 'Quản trị toàn hệ thống.', users: 2, isSystem: true, icon: FiShield },
    { code: 'HR', name: 'HR', description: 'Quản lý nhân sự và tài khoản.', users: 5, isSystem: true, icon: FiUsers },
    { code: 'PRINCIPAL', name: 'Hiệu trưởng', description: 'Duyệt đề xuất cấp trường.', users: 2, isSystem: true, icon: FiUserCheck },
    { code: 'TRAINING_OFFICER', name: 'Phòng đào tạo', description: 'Quản lý chương trình, môn học và lớp học.', users: 12, isSystem: true, icon: FiBookOpen },
    { code: 'DEPARTMENT_HEAD', name: 'Trưởng bộ môn', description: 'Đề xuất môn học và phân công giảng viên.', users: 15, isSystem: true, icon: FiLayers },
    { code: 'LECTURER', name: 'Giảng viên', description: 'Quản lý bài học, bài kiểm tra và điểm.', users: 120, isSystem: true, icon: FiEdit3 },
    { code: 'STUDENT', name: 'Sinh viên', description: 'Học tập, đăng ký lớp, làm kiểm tra và xem điểm.', users: 1106, isSystem: true, icon: FiUsers }
];

const fallbackPermissionGroups = [
    {
        module: 'Quản lý người dùng',
        moduleKey: 'users',
        icon: FiUsers,
        permissions: [
            { code: 'users.read', name: 'Xem danh sách người dùng' },
            { code: 'users.create', name: 'Tạo người dùng', dependsOn: ['users.read'] },
            { code: 'users.update', name: 'Chỉnh sửa người dùng', dependsOn: ['users.read'] },
            { code: 'users.status', name: 'Khóa/mở khóa tài khoản', dependsOn: ['users.read'] }
        ]
    },
    {
        module: 'Vai trò và phân quyền',
        moduleKey: 'roles',
        icon: FiShield,
        permissions: [
            { code: 'roles.read', name: 'Xem danh sách vai trò' },
            { code: 'system.permissions.manage', name: 'Gán quyền cho vai trò', dependsOn: ['roles.read'], sensitive: true },
            { code: 'system.audit.read', name: 'Xem nhật ký hệ thống' }
        ]
    },
    {
        module: 'Lớp học',
        moduleKey: 'classes',
        icon: FiLayers,
        permissions: [
            { code: 'classes.read', name: 'Xem lớp học' },
            { code: 'classes.create', name: 'Tạo lớp', dependsOn: ['classes.read'] },
            { code: 'classes.update', name: 'Chỉnh sửa lớp', dependsOn: ['classes.read'] },
            { code: 'classes.assign_lecturer', name: 'Gán giảng viên', dependsOn: ['classes.read'] },
            { code: 'classes.registration.toggle', name: 'Mở/đóng đăng ký', dependsOn: ['classes.read'] }
        ]
    },
    {
        module: 'Môn học và đề xuất',
        moduleKey: 'courses',
        icon: FiClipboard,
        permissions: [
            { code: 'courses.read', name: 'Xem môn học' },
            { code: 'courses.update', name: 'Chỉnh sửa môn học', dependsOn: ['courses.read'] },
            { code: 'course_proposals.create', name: 'Tạo đề xuất', dependsOn: ['courses.read'] },
            { code: 'course_proposals.approve', name: 'Duyệt đề xuất', dependsOn: ['courses.read'] }
        ]
    },
    {
        module: 'Bài học, kiểm tra và điểm',
        moduleKey: 'learning',
        icon: FiDatabase,
        permissions: [
            { code: 'lessons.read', name: 'Xem bài học' },
            { code: 'lessons.create', name: 'Tạo bài học', dependsOn: ['lessons.read'] },
            { code: 'exams.read', name: 'Xem bài kiểm tra' },
            { code: 'exams.grade', name: 'Chấm bài', dependsOn: ['exams.read'] },
            { code: 'grades.read', name: 'Xem bảng điểm' },
            { code: 'grades.export', name: 'Xuất bảng điểm', dependsOn: ['grades.read'] }
        ]
    }
];

const dependencyMap = {
    'users.create': ['users.read'],
    'users.update': ['users.read'],
    'users.status': ['users.read'],
    'classes.create': ['classes.read'],
    'classes.update': ['classes.read'],
    'classes.assign_lecturer': ['classes.read'],
    'classes.registration.toggle': ['classes.read'],
    'course_proposals.create': ['courses.read'],
    'course_proposals.approve': ['courses.read'],
    'lessons.create': ['lessons.read'],
    'exams.grade': ['exams.read'],
    'grades.export': ['grades.read'],
    'system.permissions.manage': ['roles.read']
};

const sensitivePermissions = new Set(['system.permissions.manage', 'roles.delete', 'users.delete', 'system.config.manage']);

const moduleLabels = {
    users: 'Quản lý người dùng',
    roles: 'Vai trò',
    permissions: 'Phân quyền',
    system: 'Hệ thống',
    audit: 'Audit Log',
    courses: 'Môn học',
    course_proposals: 'Đề xuất môn học',
    classes: 'Lớp học',
    enrollments: 'Đăng ký lớp',
    lessons: 'Bài học',
    exams: 'Bài kiểm tra',
    grades: 'Bảng điểm',
    notifications: 'Thông báo'
};

const moduleIcons = {
    users: FiUsers,
    roles: FiShield,
    permissions: FiShield,
    system: FiList,
    audit: FiList,
    courses: FiClipboard,
    course_proposals: FiClipboard,
    classes: FiLayers,
    enrollments: FiLayers,
    lessons: FiBookOpen,
    exams: FiEdit3,
    grades: FiDatabase,
    notifications: FiClock
};

const fallbackRolePermissions = {
    ADMIN: fallbackPermissionGroups.flatMap((group) => group.permissions.map((permission) => permission.code)),
    HR: ['users.read', 'users.create', 'users.update', 'users.status'],
    PRINCIPAL: ['courses.read', 'course_proposals.approve', 'system.audit.read'],
    TRAINING_OFFICER: ['users.read', 'courses.read', 'courses.update', 'classes.read', 'classes.create', 'classes.registration.toggle', 'grades.read'],
    DEPARTMENT_HEAD: ['courses.read', 'course_proposals.create', 'classes.read', 'classes.assign_lecturer'],
    LECTURER: ['classes.read', 'lessons.read', 'lessons.create', 'exams.read', 'exams.grade', 'grades.read'],
    STUDENT: ['classes.read', 'lessons.read', 'exams.read', 'grades.read']
};

const unwrapList = (payload) => {
    const unwrapped = unwrapApiPayload(payload);
    return unwrapped?.items || unwrapped || [];
};
const unwrapItems = getPayloadItems;
const emptyRoleForm = { code: '', name: '', description: '', isSystem: false };

const formatDate = (value) => {
    if (!value) return 'Chưa cập nhật';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const formatDateTime = (value) => {
    if (!value) return 'Chưa cập nhật';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
};

const resolveUserCount = (role) => {
    if (Number.isFinite(role?.userCount)) return role.userCount;
    if (Number.isFinite(role?.usersCount)) return role.usersCount;
    if (Number.isFinite(role?._count?.users)) return role._count.users;
    if (Array.isArray(role?.users)) return role.users.length;
    return null;
};

const formatUserCount = (count) => (Number.isFinite(count) ? `${count} người dùng` : 'Chưa có số liệu');

const normalizeAuditValue = (value) => {
    if (!value || typeof value !== 'string') return value || {};
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
};

const getActorLabel = (log) => log?.actor?.fullName || log?.actor?.email || 'Hệ thống';

const getRoleLabelFromLog = (log, roleNameMap = {}) => {
    const oldValue = normalizeAuditValue(log?.oldValue);
    const newValue = normalizeAuditValue(log?.newValue);
    const roleCode = newValue.roleCode || oldValue.roleCode;
    return newValue.roleName || oldValue.roleName || roleNameMap[roleCode] || roleCode || log?.targetPublicId || '-';
};

const getPermissionChangeText = (log, permissionNameMap = {}) => {
    const oldValue = normalizeAuditValue(log?.oldValue);
    const newValue = normalizeAuditValue(log?.newValue);
    const previousCodes = oldValue.permissionCodes || [];
    const nextCodes = newValue.permissionCodes || [];
    const addedCodes = newValue.addedPermissionCodes || nextCodes.filter((code) => !previousCodes.includes(code));
    const removedCodes = newValue.removedPermissionCodes || previousCodes.filter((code) => !nextCodes.includes(code));

    const toName = (code) => permissionNameMap[code] || code;
    const parts = [
        addedCodes.length ? `Thêm: ${addedCodes.map(toName).join(', ')}` : '',
        removedCodes.length ? `Bỏ: ${removedCodes.map(toName).join(', ')}` : '',
        newValue.reason ? `Lý do: ${newValue.reason}` : ''
    ].filter(Boolean);

    return parts.join(' · ') || 'Cập nhật quyền';
};

function normalizeRoles(apiRoles) {
    if (!Array.isArray(apiRoles) || apiRoles.length === 0) {
        return fallbackRoles.map((role) => ({
            ...role,
            userCount: role.users,
            type: 'Vai trò hệ thống',
            active: true,
            updatedAt: '24/06/2026',
            updatedBy: 'Hệ thống',
            permissionCodes: fallbackRolePermissions[role.code] || [],
            source: 'fallback'
        }));
    }

    return apiRoles.map((role) => {
        const fallback = fallbackRoles.find((item) => item.code === role.code);
        const permissionCodes = role.permissionCodes || role.permissions?.map((permission) => permission.code) || [];
        return {
            ...role,
            icon: fallback?.icon || FiShield,
            name: role.name || role.code,
            description: role.description || fallback?.description || 'Vai trò trong hệ thống EduLMS.',
            userCount: resolveUserCount(role),
            type: role.isSystem === false ? 'Vai trò tùy chỉnh' : 'Vai trò hệ thống',
            active: true,
            updatedAt: formatDate(role.updatedAt),
            updatedBy: 'Backend',
            permissionCodes,
            source: 'backend'
        };
    });
}

function normalizePermissionGroups(payload) {
    const items = unwrapList(payload);
    if (!Array.isArray(items) || items.length === 0) return fallbackPermissionGroups;

    const grouped = items.reduce((result, permission) => {
        const moduleKey = permission.module || permission.code?.split('.')[0] || 'system';
        result[moduleKey] = result[moduleKey] || [];
        result[moduleKey].push(permission);
        return result;
    }, {});

    return Object.entries(grouped).map(([moduleKey, permissions]) => ({
        module: moduleLabels[moduleKey] || moduleKey,
        moduleKey,
        icon: moduleIcons[moduleKey] || FiKey,
        permissions: permissions.map((permission) => ({
            code: permission.code,
            name: permission.name || permission.code,
            description: permission.description,
            dependsOn: dependencyMap[permission.code],
            sensitive: sensitivePermissions.has(permission.code)
        }))
    }));
}

const workspaceLabels = {
    admin: 'Quản trị hệ thống',
    hr: 'HR',
    principal: 'Hiệu trưởng',
    training: 'Phòng đào tạo',
    department: 'Trưởng bộ môn',
    teacher: 'Giảng viên',
    student: 'Sinh viên'
};

export default function AdminPermissions({ workspaceKey = 'admin' }) {
    const currentUser = useAuthStore((state) => state.user);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [roles, setRoles] = useState(() => normalizeRoles([]));
    const [permissionCatalog, setPermissionCatalog] = useState(fallbackPermissionGroups);
    const [selectedRoleCode, setSelectedRoleCode] = useState('ADMIN');
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [savedPermissions, setSavedPermissions] = useState([]);
    const [keyword, setKeyword] = useState('');
    const [moduleFilter, setModuleFilter] = useState('ALL');
    const [checkedFilter, setCheckedFilter] = useState('ALL');
    const [expandedModules, setExpandedModules] = useState(() => fallbackPermissionGroups.map((group) => group.module));
    const [viewMode, setViewMode] = useState('role');
    const [showConfirmSave, setShowConfirmSave] = useState(false);
    const [showUsers, setShowUsers] = useState(false);
    const [roleModalMode, setRoleModalMode] = useState(null);
    const [roleForm, setRoleForm] = useState(emptyRoleForm);
    const [roleFormErrors, setRoleFormErrors] = useState({});
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [roleUsers, setRoleUsers] = useState([]);
    const [roleUsersLoading, setRoleUsersLoading] = useState(false);
    const [copySource, setCopySource] = useState('HR');
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState('');
    const [permissionChangeReason, setPermissionChangeReason] = useState('');
    const workspaceLabel = workspaceLabels[workspaceKey] || 'EduLMS';

    const selectedRole = roles.find((role) => role.code === selectedRoleCode) || roles[0];
    const allPermissionCodes = useMemo(
        () => permissionCatalog.flatMap((group) => group.permissions.map((permission) => permission.code)),
        [permissionCatalog]
    );
    const permissionNameMap = useMemo(
        () => permissionCatalog
            .flatMap((group) => group.permissions)
            .reduce((result, permission) => ({ ...result, [permission.code]: permission.name || permission.code }), {}),
        [permissionCatalog]
    );
    const roleNameMap = useMemo(
        () => roles.reduce((result, role) => ({ ...result, [role.code]: role.name || role.code }), {}),
        [roles]
    );
    const canManagePermissions = userHasBackendPermission(currentUser, 'system.permissions.manage');
    const canReadRoles = canManagePermissions;
    const canCreateRole = canManagePermissions;
    const canUpdateRole = canManagePermissions;
    const canDeleteRolePermission = canManagePermissions;
    const canViewUsers = userHasBackendPermission(currentUser, 'users.read');
    const canViewPermissionHistory = userHasBackendPermission(currentUser, 'system.audit.read');
    const activeViewMode = useMemo(() => {
        if (viewMode === 'history' && !canViewPermissionHistory) return 'role';
        if (viewMode === 'matrix' && !canReadRoles) return canViewPermissionHistory ? 'history' : 'role';
        return viewMode;
    }, [canReadRoles, canViewPermissionHistory, viewMode]);
    const auditRows = useMemo(
        () => auditLogs.map((log) => ({
            id: log.publicId || `${log.createdAt}-${log.targetPublicId}`,
            time: formatDateTime(log.createdAt),
            actor: getActorLabel(log),
            role: getRoleLabelFromLog(log, roleNameMap),
            change: getPermissionChangeText(log, permissionNameMap),
            result: 'Thành công',
            ipAddress: log.ipAddress
        })),
        [auditLogs, permissionNameMap, roleNameMap]
    );
    const hasChanges = useMemo(
        () => JSON.stringify([...selectedPermissions].sort()) !== JSON.stringify([...savedPermissions].sort()),
        [savedPermissions, selectedPermissions]
    );
    const addedCount = selectedPermissions.filter((permission) => !savedPermissions.includes(permission)).length;
    const removedCount = savedPermissions.filter((permission) => !selectedPermissions.includes(permission)).length;
    const isAdminRoleSelected = selectedRoleCode === 'ADMIN';

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [roleRes, permissionRes] = await Promise.allSettled([
                roleService.getRoles(),
                roleService.getPermissions()
            ]);

            const nextRoles = roleRes.status === 'fulfilled' ? normalizeRoles(unwrapList(roleRes.value)) : normalizeRoles([]);
            const nextCatalog = permissionRes.status === 'fulfilled' ? normalizePermissionGroups(permissionRes.value) : fallbackPermissionGroups;
            const nextRole = nextRoles.find((role) => role.code === selectedRoleCode) || nextRoles[0];
            const nextPermissions = nextRole?.permissionCodes || [];

            setRoles(nextRoles);
            setPermissionCatalog(nextCatalog);
            setExpandedModules(nextCatalog.map((group) => group.module));
            setSelectedRoleCode(nextRole?.code || 'ADMIN');
            setSelectedPermissions(nextPermissions);
            setSavedPermissions(nextPermissions);
        } finally {
            setLoading(false);
        }
    }, [selectedRoleCode]);

    const fetchAuditLogs = useCallback(async () => {
        setAuditLoading(true);
        setAuditError('');
        try {
            const results = await Promise.allSettled([
                auditLogService.getAuditLogs({ page: 1, limit: 30, module: 'roles', action: 'PERMISSION_CHANGE' }),
                auditLogService.getAuditLogs({ page: 1, limit: 30, module: 'permissions', action: 'PERMISSION_CHANGE' })
            ]);
            const fulfilledResults = results.filter((result) => result.status === 'fulfilled');
            if (fulfilledResults.length === 0) {
                throw new Error('Cannot load permission audit logs');
            }
            const logs = results
                .filter((result) => result.status === 'fulfilled')
                .flatMap((result) => unwrapItems(result.value))
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 30);

            setAuditLogs(logs);
        } catch {
            setAuditError('Không thể tải lịch sử thay đổi quyền');
            setAuditLogs([]);
        } finally {
            setAuditLoading(false);
        }
    }, []);

    const fetchRoleUsers = useCallback(async (roleCode) => {
        if (!roleCode) return;
        setRoleUsersLoading(true);
        const result = await userService.getUsers({ role: roleCode, page: 1, limit: 50 }).catch(() => null);
        setRoleUsers(unwrapItems(result));
        setRoleUsersLoading(false);
    }, []);

    useEffect(() => {
        void Promise.resolve().then(async () => {
            await fetchData();
            await fetchAuditLogs();
        });
    }, [fetchAuditLogs, fetchData]);

    const selectRole = (roleCode) => {
        const nextRole = roles.find((role) => role.code === roleCode);
        const nextPermissions = nextRole?.permissionCodes || [];
        setSelectedRoleCode(roleCode);
        setSelectedPermissions(nextPermissions);
        setSavedPermissions(nextPermissions);
    };

    const openCreateRole = () => {
        if (!canCreateRole) {
            toast.error('Bạn không có quyền tạo vai trò');
            return;
        }

        setRoleModalMode('create');
        setRoleForm(emptyRoleForm);
        setRoleFormErrors({});
    };

    const openEditRole = () => {
        if (!canUpdateRole) {
            toast.error('Bạn không có quyền sửa vai trò');
            return;
        }

        if (isAdminRoleSelected) {
            toast.error('Không được sửa vai trò Admin');
            return;
        }

        if (!selectedRole?.publicId) {
            toast.error('Vai trò này chưa có publicId từ backend');
            return;
        }

        setRoleModalMode('edit');
        setRoleForm({
            code: selectedRole.code || '',
            name: selectedRole.name || '',
            description: selectedRole.description || '',
            isSystem: Boolean(selectedRole.isSystem)
        });
        setRoleFormErrors({});
    };

    const openCopyRole = () => {
        if (!canCreateRole || !canManagePermissions) {
            toast.error('Bạn không có quyền sao chép vai trò');
            return;
        }

        if (isAdminRoleSelected) {
            toast.error('Không được sao chép vai trò Admin');
            return;
        }

        setRoleModalMode('copy');
        setRoleForm({
            code: '',
            name: selectedRole?.name ? `Bản sao ${selectedRole.name}` : '',
            description: selectedRole?.description || '',
            isSystem: false
        });
        setRoleFormErrors({});
    };

    const updateRoleForm = (field, value) => {
        setRoleForm((current) => ({ ...current, [field]: value }));
        setRoleFormErrors((current) => ({ ...current, [field]: '' }));
    };

    const validateRoleForm = () => {
        const nextErrors = {};
        const code = roleForm.code.trim().toUpperCase();

        if (!code) nextErrors.code = 'Vui lòng nhập mã vai trò';
        if (code && !/^[A-Z0-9_]{2,50}$/.test(code)) nextErrors.code = 'Mã vai trò chỉ dùng chữ in hoa, số và dấu gạch dưới';
        if (!roleForm.name.trim()) nextErrors.name = 'Vui lòng nhập tên vai trò';
        if (roleForm.name.trim().length > 255) nextErrors.name = 'Tên vai trò tối đa 255 ký tự';

        setRoleFormErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const submitRoleForm = async (event) => {
        event.preventDefault();
        if (!validateRoleForm()) return;

        const payload = {
            code: roleForm.code.trim().toUpperCase(),
            name: roleForm.name.trim(),
            description: roleForm.description.trim() || undefined,
            isSystem: roleModalMode === 'edit' ? roleForm.isSystem : false
        };

        setSubmitting(true);
        try {
            const role =
                roleModalMode === 'edit'
                    ? await roleService.updateRole(selectedRole.publicId, payload)
                    : await roleService.createRole(payload);

            if (roleModalMode === 'copy' && selectedRole?.permissionCodes?.length) {
                await roleService.updateRolePermissions(role.publicId, selectedRole.permissionCodes, `Sao chép quyền từ vai trò ${selectedRole.name || selectedRole.code}`);
            }

            toast.success(roleModalMode === 'edit' ? 'Đã cập nhật vai trò' : 'Đã tạo vai trò mới');
            setRoleModalMode(null);
            setRoleForm(emptyRoleForm);
            await fetchData();
            selectRole(role.code);
        } catch (error) {
            const message = error?.response?.data?.message || 'Không thể lưu vai trò';
            if (String(message).toLowerCase().includes('mã vai')) {
                setRoleFormErrors((current) => ({ ...current, code: message }));
            }
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const confirmDeleteRole = async () => {
        if (!deleteTarget?.publicId) return;

        setSubmitting(true);
        try {
            await roleService.deleteRole(deleteTarget.publicId);
            toast.success('Đã xóa vai trò');
            setDeleteTarget(null);
            const remainingRoles = roles.filter((role) => role.publicId !== deleteTarget.publicId);
            const nextRole = remainingRoles[0];
            await fetchData();
            if (nextRole) selectRole(nextRole.code);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Không thể xóa vai trò');
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        const warnBeforeLeave = (event) => {
            if (!hasChanges) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warnBeforeLeave);
        return () => window.removeEventListener('beforeunload', warnBeforeLeave);
    }, [hasChanges]);

    const applyDependencies = (codes) => {
        const next = new Set(codes);
        permissionCatalog.forEach((group) => {
            group.permissions.forEach((permission) => {
                if (next.has(permission.code)) {
                    permission.dependsOn?.forEach((dependency) => next.add(dependency));
                }
            });
        });
        return [...next].filter((code) => allPermissionCodes.includes(code));
    };

    const togglePermission = (permission) => {
        if (!canManagePermissions) {
            toast.error('Bạn không có quyền thay đổi phân quyền');
            return;
        }

        if (isAdminRoleSelected) {
            toast.error('Không được sửa quyền của Admin');
            return;
        }

        setSelectedPermissions((current) =>
            current.includes(permission.code)
                ? current.filter((code) => code !== permission.code)
                : applyDependencies([...current, permission.code])
        );
    };

    const toggleModule = (group) => {
        if (!canManagePermissions) {
            toast.error('Bạn không có quyền thay đổi phân quyền');
            return;
        }

        if (isAdminRoleSelected) {
            toast.error('Không được sửa quyền của Admin');
            return;
        }

        const codes = group.permissions.map((permission) => permission.code);
        const allSelected = codes.every((code) => selectedPermissions.includes(code));
        setSelectedPermissions((current) =>
            allSelected
                ? current.filter((code) => !codes.includes(code))
                : applyDependencies([...new Set([...current, ...codes])])
        );
    };

    const filteredGroups = permissionCatalog
        .filter((group) => moduleFilter === 'ALL' || group.module === moduleFilter)
        .map((group) => ({
            ...group,
            permissions: group.permissions.filter((permission) => {
                const searchMatch = `${permission.name} ${permission.code}`.toLowerCase().includes(keyword.toLowerCase());
                const checkedMatch =
                    checkedFilter === 'ALL' ||
                    (checkedFilter === 'CHECKED' && selectedPermissions.includes(permission.code)) ||
                    (checkedFilter === 'UNCHECKED' && !selectedPermissions.includes(permission.code));
                return searchMatch && checkedMatch;
            })
        }))
        .filter((group) => group.permissions.length > 0);

    const savePermissions = async () => {
        if (!canManagePermissions) {
            toast.error('Bạn không có quyền thay đổi phân quyền');
            setShowConfirmSave(false);
            return;
        }

        if (isAdminRoleSelected) {
            toast.error('Không được sửa quyền của Admin');
            setShowConfirmSave(false);
            return;
        }

        if (!selectedRole?.publicId) {
            toast.error('Vai trò này chưa có publicId từ backend, không thể lưu thật.');
            setShowConfirmSave(false);
            return;
        }

        const reason = permissionChangeReason.trim();
        if (!reason) {
            toast.error('Vui lòng nhập lý do thay đổi phân quyền');
            return;
        }

        const ok = await roleService.updateRolePermissions(selectedRole.publicId, selectedPermissions, reason)
            .then((updatedRole) => {
                const permissionCodes = updatedRole?.permissionCodes || selectedPermissions;
                setRoles((current) => current.map((role) => role.code === selectedRole.code ? { ...role, permissionCodes } : role));
                setSelectedPermissions(permissionCodes);
                setSavedPermissions(permissionCodes);
                return true;
            })
            .catch(() => false);

        toast[ok ? 'success' : 'error'](ok ? 'Đã lưu cấu hình phân quyền từ backend' : 'Không thể lưu cấu hình phân quyền');
        if (ok) fetchAuditLogs();
        setShowConfirmSave(false);
        if (ok) setPermissionChangeReason('');
    };

    const restoreDefaults = () => {
        setSelectedPermissions(savedPermissions);
        toast.success('Đã khôi phục về quyền đang lưu trên backend');
    };

    const copyPermissions = () => {
        if (!canManagePermissions) {
            toast.error('Bạn không có quyền thay đổi phân quyền');
            return;
        }

        if (isAdminRoleSelected) {
            toast.error('Không được sửa quyền của Admin');
            return;
        }

        const sourceRole = roles.find((role) => role.code === copySource);
        setSelectedPermissions(sourceRole?.permissionCodes || []);
        toast.success(`Đã sao chép quyền từ ${sourceRole?.name || copySource}`);
    };

    const previewAllowed = permissionCatalog.flatMap((group) => group.permissions).filter((permission) => selectedPermissions.includes(permission.code)).slice(0, 8);
    const previewDenied = permissionCatalog.flatMap((group) => group.permissions).filter((permission) => !selectedPermissions.includes(permission.code)).slice(0, 5);
    const canDeleteSelectedRole =
        canDeleteRolePermission &&
        selectedRole?.publicId &&
        !isAdminRoleSelected &&
        !selectedRole?.isSystem &&
        selectedRole?.source === 'backend' &&
        (!Number.isFinite(selectedRole?.userCount) || selectedRole.userCount === 0);

    return (
        <div className={cx('flow-shell')}>
            <AppSidebar workspaceKey={workspaceKey} />
            <main className={cx('flow-main', 'admin-permissions')}>
                <section className={cx('admin-permissions__hero')}>
                    <div>
                        <span>{workspaceLabel} / Quản lý phân quyền</span>
                        <h1>Quản lý vai trò và phân quyền</h1>
                        <p>Thiết lập quyền truy cập chức năng cho từng nhóm người dùng trong hệ thống.</p>
                    </div>
                    <div>
                        {canViewPermissionHistory && <button type="button" className={cx('admin-permissions__ghost')} onClick={() => setViewMode('history')}><FiClock /> Xem lịch sử thay đổi</button>}
                        {canCreateRole && <button type="button" className={cx('admin-permissions__primary')} onClick={openCreateRole}><FiKey /> Thêm vai trò mới</button>}
                    </div>
                </section>

                <section className={cx('admin-permissions__summary')}>
                    <article><FiShield /><strong>{roles.length}</strong><span>Vai trò từ backend</span></article>
                    <article><FiKey /><strong>{allPermissionCodes.length}</strong><span>Quyền từ backend</span></article>
                    <article><FiUsers /><strong>{Number.isFinite(selectedRole?.userCount) ? selectedRole.userCount : '—'}</strong><span>Người dùng bị ảnh hưởng</span></article>
                    <article><FiAlertTriangle /><strong>{hasChanges ? 'Có' : 'Không'}</strong><span>Thay đổi chưa lưu</span></article>
                </section>

                <section className={cx('admin-permissions__workspace')}>
                    <aside className={cx('admin-permissions__roles')}>
                        <div className={cx('admin-permissions__section-title')}>
                            <h2>Danh sách vai trò</h2>
                            <button type="button" onClick={fetchData} disabled={loading}><FiRefreshCw /></button>
                        </div>
                        {roles.map((role) => {
                            const Icon = role.icon || FiShield;
                            return (
                                <button key={role.code} type="button" className={cx({ 'is-selected': selectedRoleCode === role.code })} onClick={() => selectRole(role.code)}>
                                    <Icon />
                                    <span>
                                        <strong>{role.name}</strong>
                                        <small>{formatUserCount(role.userCount)} · {role.type}</small>
                                    </span>
                                    <i>{role.active ? 'Hoạt động' : 'Tắt'}</i>
                                </button>
                            );
                        })}
                    </aside>

                    <section className={cx('admin-permissions__editor')}>
                        <div className={cx('admin-permissions__tabs')}>
                            <button type="button" className={cx({ 'is-active': activeViewMode === 'role' })} onClick={() => setViewMode('role')}>Theo vai trò</button>
                            {canReadRoles && <button type="button" className={cx({ 'is-active': activeViewMode === 'matrix' })} onClick={() => setViewMode('matrix')}>Ma trận phân quyền</button>}
                            {canViewPermissionHistory && <button type="button" className={cx({ 'is-active': activeViewMode === 'history' })} onClick={() => setViewMode('history')}>Lịch sử</button>}
                        </div>

                        {activeViewMode === 'role' && (
                            <>
                                <section className={cx('admin-permissions__role-card')}>
                                    <div>
                                        <span>Đang chỉnh sửa quyền cho</span>
                                        <h2>{selectedRole?.name}</h2>
                                    </div>
                                    <div className={cx('admin-permissions__role-actions')}>
                                        {canUpdateRole && <button type="button" onClick={openEditRole} disabled={!selectedRole?.publicId || isAdminRoleSelected}><FiEdit3 /> Sửa thông tin</button>}
                                        {canCreateRole && canManagePermissions && <button type="button" onClick={openCopyRole} disabled={!selectedRole || isAdminRoleSelected}><FiCopy /> Sao chép role</button>}
                                        {canDeleteRolePermission && <button type="button" disabled={!canDeleteSelectedRole} onClick={() => setDeleteTarget(selectedRole)}><FiTrash2 /> Xóa role</button>}
                                        {canViewUsers && <button type="button" onClick={() => { setShowUsers(true); fetchRoleUsers(selectedRole?.code); }}><FiUsers /> Xem người dùng</button>}
                                    </div>
                                    <div className={cx('admin-permissions__role-meta')}>
                                        <p>{selectedRole?.description}</p>
                                        <dl>
                                            <div><dt>Mã vai trò</dt><dd>{selectedRole?.code}</dd></div>
                                            <div><dt>Người dùng</dt><dd>{formatUserCount(selectedRole?.userCount)}</dd></div>
                                            <div><dt>Cập nhật</dt><dd>{selectedRole?.updatedAt}</dd></div>
                                            <div><dt>Nguồn dữ liệu</dt><dd>{selectedRole?.source === 'backend' ? 'Backend' : 'Fallback'}</dd></div>
                                        </dl>
                                    </div>
                                </section>

                                <section className={cx('admin-permissions__filters')}>
                                    <label><FiSearch /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm quyền, ví dụ: Tạo lớp" /></label>
                                    <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
                                        <option value="ALL">Tất cả module</option>
                                        {permissionCatalog.map((group) => <option key={group.module} value={group.module}>{group.module}</option>)}
                                    </select>
                                    <select value={checkedFilter} onChange={(event) => setCheckedFilter(event.target.value)}>
                                        <option value="ALL">Tất cả quyền</option>
                                        <option value="CHECKED">Đã chọn</option>
                                        <option value="UNCHECKED">Chưa chọn</option>
                                    </select>
                                    <button type="button" onClick={() => setExpandedModules(permissionCatalog.map((group) => group.module))}>Mở rộng tất cả</button>
                                    <button type="button" onClick={() => setExpandedModules([])}>Thu gọn tất cả</button>
                                    {isAdminRoleSelected && <span className={cx('admin-permissions__readonly-note')}>Admin là vai trò gốc, chỉ được xem quyền.</span>}
                                    {!canManagePermissions && <span className={cx('admin-permissions__readonly-note')}>Bạn chỉ có quyền xem, không thể thay đổi phân quyền.</span>}
                                </section>

                                {canManagePermissions && (
                                    <section className={cx('admin-permissions__copy')}>
                                        <span>Sao chép quyền từ</span>
                                        <select value={copySource} onChange={(event) => setCopySource(event.target.value)}>
                                            {roles.filter((role) => role.code !== selectedRoleCode).map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}
                                        </select>
                                        <button type="button" onClick={copyPermissions} disabled={isAdminRoleSelected}><FiCopy /> Áp dụng cho {selectedRole?.name}</button>
                                    </section>
                                )}

                                <section className={cx('admin-permissions__accordion')}>
                                    {filteredGroups.map((group) => {
                                        const expanded = expandedModules.includes(group.module);
                                        const selectedCount = group.permissions.filter((permission) => selectedPermissions.includes(permission.code)).length;
                                        const Icon = group.icon;

                                        return (
                                            <article key={group.module}>
                                                <header>
                                                    <button type="button" onClick={() => setExpandedModules((current) => expanded ? current.filter((item) => item !== group.module) : [...current, group.module])}>
                                                        <FiChevronDown className={cx({ 'is-open': expanded })} />
                                                        <Icon />
                                                        <strong>{group.module}</strong>
                                                        <span>Đã chọn {selectedCount}/{group.permissions.length} quyền</span>
                                                    </button>
                                                    <label>
                                                        <input type="checkbox" checked={selectedCount === group.permissions.length} disabled={isAdminRoleSelected || !canManagePermissions} onChange={() => toggleModule(group)} />
                                                        Chọn tất cả
                                                    </label>
                                                </header>
                                                {expanded && (
                                                    <div>
                                                        {group.permissions.map((permission) => (
                                                            <label key={permission.code} className={cx({ 'is-sensitive': permission.sensitive })}>
                                                                <input type="checkbox" checked={selectedPermissions.includes(permission.code)} disabled={isAdminRoleSelected || !canManagePermissions} onChange={() => togglePermission(permission)} />
                                                                <span>
                                                                    <strong>{permission.name}</strong>
                                                                    <small>{permission.code}{permission.dependsOn ? ` · phụ thuộc: ${permission.dependsOn.join(', ')}` : ''}</small>
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}
                                </section>

                                <section className={cx('admin-permissions__preview')}>
                                    <article><h3><FiCheck /> Có thể truy cập</h3>{previewAllowed.map((permission) => <span key={permission.code}>✓ {permission.name}</span>)}</article>
                                    <article><h3><FiX /> Không thể truy cập</h3>{previewDenied.map((permission) => <span key={permission.code}>× {permission.name}</span>)}</article>
                                </section>
                            </>
                        )}

                        {activeViewMode === 'matrix' && (
                            <section className={cx('admin-permissions__matrix')}>
                                <table>
                                    <thead><tr><th>Quyền</th>{roles.map((role) => <th key={role.code}>{role.name}</th>)}</tr></thead>
                                    <tbody>
                                        {permissionCatalog.flatMap((group) => group.permissions).slice(0, 20).map((permission) => (
                                            <tr key={permission.code}>
                                                <td>{permission.name}</td>
                                                {roles.map((role) => <td key={`${permission.code}-${role.code}`}>{role.permissionCodes?.includes(permission.code) ? '✓' : ''}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </section>
                        )}

                        {activeViewMode === 'history' && (
                            <section className={cx('admin-permissions__history')}>
                                <div className={cx('admin-permissions__section-title')}>
                                    <h2>Lịch sử thay đổi quyền</h2>
                                    <button type="button" onClick={fetchAuditLogs} disabled={auditLoading}><FiRefreshCw /><span>Làm mới</span></button>
                                </div>
                                {auditLoading && <p>Đang tải lịch sử thay đổi quyền...</p>}
                                {auditError && <p>{auditError}</p>}
                                {!auditLoading && !auditError && auditRows.length === 0 && <p>Chưa có Audit Log thay đổi quyền từ backend.</p>}
                                {auditRows.length > 0 && (
                                    <table>
                                        <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Vai trò</th><th>Thay đổi</th><th>Kết quả</th></tr></thead>
                                        <tbody>
                                            {auditRows.map((item) => (
                                                <tr key={item.id}>
                                                    <td>{item.time}</td>
                                                    <td>{item.actor}{item.ipAddress ? <small>{item.ipAddress}</small> : null}</td>
                                                    <td>{item.role}</td>
                                                    <td>{item.change}</td>
                                                    <td>{item.result}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </section>
                        )}
                    </section>
                </section>

                <section className={cx('admin-permissions__savebar', { 'is-visible': hasChanges && !isAdminRoleSelected && canManagePermissions })}>
                    <span>Bạn có thay đổi chưa được lưu.</span>
                    <button type="button" onClick={() => setSelectedPermissions(savedPermissions)}>Hủy thay đổi</button>
                    <button type="button" onClick={restoreDefaults}><FiRotateCcw /> Khôi phục từ backend</button>
                    <button type="button" onClick={() => { setPermissionChangeReason(''); setShowConfirmSave(true); }}><FiSave /> Lưu cấu hình</button>
                </section>

                {showConfirmSave && (
                    <div className={cx('admin-permissions__modal-backdrop')}>
                        <section className={cx('admin-permissions__modal')}>
                            <FiShield />
                            <h2>Xác nhận thay đổi phân quyền</h2>
                            <p>Bạn đang cập nhật quyền cho vai trò “{selectedRole?.name}”. Thay đổi này sẽ ảnh hưởng đến {formatUserCount(selectedRole?.userCount)}.</p>
                            <ul><li>Quyền được thêm: {addedCount}</li><li>Quyền bị loại bỏ: {removedCount}</li><li>Quyền nhạy cảm sẽ được kiểm tra lại ở backend.</li></ul>
                            <div className={cx('admin-permissions__role-form')}>
                                <label>
                                    <span>Lý do thay đổi</span>
                                    <textarea
                                        value={permissionChangeReason}
                                        onChange={(event) => setPermissionChangeReason(event.target.value)}
                                        placeholder="Ví dụ: Cấp quyền tạo lớp cho Phòng đào tạo theo phân công mới"
                                    />
                                    {!permissionChangeReason.trim() && <small>Bắt buộc nhập lý do để ghi Audit Log.</small>}
                                </label>
                            </div>
                            <footer><button type="button" onClick={() => setShowConfirmSave(false)}>Hủy</button><button type="button" onClick={savePermissions}>Xác nhận lưu</button></footer>
                        </section>
                    </div>
                )}

                {roleModalMode && (
                    <div className={cx('admin-permissions__modal-backdrop')}>
                        <form className={cx('admin-permissions__modal', 'admin-permissions__role-form')} onSubmit={submitRoleForm}>
                            <FiShield />
                            <h2>
                                {roleModalMode === 'edit'
                                    ? 'Sửa thông tin vai trò'
                                    : roleModalMode === 'copy'
                                        ? 'Sao chép vai trò'
                                        : 'Thêm vai trò mới'}
                            </h2>
                            <p>
                                {roleModalMode === 'copy'
                                    ? `Vai trò mới sẽ sao chép bộ quyền hiện tại của ${selectedRole?.name}.`
                                    : 'Thiết lập mã, tên và mô tả vai trò theo đúng phạm vi phân quyền của EduLMS.'}
                            </p>
                            <label>
                                <span>Mã vai trò</span>
                                <input
                                    value={roleForm.code}
                                    disabled={roleModalMode === 'edit' && selectedRole?.isSystem}
                                    onChange={(event) => updateRoleForm('code', event.target.value.toUpperCase())}
                                    placeholder="VD: TRAINING_ASSISTANT"
                                />
                                {roleFormErrors.code && <small>{roleFormErrors.code}</small>}
                            </label>
                            <label>
                                <span>Tên vai trò</span>
                                <input value={roleForm.name} onChange={(event) => updateRoleForm('name', event.target.value)} placeholder="VD: Trợ lý đào tạo" />
                                {roleFormErrors.name && <small>{roleFormErrors.name}</small>}
                            </label>
                            <label>
                                <span>Mô tả</span>
                                <textarea value={roleForm.description} onChange={(event) => updateRoleForm('description', event.target.value)} rows={4} placeholder="Mô tả phạm vi nghiệp vụ của vai trò" />
                            </label>
                            <label className={cx('admin-permissions__check')}>
                                <input
                                    type="checkbox"
                                    checked={roleForm.isSystem}
                                    disabled={roleModalMode !== 'edit' || selectedRole?.isSystem}
                                    onChange={(event) => updateRoleForm('isSystem', event.target.checked)}
                                />
                                Vai trò hệ thống
                            </label>
                            <footer>
                                <button type="button" onClick={() => setRoleModalMode(null)} disabled={submitting}>Hủy</button>
                                <button type="submit" disabled={submitting}>{submitting ? 'Đang lưu...' : 'Lưu vai trò'}</button>
                            </footer>
                        </form>
                    </div>
                )}

                {deleteTarget && (
                    <div className={cx('admin-permissions__modal-backdrop')}>
                        <section className={cx('admin-permissions__modal')}>
                            <FiAlertTriangle />
                            <h2>Xóa vai trò</h2>
                            <p>Bạn đang xóa vai trò “{deleteTarget.name}”. Backend sẽ từ chối nếu vai trò là hệ thống hoặc đang có người dùng.</p>
                            <footer>
                                <button type="button" onClick={() => setDeleteTarget(null)} disabled={submitting}>Hủy</button>
                                <button type="button" className={cx('is-danger')} onClick={confirmDeleteRole} disabled={submitting}>
                                    {submitting ? 'Đang xóa...' : 'Xác nhận xóa'}
                                </button>
                            </footer>
                        </section>
                    </div>
                )}

                {showUsers && (
                    <div className={cx('admin-permissions__modal-backdrop')}>
                        <section className={cx('admin-permissions__users-modal')}>
                            <header><div><h2>Người dùng thuộc vai trò {selectedRole?.name}</h2><p>Danh sách lấy từ API người dùng theo mã vai trò.</p></div><button type="button" onClick={() => setShowUsers(false)}><FiX /></button></header>
                            <table>
                                <thead><tr><th>Họ tên</th><th>Email</th><th>Trạng thái</th><th>Ngày gán</th><th>Người gán</th><th></th></tr></thead>
                                <tbody>
                                    {roleUsersLoading && <tr><td colSpan="6">Đang tải người dùng...</td></tr>}
                                    {!roleUsersLoading && roleUsers.length === 0 && <tr><td colSpan="6">Chưa có người dùng thuộc vai trò này.</td></tr>}
                                    {!roleUsersLoading && roleUsers.map((user) => (
                                        <tr key={user.publicId || user.email}>
                                            <td>{user.fullName || user.name}</td>
                                            <td>{user.email}</td>
                                            <td>{user.status}</td>
                                            <td>{formatDate(user.createdAt)}</td>
                                            <td>{user.createdBy?.fullName || user.createdByName || '-'}</td>
                                            <td><button type="button" disabled>Gỡ vai trò</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
}
