import { useEffect, useMemo, useState } from 'react';
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
    FiEye,
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
    curriculum: 'Chương trình học',
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
    curriculum: FiBookOpen,
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
    TRAINING_OFFICER: ['curriculum.read', 'courses.read', 'courses.update', 'classes.read', 'classes.create', 'classes.registration.toggle', 'grades.read'],
    DEPARTMENT_HEAD: ['courses.read', 'course_proposals.create', 'classes.read', 'classes.assign_lecturer'],
    LECTURER: ['classes.read', 'lessons.read', 'lessons.create', 'exams.read', 'exams.grade', 'grades.read'],
    STUDENT: ['classes.read', 'lessons.read', 'exams.read', 'grades.read']
};

const auditHistory = [
    { time: '24/06/2026 10:30', actor: 'Admin Phát', role: 'Phòng đào tạo', change: 'Thêm quyền tạo lớp', result: 'Thành công' },
    { time: '23/06/2026 15:20', actor: 'Admin Phát', role: 'Giảng viên', change: 'Bỏ quyền xuất điểm', result: 'Thành công' }
];

const affectedUsers = [
    { name: 'Nguyễn Văn An', email: 'an@lms.edu.vn', status: 'Hoạt động', assignedAt: '20/06/2026', assignedBy: 'Admin Phát' },
    { name: 'Trần Thị Bình', email: 'binh@lms.edu.vn', status: 'Hoạt động', assignedAt: '21/06/2026', assignedBy: 'Admin Phát' }
];

const unwrapList = (payload) => payload?.items || payload?.data?.items || payload?.data || payload || [];
const unwrapItems = (payload) => payload?.items || payload?.data?.items || [];

const formatDate = (value) => {
    if (!value) return 'Chưa cập nhật';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const resolveUserCount = (role) => {
    if (Number.isFinite(role?.userCount)) return role.userCount;
    if (Number.isFinite(role?.usersCount)) return role.usersCount;
    if (Number.isFinite(role?._count?.users)) return role._count.users;
    if (Array.isArray(role?.users)) return role.users.length;
    return null;
};

const formatUserCount = (count) => (Number.isFinite(count) ? `${count} người dùng` : 'Chưa có số liệu');

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

export default function AdminPermissions() {
    const [loading, setLoading] = useState(false);
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
    const [copySource, setCopySource] = useState('HR');
    const [auditLogs, setAuditLogs] = useState([]);

    const selectedRole = roles.find((role) => role.code === selectedRoleCode) || roles[0];
    const allPermissionCodes = useMemo(
        () => permissionCatalog.flatMap((group) => group.permissions.map((permission) => permission.code)),
        [permissionCatalog]
    );
    const hasChanges = useMemo(
        () => JSON.stringify([...selectedPermissions].sort()) !== JSON.stringify([...savedPermissions].sort()),
        [savedPermissions, selectedPermissions]
    );
    const addedCount = selectedPermissions.filter((permission) => !savedPermissions.includes(permission)).length;
    const removedCount = savedPermissions.filter((permission) => !selectedPermissions.includes(permission)).length;

    const fetchData = async () => {
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
    };

    const fetchAuditLogs = async () => {
        const result = await auditLogService.getAuditLogs({ page: 1, limit: 20, module: 'roles' }).catch(() => null);
        setAuditLogs(unwrapItems(result));
    };

    useEffect(() => {
        fetchData();
        fetchAuditLogs();
    }, []);

    useEffect(() => {
        if (!selectedRole) return;
        const nextPermissions = selectedRole.permissionCodes || [];
        setSelectedPermissions(nextPermissions);
        setSavedPermissions(nextPermissions);
    }, [selectedRoleCode]);

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
        setSelectedPermissions((current) =>
            current.includes(permission.code)
                ? current.filter((code) => code !== permission.code)
                : applyDependencies([...current, permission.code])
        );
    };

    const toggleModule = (group) => {
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
        if (!selectedRole?.publicId) {
            toast.error('Vai trò này chưa có publicId từ backend, không thể lưu thật.');
            setShowConfirmSave(false);
            return;
        }

        const ok = await roleService.updateRolePermissions(selectedRole.publicId, selectedPermissions)
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
    };

    const restoreDefaults = () => {
        setSelectedPermissions(savedPermissions);
        toast.success('Đã khôi phục về quyền đang lưu trên backend');
    };

    const copyPermissions = () => {
        const sourceRole = roles.find((role) => role.code === copySource);
        setSelectedPermissions(sourceRole?.permissionCodes || []);
        toast.success(`Đã sao chép quyền từ ${sourceRole?.name || copySource}`);
    };

    const previewAllowed = permissionCatalog.flatMap((group) => group.permissions).filter((permission) => selectedPermissions.includes(permission.code)).slice(0, 8);
    const previewDenied = permissionCatalog.flatMap((group) => group.permissions).filter((permission) => !selectedPermissions.includes(permission.code)).slice(0, 5);

    return (
        <div className={cx('flow-shell')}>
            <AppSidebar workspaceKey="admin" />
            <main className={cx('flow-main', 'admin-permissions')}>
                <section className={cx('admin-permissions__hero')}>
                    <div>
                        <span>Quản trị hệ thống / Quản lý phân quyền</span>
                        <h1>Quản lý vai trò và phân quyền</h1>
                        <p>Thiết lập quyền truy cập chức năng cho từng nhóm người dùng trong hệ thống.</p>
                    </div>
                    <div>
                        <button type="button" className={cx('admin-permissions__ghost')}><FiClock /> Xem lịch sử thay đổi</button>
                        <button type="button" className={cx('admin-permissions__primary')} disabled><FiKey /> Thêm vai trò mới</button>
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
                                <button key={role.code} type="button" className={cx({ 'is-selected': selectedRoleCode === role.code })} onClick={() => setSelectedRoleCode(role.code)}>
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
                            <button type="button" className={cx({ 'is-active': viewMode === 'role' })} onClick={() => setViewMode('role')}>Theo vai trò</button>
                            <button type="button" className={cx({ 'is-active': viewMode === 'matrix' })} onClick={() => setViewMode('matrix')}>Ma trận phân quyền</button>
                            <button type="button" className={cx({ 'is-active': viewMode === 'history' })} onClick={() => setViewMode('history')}>Lịch sử</button>
                        </div>

                        {viewMode === 'role' && (
                            <>
                                <section className={cx('admin-permissions__role-card')}>
                                    <div>
                                        <span>Đang chỉnh sửa quyền cho</span>
                                        <h2>{selectedRole?.name}</h2>
                                        <p>{selectedRole?.description}</p>
                                        <dl>
                                            <div><dt>Mã vai trò</dt><dd>{selectedRole?.code}</dd></div>
                                            <div><dt>Người dùng</dt><dd>{formatUserCount(selectedRole?.userCount)}</dd></div>
                                            <div><dt>Cập nhật</dt><dd>{selectedRole?.updatedAt}</dd></div>
                                            <div><dt>Nguồn dữ liệu</dt><dd>{selectedRole?.source === 'backend' ? 'Backend' : 'Fallback'}</dd></div>
                                        </dl>
                                    </div>
                                    <div className={cx('admin-permissions__role-actions')}>
                                        <button type="button"><FiEdit3 /> Sửa thông tin</button>
                                        <button type="button"><FiCopy /> Sao chép role</button>
                                        <button type="button" disabled={selectedRole?.type === 'Vai trò hệ thống'}><FiTrash2 /> Xóa role</button>
                                        <button type="button" onClick={() => setShowUsers(true)}><FiUsers /> Xem người dùng</button>
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
                                </section>

                                <section className={cx('admin-permissions__copy')}>
                                    <span>Sao chép quyền từ</span>
                                    <select value={copySource} onChange={(event) => setCopySource(event.target.value)}>
                                        {roles.filter((role) => role.code !== selectedRoleCode).map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}
                                    </select>
                                    <button type="button" onClick={copyPermissions}><FiCopy /> Áp dụng cho {selectedRole?.name}</button>
                                </section>

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
                                                        <input type="checkbox" checked={selectedCount === group.permissions.length} onChange={() => toggleModule(group)} />
                                                        Chọn tất cả
                                                    </label>
                                                </header>
                                                {expanded && (
                                                    <div>
                                                        {group.permissions.map((permission) => (
                                                            <label key={permission.code} className={cx({ 'is-sensitive': permission.sensitive })}>
                                                                <input type="checkbox" checked={selectedPermissions.includes(permission.code)} onChange={() => togglePermission(permission)} />
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

                        {viewMode === 'matrix' && (
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

                        {viewMode === 'history' && (
                            <section className={cx('admin-permissions__history')}>
                                <table>
                                    <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Vai trò</th><th>Thay đổi</th><th>Kết quả</th></tr></thead>
                                    <tbody>{(auditLogs.length > 0 ? auditLogs : auditHistory).map((item) => <tr key={item.publicId || `${item.time}-${item.change}`}><td>{formatDate(item.createdAt || item.time)}</td><td>{item.actor?.fullName || item.actor || 'Hệ thống'}</td><td>{item.module || item.role || 'roles'}</td><td>{item.action ? `${item.action} ${item.targetType || ''}` : item.change}</td><td>{item.result || 'Thành công'}</td></tr>)}</tbody>
                                </table>
                            </section>
                        )}
                    </section>
                </section>

                <section className={cx('admin-permissions__savebar', { 'is-visible': hasChanges })}>
                    <span>Bạn có thay đổi chưa được lưu.</span>
                    <button type="button" onClick={() => setSelectedPermissions(savedPermissions)}>Hủy thay đổi</button>
                    <button type="button" onClick={restoreDefaults}><FiRotateCcw /> Khôi phục từ backend</button>
                    <button type="button" onClick={() => setShowConfirmSave(true)}><FiSave /> Lưu cấu hình</button>
                </section>

                {showConfirmSave && (
                    <div className={cx('admin-permissions__modal-backdrop')}>
                        <section className={cx('admin-permissions__modal')}>
                            <FiShield />
                            <h2>Xác nhận thay đổi phân quyền</h2>
                            <p>Bạn đang cập nhật quyền cho vai trò “{selectedRole?.name}”. Thay đổi này sẽ ảnh hưởng đến {formatUserCount(selectedRole?.userCount)}.</p>
                            <ul><li>Quyền được thêm: {addedCount}</li><li>Quyền bị loại bỏ: {removedCount}</li><li>Quyền nhạy cảm sẽ được kiểm tra lại ở backend.</li></ul>
                            <footer><button type="button" onClick={() => setShowConfirmSave(false)}>Hủy</button><button type="button" onClick={savePermissions}>Xác nhận lưu</button></footer>
                        </section>
                    </div>
                )}

                {showUsers && (
                    <div className={cx('admin-permissions__modal-backdrop')}>
                        <section className={cx('admin-permissions__users-modal')}>
                            <header><div><h2>Người dùng thuộc vai trò {selectedRole?.name}</h2><p>Backend hiện chưa trả danh sách user theo role, đang hiển thị mẫu ảnh hưởng.</p></div><button type="button" onClick={() => setShowUsers(false)}><FiX /></button></header>
                            <table>
                                <thead><tr><th>Họ tên</th><th>Email</th><th>Trạng thái</th><th>Ngày gán</th><th>Người gán</th><th></th></tr></thead>
                                <tbody>{affectedUsers.map((user) => <tr key={user.email}><td>{user.name}</td><td>{user.email}</td><td>{user.status}</td><td>{user.assignedAt}</td><td>{user.assignedBy}</td><td><button type="button">Gỡ vai trò</button></td></tr>)}</tbody>
                            </table>
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
}
