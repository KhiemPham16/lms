import { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { useSearchParams } from 'react-router-dom';
import {
    FiAlertCircle,
    FiArchive,
    FiCalendar,
    FiChevronLeft,
    FiChevronRight,
    FiClock,
    FiDownload,
    FiEdit3,
    FiEye,
    FiFilter,
    FiKey,
    FiLock,
    FiMail,
    FiMoreVertical,
    FiRefreshCw,
    FiRotateCcw,
    FiSearch,
    FiShield,
    FiSliders,
    FiUnlock,
    FiUserCheck,
    FiUserPlus,
    FiUsers,
    FiX
} from 'react-icons/fi';
import { toast } from 'sonner';

import AppSidebar from '~/components/AppSidebar';
import { departmentService } from '~/services/departmentService';
import { roleService } from '~/services/roleService';
import { userService } from '~/services/userService';
import { useAuthStore } from '~/stores/useAuthStore';
import { useUserManagementStore } from '~/stores/useUserManagementStore';
import { roleHasPermission } from '~/utils/permissions';
import { useDashboardPermissions } from '~/hooks/useDashboardPermissions';
import layoutStyles from '~/pages/FlowWorkbench/FlowWorkbench.module.scss';
import userStyles from './Users.module.scss';

const styles = { ...layoutStyles, ...userStyles };
const cx = classNames.bind(styles);

const roleLabels = {
    ADMIN: 'Admin',
    HR: 'HR',
    PRINCIPAL: 'Hiệu trưởng',
    TRAINING_OFFICER: 'Phòng đào tạo',
    DEPARTMENT_HEAD: 'Trưởng bộ môn',
    LECTURER: 'Giảng viên',
    STUDENT: 'Sinh viên'
};

const statusLabels = {
    ACTIVE: 'Đang hoạt động',
    PENDING: 'Chờ kích hoạt',
    LOCKED: 'Bị khóa',
    INACTIVE: 'Ngừng hoạt động'
};

const genderLabels = {
    MALE: 'Nam',
    FEMALE: 'Nữ',
    OTHER: 'Khác'
};

const fallbackDepartmentMap = {
    1: 'Khoa Cong Nghe Thong Tin',
    2: 'Phong Dao Tao',
    3: 'Ban Giam Hieu',
    4: 'Phong Nhan Su'
};

const fallbackDepartmentCodeIds = {
    CNTT: 1,
    PDT: 2,
    BGH: 3,
    HR: 4
};

const allowedCreateRoles = {
    ADMIN: ['HR', 'PRINCIPAL'],
    HR: ['TRAINING_OFFICER', 'DEPARTMENT_HEAD', 'LECTURER', 'STUDENT']
};

const emptyCreateForm = {
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: '',
    status: 'ACTIVE',
    gender: '',
    dateOfBirth: '',
    address: '',
    departmentId: '',
    cohortYear: new Date().getFullYear()
};

const emptyEditForm = {
    fullName: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    address: '',
    departmentId: '',
    status: 'ACTIVE'
};

const getUserRole = (user) => user?.role?.code || user?.role || user?.roleDetail?.code || '';
const getUserRoleName = (user) => user?.role?.name || roleLabels[getUserRole(user)] || getUserRole(user) || 'Chưa gán';
const getUserId = (user) => user?.publicId || user?.id || user?.email;
const normalizeDepartmentId = (value) => (value === null || value === undefined || value === '' ? '' : String(value));
const getDepartmentOptionValue = (department) => normalizeDepartmentId(department.id || department.departmentId || fallbackDepartmentCodeIds[department.code]);
const getInitials = (name = '') => name.split(' ').filter(Boolean).slice(-2).map((item) => item[0]).join('').toUpperCase() || 'U';
const formatDate = (value, fallback = '-') => {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};
const formatDateTime = (value) => {
    if (!value) return 'Chưa đăng nhập';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};
const normalizeItems = (payload) => payload?.items || payload?.data?.items || payload?.data || payload || [];

const debounceMs = 400;

function SummaryValue({ value }) {
    return <strong>{Number.isFinite(value) ? value.toLocaleString('vi-VN') : '0'}</strong>;
}

function Field({ label, error, children, hint }) {
    return (
        <label className={cx('admin-users__field')}>
            <span>{label}</span>
            {children}
            {hint ? <small>{hint}</small> : null}
            {error ? <em>{error}</em> : null}
        </label>
    );
}

function ConfirmDialog({ title, message, danger, confirmLabel = 'Xác nhận', loading, onCancel, onConfirm, children }) {
    return (
        <div className={cx('admin-users__backdrop')}>
            <section className={cx('admin-users__confirm')}>
                <div className={cx('admin-users__confirm-icon', { 'is-danger': danger })}>
                    {danger ? <FiAlertCircle /> : <FiShield />}
                </div>
                <h2>{title}</h2>
                <p>{message}</p>
                {children}
                <footer>
                    <button type="button" onClick={onCancel} disabled={loading}>Hủy</button>
                    <button type="button" className={cx({ 'is-danger': danger })} onClick={onConfirm} disabled={loading}>
                        {loading ? 'Đang xử lý...' : confirmLabel}
                    </button>
                </footer>
            </section>
        </div>
    );
}

export default function AdminUsers({ workspaceKey = 'admin' }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const permissions = useDashboardPermissions();
    const currentUser = useAuthStore((state) => state.user);
    const currentRole = getUserRole(currentUser) || workspaceKey.toUpperCase();
    const allowedRoles = allowedCreateRoles[currentRole] || [];

    const {
        users,
        summary,
        filters,
        search,
        pagination,
        selectedUserIds,
        loading,
        detailLoading,
        submitting,
        error,
        currentUserDetail,
        userActivities,
        userLoginHistory,
        fetchUsers,
        fetchSummary,
        setSearch,
        setFilters,
        resetFilters,
        setPage,
        setLimit,
        selectUser,
        selectAllUsers,
        clearSelection,
        createUser,
        updateUser,
        updateUserStatus,
        lockUser,
        unlockUser,
        deactivateUser,
        activateUser,
        resetPassword,
        changeUserRole,
        fetchUserDetail,
        refreshData
    } = useUserManagementStore();

    const [searchInput, setSearchInput] = useState(() => searchParams.get('keyword') || '');
    const [draftFilters, setDraftFilters] = useState(() => ({
        role: searchParams.get('role') || '',
        status: searchParams.get('status') || '',
        departmentId: searchParams.get('departmentId') || '',
        createdBy: searchParams.get('createdBy') || '',
        createdFrom: searchParams.get('createdFrom') || '',
        createdTo: searchParams.get('createdTo') || '',
        emailVerified: searchParams.get('emailVerified') || '',
        roleAssigned: searchParams.get('roleAssigned') || ''
    }));
    const [roles, setRoles] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [lockTarget, setLockTarget] = useState(null);
    const [unlockTarget, setUnlockTarget] = useState(null);
    const [deactivateTarget, setDeactivateTarget] = useState(null);
    const [activateTarget, setActivateTarget] = useState(null);
    const [resetTarget, setResetTarget] = useState(null);
    const [roleTarget, setRoleTarget] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [createForm, setCreateForm] = useState(emptyCreateForm);
    const [editForm, setEditForm] = useState(emptyEditForm);
    const [formErrors, setFormErrors] = useState({});
    const [lockForm, setLockForm] = useState({ reason: '', expiresAt: '', revokeSessions: true, sendEmail: true });
    const [deactivateForm, setDeactivateForm] = useState({ reason: '', revokeSessions: true, sendEmail: true });
    const [unlockReason, setUnlockReason] = useState('');
    const [resetForm, setResetForm] = useState({ mode: 'link', forceChange: true, revokeSessions: true });
    const [temporaryPassword, setTemporaryPassword] = useState('');
    const [changeRoleCode, setChangeRoleCode] = useState('');

    const hasUserManagementRole = ['ADMIN', 'HR'].includes(currentRole);
    const canRead = hasUserManagementRole || roleHasPermission(currentRole, 'users.view', permissions);
    const canCreate = (hasUserManagementRole || roleHasPermission(currentRole, 'users.create', permissions)) && allowedRoles.length > 0;
    const canUpdate = hasUserManagementRole || roleHasPermission(currentRole, 'users.update', permissions);
    const canStatus = hasUserManagementRole || roleHasPermission(currentRole, 'users.lock', permissions);
    const selectedIdsOnPage = users.map(getUserId).filter(Boolean);
    const departmentOptions = useMemo(
        () => departments.length > 0
            ? departments
            : Object.entries(fallbackDepartmentMap).map(([id, name]) => ({ id, name })),
        [departments]
    );
    const getDepartmentName = (userOrDepartmentId) => {
        if (typeof userOrDepartmentId === 'object' && userOrDepartmentId !== null) {
            if (userOrDepartmentId.department?.name) return userOrDepartmentId.department.name;
            if (userOrDepartmentId.departmentName) return userOrDepartmentId.departmentName;
        }

        const normalizedId = normalizeDepartmentId(
            typeof userOrDepartmentId === 'object' && userOrDepartmentId !== null
                ? userOrDepartmentId.departmentId
                : userOrDepartmentId
        );
        const department = departmentOptions.find((item) => getDepartmentOptionValue(item) === normalizedId);
        return department?.name || fallbackDepartmentMap[normalizedId] || '-';
    };
    const getCreatorName = (user) => {
        const canUseCurrentActivities = getUserId(user) && getUserId(user) === getUserId(currentUserDetail);
        const createLog = canUseCurrentActivities ? userActivities.find((item) => item.action === 'CREATE') : null;

        return user?.createdBy?.fullName ||
            user?.createdBy?.email ||
            user?.creator?.fullName ||
            user?.creator?.email ||
            user?.createdByName ||
            createLog?.actor?.fullName ||
            createLog?.actor?.email ||
            'Chưa có dữ liệu';
    };
    const getRoleAssignmentInfo = (user) => {
        const canUseCurrentActivities = getUserId(user) && getUserId(user) === getUserId(currentUserDetail);
        const assignLog = canUseCurrentActivities ? userActivities.find((item) => item.action === 'ASSIGN') : null;
        const createLog = canUseCurrentActivities ? userActivities.find((item) => item.action === 'CREATE') : null;
        const fallbackLog = assignLog || createLog;

        return {
            actor: user?.roleAssignedBy?.fullName ||
                user?.roleAssignedBy?.email ||
                user?.assignedRoleBy?.fullName ||
                user?.assignedRoleBy?.email ||
                user?.roleAssignedByName ||
                fallbackLog?.actor?.fullName ||
                fallbackLog?.actor?.email ||
                'Chưa có dữ liệu',
            assignedAt: user?.roleAssignedAt ||
                user?.assignedRoleAt ||
                fallbackLog?.createdAt ||
                null,
            source: assignLog ? 'audit-assign' : createLog ? 'audit-create' : 'field'
        };
    };

    const queryState = useMemo(() => ({
        keyword: search,
        ...filters,
        page: pagination.page,
        limit: pagination.limit
    }), [filters, pagination.limit, pagination.page, search]);

    const activeFilterChips = useMemo(() => {
        const entries = [
            search ? ['Từ khóa', search, () => setSearch('')] : null,
            filters.role ? ['Vai trò', roleLabels[filters.role] || filters.role, () => setFilters({ role: '' })] : null,
            filters.status ? ['Trạng thái', statusLabels[filters.status] || filters.status, () => setFilters({ status: '' })] : null,
            filters.departmentId ? ['Phòng ban', getDepartmentName(filters.departmentId), () => setFilters({ departmentId: '' })] : null,
            filters.createdBy ? ['Người tạo', filters.createdBy, () => setFilters({ createdBy: '' })] : null,
            filters.createdFrom ? ['Từ ngày', filters.createdFrom, () => setFilters({ createdFrom: '' })] : null,
            filters.createdTo ? ['Đến ngày', filters.createdTo, () => setFilters({ createdTo: '' })] : null,
            filters.emailVerified ? ['Email', filters.emailVerified === 'true' ? 'Đã xác minh' : 'Chưa xác minh', () => setFilters({ emailVerified: '' })] : null,
            filters.roleAssigned ? ['Gán vai trò', filters.roleAssigned === 'true' ? 'Đã gán' : 'Chưa gán', () => setFilters({ roleAssigned: '' })] : null
        ];
        return entries.filter(Boolean);
    }, [filters, search, setFilters, setSearch]);

    useEffect(() => {
        setSearch(searchParams.get('keyword') || '');
        setFilters({
            role: searchParams.get('role') || '',
            status: searchParams.get('status') || '',
            departmentId: searchParams.get('departmentId') || '',
            createdBy: searchParams.get('createdBy') || '',
            createdFrom: searchParams.get('createdFrom') || '',
            createdTo: searchParams.get('createdTo') || '',
            emailVerified: searchParams.get('emailVerified') || '',
            roleAssigned: searchParams.get('roleAssigned') || ''
        });
        setLimit(Number(searchParams.get('limit') || 20));
        setPage(Number(searchParams.get('page') || 1));
        roleService.getRoles().then((payload) => setRoles(normalizeItems(payload))).catch(() => setRoles([]));
        departmentService.getDepartments().then((payload) => setDepartments(normalizeItems(payload))).catch(() => setDepartments([]));
    }, []);

    useEffect(() => {
        const handle = window.setTimeout(() => setSearch(searchInput), debounceMs);
        return () => window.clearTimeout(handle);
    }, [searchInput, setSearch]);

    useEffect(() => {
        const nextParams = new URLSearchParams();
        Object.entries(queryState).forEach(([key, value]) => {
            if (value) nextParams.set(key, String(value));
        });
        setSearchParams(nextParams, { replace: true });
        fetchUsers();
        fetchSummary();
    }, [queryState, setSearchParams, fetchUsers, fetchSummary]);

    const kpis = [
        { key: 'total', label: 'Tổng người dùng', value: summary.total, trend: '0%', icon: FiUsers, filter: {} },
        { key: 'active', label: 'Đang hoạt động', value: summary.active, trend: '0%', icon: FiUserCheck, filter: { status: 'ACTIVE' } },
        { key: 'pending', label: 'Chờ kích hoạt', value: summary.pending, trend: '0%', icon: FiClock, filter: { status: 'PENDING' } },
        { key: 'locked', label: 'Bị khóa', value: summary.locked, trend: '0%', icon: FiLock, filter: { status: 'LOCKED' } },
        { key: 'newThisMonth', label: 'Người dùng mới trong tháng', value: summary.newThisMonth, trend: '0%', icon: FiCalendar, filter: { createdFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10) } },
        { key: 'unassignedRole', label: 'Chưa được gán vai trò', value: summary.unassignedRole, trend: '0%', icon: FiArchive, filter: { roleAssigned: 'false' } }
    ];

    const validateUserForm = (form, mode = 'create') => {
        const errors = {};
        if (!form.fullName?.trim()) errors.fullName = 'Họ tên bắt buộc';
        if (mode === 'create' && !/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Email không hợp lệ';
        if (form.phone && !/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(form.phone.replace(/\s/g, ''))) errors.phone = 'Số điện thoại Việt Nam không hợp lệ';
        if (mode === 'create') {
            if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(form.password)) {
                errors.password = 'Mật khẩu tối thiểu 8 ký tự, có chữ hoa, chữ thường và số';
            }
            if (form.password !== form.confirmPassword) errors.confirmPassword = 'Confirm password phải trùng';
            if (!allowedRoles.includes(form.role)) errors.role = 'Role không nằm trong danh sách được phép tạo';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const mapBackendFieldErrors = (error) => {
        const message = error?.response?.data?.message || '';
        const nextErrors = {};
        if (message.toLowerCase().includes('email')) nextErrors.email = message;
        if (message.toLowerCase().includes('mã') || message.toLowerCase().includes('code')) nextErrors.code = message;
        if (message.toLowerCase().includes('phone') || message.toLowerCase().includes('số điện thoại')) nextErrors.phone = message;
        if (Object.keys(nextErrors).length) setFormErrors(nextErrors);
    };

    const openCreate = () => {
        setCreateForm({ ...emptyCreateForm, role: allowedRoles[0] || '' });
        setFormErrors({});
        setCreateOpen(true);
    };

    const submitCreate = async (event) => {
        event.preventDefault();
        if (!validateUserForm(createForm, 'create')) return;

        const payload = {
            ...createForm,
            code: undefined,
            departmentId: createForm.departmentId ? Number(createForm.departmentId) : undefined,
            cohortYear: createForm.cohortYear ? Number(createForm.cohortYear) : undefined,
            confirmPassword: undefined
        };
        const result = await createUser(payload);
        if (result.ok) {
            setCreateOpen(false);
            return;
        }
        mapBackendFieldErrors(result.error);
    };

    const openDetail = async (user) => {
        setActiveTab('overview');
        setDetailOpen(true);
        await fetchUserDetail(getUserId(user));
    };

    const openEdit = (user) => {
        setEditForm({
            fullName: user.fullName || '',
            phone: user.phone || '',
            gender: user.gender || '',
            dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : '',
            address: user.address || '',
            departmentId: user.departmentId || '',
            status: user.status || 'ACTIVE'
        });
        setFormErrors({});
        setEditOpen(user);
    };

    const submitEdit = async (event) => {
        event.preventDefault();
        if (!validateUserForm(editForm, 'edit')) return;
        const id = getUserId(editOpen);
        const { status, ...profilePayload } = editForm;
        const result = await updateUser(id, {
            ...profilePayload,
            departmentId: editForm.departmentId ? Number(editForm.departmentId) : undefined
        });

        if (!result.ok) {
            mapBackendFieldErrors(result.error);
            return;
        }

        if (status !== editOpen.status) {
            const statusResult = await updateUserStatus(id, status);
            if (!statusResult.ok) return;
        }

        setEditOpen(false);
    };

    const userIsSelf = (user) => getUserId(user) === currentUser?.publicId || user?.email === currentUser?.email;
    const canManageUser = (user) => !userIsSelf(user) && getUserRole(user) !== 'ADMIN';
    const openLock = (user) => {
        if (userIsSelf(user)) return toast.error('Không thể khóa chính tài khoản đang đăng nhập');
        if (getUserRole(user) === 'ADMIN') return toast.error('Không thể khóa Admin từ giao diện này');
        setLockTarget(user);
        setLockForm({ reason: '', expiresAt: '', revokeSessions: true, sendEmail: true });
    };

    const submitLock = async () => {
        if (!lockForm.reason.trim()) return toast.error('Vui lòng nhập lý do khóa');
        const result = await lockUser(getUserId(lockTarget), lockForm);
        if (result.ok) setLockTarget(null);
    };

    const submitUnlock = async () => {
        if (!unlockReason.trim()) return toast.error('Vui lòng nhập lý do mở khóa');
        const result = await unlockUser(getUserId(unlockTarget), { reason: unlockReason });
        if (result.ok) {
            setUnlockTarget(null);
            setUnlockReason('');
        }
    };

    const openDeactivate = (user) => {
        if (userIsSelf(user)) return toast.error('Không thể vô hiệu hóa chính tài khoản đang đăng nhập');
        setDeactivateTarget(user);
        setDeactivateForm({ reason: '', revokeSessions: true, sendEmail: true });
    };

    const submitDeactivate = async () => {
        if (!deactivateForm.reason.trim()) return toast.error('Vui lòng nhập lý do vô hiệu hóa');
        if (deactivateTarget?.bulk) {
            await bulkAction('deactivate');
            setDeactivateTarget(null);
            return;
        }

        const result = await deactivateUser(getUserId(deactivateTarget), deactivateForm);
        if (result.ok) setDeactivateTarget(null);
    };

    const submitActivate = async () => {
        const result = await activateUser(getUserId(activateTarget), { reason: 'Kích hoạt lại tài khoản' });
        if (result.ok) setActivateTarget(null);
    };

    const submitResetPassword = async () => {
        const result = await resetPassword(getUserId(resetTarget), resetForm);
        if (result.ok) {
            const temp = result.data?.temporaryPassword || result.data?.password;
            if (temp) setTemporaryPassword(temp);
            if (!temp) setResetTarget(null);
        }
    };

    const submitChangeRole = async () => {
        if (!changeRoleCode) return toast.error('Vui lòng chọn vai trò');
        if (userIsSelf(roleTarget)) return toast.error('Không thể tự nâng quyền tài khoản của chính mình');
        const result = await changeUserRole(getUserId(roleTarget), { role: changeRoleCode });
        if (result.ok) setRoleTarget(null);
    };

    const bulkAction = async (action) => {
        if (selectedUserIds.length === 0) return;
        try {
            if (action === 'lock') await userService.bulkLockUsers({ userIds: selectedUserIds, reason: 'Bulk lock from Admin UI' });
            if (action === 'unlock') await userService.bulkUnlockUsers({ userIds: selectedUserIds, reason: 'Bulk unlock from Admin UI' });
            if (action === 'deactivate') await Promise.all(selectedUserIds.map((id) => userService.deactivateUser(id, deactivateForm)));
            if (action === 'activation') await Promise.all(selectedUserIds.map((id) => userService.resendActivation(id)));
            toast.success('Đã gửi thao tác hàng loạt');
            clearSelection();
            refreshData();
        } catch (bulkError) {
            toast.error(bulkError?.response?.data?.message || 'Backend chưa hỗ trợ thao tác hàng loạt này');
        }
    };

    const exportUsers = async ({ selectedOnly = false } = {}) => {
        if (selectedOnly && selectedUserIds.length === 0) {
            toast.error('Vui long chon it nhat mot nguoi dung de xuat');
            return;
        }

        try {
            const exportParams = selectedOnly
                ? { publicIds: selectedUserIds.join(',') }
                : {
                      ...queryState,
                      page: undefined,
                      limit: undefined
                  };
            const blob = await userService.exportUsers(exportParams);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            anchor.href = url;
            anchor.download = selectedOnly ? `edulms-users-selected-${timestamp}.csv` : `edulms-users-${timestamp}.csv`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Backend chưa hỗ trợ xuất danh sách người dùng');
        }
    };

    if (!canRead) {
        return (
            <div className={cx('flow-shell')}>
                <AppSidebar workspaceKey="admin" />
                <main className={cx('flow-main', 'admin-users')}>
                    <section className={cx('admin-users__empty')}>
                        <FiShield />
                        <h1>Bạn chưa có quyền xem danh sách người dùng</h1>
                        <p>Vui lòng liên hệ Admin để được cấp quyền users.read.</p>
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div className={cx('flow-shell')}>
            <AppSidebar workspaceKey="admin" />
            <main className={cx('flow-main', 'admin-users')}>
                <section className={cx('admin-users__hero')}>
                    <div>
                        <span>Quản trị hệ thống / Quản lý người dùng</span>
                        <h1>Quản lý người dùng</h1>
                        <p>Quản lý tài khoản, vai trò và trạng thái người dùng trong hệ thống</p>
                    </div>
                    <div>
                        <button type="button" onClick={refreshData} disabled={loading}><FiRefreshCw /> Làm mới</button>
                        <button type="button" onClick={() => exportUsers()}><FiDownload /> Xuất danh sách</button>
                        <button type="button" className={cx('is-primary')} onClick={openCreate} disabled={!canCreate}>
                            <FiUserPlus /> {currentRole === 'ADMIN' ? 'Thêm HR hoặc Hiệu trưởng' : 'Thêm người dùng'}
                        </button>
                    </div>
                </section>

                <section className={cx('admin-users__kpis')}>
                    {kpis.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button key={item.key} type="button" onClick={() => setFilters(item.filter)}>
                                <span><Icon /></span>
                                <SummaryValue value={item.value} />
                                <small>{item.label}</small>
                                <em>{summary.trends?.[item.key] || item.trend}</em>
                            </button>
                        );
                    })}
                </section>

                <section className={cx('admin-users__filters')}>
                    <div className={cx('admin-users__search')}>
                        <FiSearch />
                        <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm theo họ tên, email, số điện thoại hoặc mã người dùng" />
                    </div>
                    <select value={draftFilters.role} onChange={(event) => setDraftFilters((current) => ({ ...current, role: event.target.value }))}>
                        <option value="">Tất cả vai trò</option>
                        {Object.entries(roleLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                    <select value={draftFilters.status} onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}>
                        <option value="">Tất cả trạng thái</option>
                        {Object.entries(statusLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                    <select value={draftFilters.departmentId} onChange={(event) => setDraftFilters((current) => ({ ...current, departmentId: event.target.value }))}>
                        <option value="">Tất cả phòng ban/bộ môn</option>
                        {departmentOptions.map((department) => (
                            <option key={department.publicId || department.code} value={getDepartmentOptionValue(department)}>
                                {department.name}
                            </option>
                        ))}
                    </select>
                    <button type="button" onClick={() => setFilters(draftFilters)}><FiFilter /> Áp dụng</button>
                    <button type="button" onClick={() => { resetFilters(); setSearchInput(''); setDraftFilters({ ...draftFilters, role: '', status: '', departmentId: '', createdBy: '', createdFrom: '', createdTo: '', emailVerified: '', roleAssigned: '' }); }}><FiRotateCcw /> Xóa bộ lọc</button>
                    <button type="button" onClick={() => setAdvancedOpen((value) => !value)}><FiSliders /> Bộ lọc nâng cao</button>

                    {advancedOpen ? (
                        <div className={cx('admin-users__advanced')}>
                            <input value={draftFilters.createdBy} onChange={(event) => setDraftFilters((current) => ({ ...current, createdBy: event.target.value }))} placeholder="Người tạo" />
                            <Field label="Từ ngày"><input type="date" value={draftFilters.createdFrom} onChange={(event) => setDraftFilters((current) => ({ ...current, createdFrom: event.target.value }))} /></Field>
                            <Field label="Đến ngày"><input type="date" value={draftFilters.createdTo} onChange={(event) => setDraftFilters((current) => ({ ...current, createdTo: event.target.value }))} /></Field>
                            <select value={draftFilters.emailVerified} onChange={(event) => setDraftFilters((current) => ({ ...current, emailVerified: event.target.value }))}>
                                <option value="">Xác minh email</option>
                                <option value="true">Đã xác minh</option>
                                <option value="false">Chưa xác minh</option>
                            </select>
                            <select value={draftFilters.roleAssigned} onChange={(event) => setDraftFilters((current) => ({ ...current, roleAssigned: event.target.value }))}>
                                <option value="">Có vai trò/chưa có vai trò</option>
                                <option value="true">Đã có vai trò</option>
                                <option value="false">Chưa có vai trò</option>
                            </select>
                        </div>
                    ) : null}

                    {activeFilterChips.length > 0 ? (
                        <div className={cx('admin-users__chips')}>
                            {activeFilterChips.map(([label, value, remove]) => (
                                <button key={`${label}-${value}`} type="button" onClick={remove}>
                                    {label}: {value} <FiX />
                                </button>
                            ))}
                        </div>
                    ) : null}
                </section>

                {selectedUserIds.length > 0 ? (
                    <section className={cx('admin-users__bulk')}>
                        <strong>{selectedUserIds.length} người dùng đã chọn</strong>
                        <button type="button" onClick={() => bulkAction('lock')} disabled={!canStatus}><FiLock /> Khóa</button>
                        <button type="button" onClick={() => bulkAction('unlock')} disabled={!canStatus}><FiUnlock /> Mở khóa</button>
                        <button type="button" onClick={() => setRoleTarget({ bulk: true })} disabled={!canUpdate}><FiShield /> Gán vai trò</button>
                        <button type="button" onClick={() => bulkAction('activation')}><FiMail /> Gửi email kích hoạt</button>
                        <button type="button" onClick={() => exportUsers({ selectedOnly: true })}><FiDownload /> Xuất đã chọn</button>
                        <button type="button" disabled={!canStatus} onClick={() => { setDeactivateTarget({ bulk: true }); setDeactivateForm({ reason: '', revokeSessions: true, sendEmail: true }); }}><FiArchive /> Vô hiệu hóa</button>
                        <button type="button" onClick={clearSelection}><FiX /> Bỏ chọn</button>
                    </section>
                ) : null}

                <section className={cx('admin-users__panel')}>
                    {error ? (
                        <div className={cx('admin-users__empty')}>
                            <FiAlertCircle />
                            <h2>Không thể tải dữ liệu</h2>
                            <p>{error}</p>
                            <button type="button" onClick={refreshData}>Thử lại</button>
                        </div>
                    ) : (
                        <>
                            <div className={cx('admin-users__table-wrap')}>
                                <table className={cx('admin-users__table')}>
                                    <thead>
                                        <tr>
                                            <th><input type="checkbox" checked={selectedIdsOnPage.length > 0 && selectedIdsOnPage.every((id) => selectedUserIds.includes(id))} onChange={() => selectAllUsers(selectedIdsOnPage)} /></th>
                                            <th>Người dùng</th>
                                            <th>Vai trò</th>
                                            <th>Phòng ban hoặc bộ môn</th>
                                            <th>Trạng thái</th>
                                            <th>Người tạo</th>
                                            <th>Lần đăng nhập gần nhất</th>
                                            <th>Ngày tạo</th>
                                            <th>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? Array.from({ length: 6 }).map((_, index) => (
                                            <tr key={index}><td colSpan="9"><div className={cx('admin-users__skeleton')} /></td></tr>
                                        )) : users.length === 0 ? (
                                            <tr><td colSpan="9"><div className={cx('admin-users__empty')}>Không tìm thấy kết quả phù hợp.</div></td></tr>
                                        ) : users.map((user) => {
                                            const id = getUserId(user);
                                            const status = user.status || 'INACTIVE';
                                            const canDeactivate = ['ACTIVE', 'PENDING', 'LOCKED'].includes(status);
                                            return (
                                                <tr key={id}>
                                                    <td><input type="checkbox" checked={selectedUserIds.includes(id)} onChange={() => selectUser(id)} /></td>
                                                    <td>
                                                        <div className={cx('admin-users__identity')}>
                                                            <div>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : getInitials(user.fullName)}</div>
                                                            <span><strong>{user.fullName}</strong><small>{user.email}</small><small>{user.code || 'Chưa có mã'}</small></span>
                                                        </div>
                                                    </td>
                                                    <td><span className={cx('admin-users__role')}>{getUserRoleName(user)}</span></td>
                                                    <td>{getDepartmentName(user)}</td>
                                                    <td><span className={cx('admin-users__status', `is-${status.toLowerCase()}`)}>{statusLabels[status] || status}</span></td>
                                                    <td>{getCreatorName(user)}</td>
                                                    <td>{formatDateTime(user.lastLoginAt)}</td>
                                                    <td>{formatDate(user.createdAt)}</td>
                                                    <td>
                                                        <div className={cx('admin-users__actions')}>
                                                            <button type="button" title="Xem chi tiết" onClick={() => openDetail(user)}><FiEye /></button>
                                                            {canUpdate ? <button type="button" title="Chỉnh sửa" onClick={() => openEdit(user)}><FiEdit3 /></button> : null}
                                                            {canUpdate ? <button type="button" title="Thay đổi vai trò" disabled={userIsSelf(user)} onClick={() => { setRoleTarget(user); setChangeRoleCode(getUserRole(user)); }}><FiShield /></button> : null}
                                                            {canStatus && status === 'INACTIVE' ? <button type="button" title="Kích hoạt lại" disabled={!canManageUser(user)} onClick={() => setActivateTarget(user)}><FiUserCheck /></button> : null}
                                                            {canStatus && status !== 'LOCKED' && status !== 'INACTIVE' ? <button type="button" title="Khóa tài khoản" disabled={!canManageUser(user)} onClick={() => openLock(user)}><FiLock /></button> : null}
                                                            {canStatus && status === 'LOCKED' ? <button type="button" title="Mở khóa tài khoản" disabled={!canManageUser(user)} onClick={() => setUnlockTarget(user)}><FiUnlock /></button> : null}
                                                            {canStatus && canDeactivate ? <button type="button" title="Vô hiệu hóa tài khoản" disabled={!canManageUser(user)} onClick={() => openDeactivate(user)}><FiArchive /></button> : null}
                                                            {status !== 'INACTIVE' ? <button type="button" title="Gửi lại email kích hoạt" onClick={() => userService.resendActivation(id).then(() => toast.success('Đã gửi email kích hoạt')).catch(() => toast.error('Backend chưa hỗ trợ gửi lại email kích hoạt'))}><FiMail /></button> : null}
                                                            {status !== 'INACTIVE' ? <button type="button" title="Đặt lại mật khẩu" onClick={() => { setResetTarget(user); setTemporaryPassword(''); }}><FiKey /></button> : null}
                                                            <button type="button" title="Xem lịch sử hoạt động" onClick={() => { openDetail(user); setActiveTab('activity'); }}><FiMoreVertical /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className={cx('admin-users__cards')}>
                                {users.map((user) => {
                                    const id = getUserId(user);
                                    const status = user.status || 'INACTIVE';
                                    return (
                                        <article key={id}>
                                            <header>
                                                <div className={cx('admin-users__identity')}>
                                                    <div>{getInitials(user.fullName)}</div>
                                                    <span><strong>{user.fullName}</strong><small>{user.email}</small></span>
                                                </div>
                                                <input type="checkbox" checked={selectedUserIds.includes(id)} onChange={() => selectUser(id)} />
                                            </header>
                                            <p><b>Vai trò:</b> {getUserRoleName(user)}</p>
                                            <p><b>Phòng ban:</b> {getDepartmentName(user)}</p>
                                            <p><b>Người tạo:</b> {getCreatorName(user)}</p>
                                            <p><b>Trạng thái:</b> {statusLabels[user.status] || user.status}</p>
                                            <p><b>Mã:</b> {user.code || '-'}</p>
                                            <footer>
                                                <button type="button" onClick={() => openDetail(user)}>Xem</button>
                                                <button type="button" onClick={() => openEdit(user)} disabled={!canUpdate}>Sửa</button>
                                                {status === 'INACTIVE'
                                                    ? <button type="button" onClick={() => setActivateTarget(user)} disabled={!canStatus || !canManageUser(user)}>Kích hoạt lại</button>
                                                    : <button type="button" onClick={() => openDeactivate(user)} disabled={!canStatus || !canManageUser(user)}>Vô hiệu hóa</button>}
                                            </footer>
                                        </article>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </section>

                <section className={cx('admin-users__pagination')}>
                    <span>Tổng {pagination.total.toLocaleString('vi-VN')} bản ghi · Trang {pagination.page}/{pagination.totalPages}</span>
                    <select value={pagination.limit} onChange={(event) => setLimit(event.target.value)}>
                        {[10, 20, 50, 100].map((limit) => <option key={limit} value={limit}>{limit}/trang</option>)}
                    </select>
                    <button type="button" onClick={() => setPage(pagination.page - 1)} disabled={pagination.page <= 1}><FiChevronLeft /> Trang trước</button>
                    <button type="button" onClick={() => setPage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}>Trang sau <FiChevronRight /></button>
                </section>

                {createOpen ? (
                    <div className={cx('admin-users__backdrop')}>
                        <form className={cx('admin-users__drawer')} onSubmit={submitCreate}>
                            <header><div><span>Tạo tài khoản</span><h2>{currentRole === 'ADMIN' ? 'Thêm HR hoặc Hiệu trưởng' : 'Thêm người dùng'}</h2></div><button type="button" onClick={() => setCreateOpen(false)}><FiX /></button></header>
                            <div className={cx('admin-users__form-grid')}>
                                <Field label="Họ tên" error={formErrors.fullName}><input value={createForm.fullName} onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })} /></Field>
                                <Field label="Email" error={formErrors.email}><input value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} /></Field>
                                <Field label="Số điện thoại" error={formErrors.phone}><input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} /></Field>
                                <Field label="Mật khẩu" error={formErrors.password}><input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} /></Field>
                                <Field label="Confirm password" error={formErrors.confirmPassword}><input type="password" value={createForm.confirmPassword} onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })} /></Field>
                                <Field label="Vai trò" error={formErrors.role}>
                                    <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                                        <option value="">Chọn vai trò</option>
                                        {allowedRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                                    </select>
                                </Field>
                                <Field label="Trạng thái"><select value={createForm.status} onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}>{Object.entries(statusLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></Field>
                                <Field label="Giới tính"><select value={createForm.gender} onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })}><option value="">Không chọn</option>{Object.entries(genderLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></Field>
                                <Field label="Ngày sinh"><input type="date" value={createForm.dateOfBirth} onChange={(e) => setCreateForm({ ...createForm, dateOfBirth: e.target.value })} /></Field>
                                <Field label="Phòng ban/Bộ môn">
                                    <select value={createForm.departmentId} onChange={(e) => setCreateForm({ ...createForm, departmentId: e.target.value })}>
                                        <option value="">Chọn phòng ban/bộ môn</option>
                                        {departmentOptions.map((department) => (
                                            <option key={department.publicId || department.code} value={getDepartmentOptionValue(department)}>
                                                {department.name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Năm khóa"><input type="number" value={createForm.cohortYear} onChange={(e) => setCreateForm({ ...createForm, cohortYear: e.target.value })} /></Field>
                                <Field label="Địa chỉ"><textarea value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} /></Field>
                            </div>
                            <footer><button type="button" onClick={() => setCreateOpen(false)}>Hủy</button><button type="submit" disabled={submitting}>{submitting ? 'Đang tạo...' : 'Tạo tài khoản'}</button></footer>
                        </form>
                    </div>
                ) : null}

                {editOpen ? (
                    <div className={cx('admin-users__backdrop')}>
                        <form className={cx('admin-users__drawer')} onSubmit={submitEdit}>
                            <header><div><span>Chỉnh sửa người dùng</span><h2>{editOpen.fullName}</h2></div><button type="button" onClick={() => setEditOpen(false)}><FiX /></button></header>
                            <div className={cx('admin-users__form-grid')}>
                                <Field label="Họ tên" error={formErrors.fullName}><input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} /></Field>
                                <Field label="Số điện thoại" error={formErrors.phone}><input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></Field>
                                <Field label="Giới tính"><select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}><option value="">Không chọn</option>{Object.entries(genderLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></Field>
                                <Field label="Ngày sinh"><input type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} /></Field>
                                <Field label="Phòng ban/Bộ môn">
                                    <select value={editForm.departmentId} onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}>
                                        <option value="">Chọn phòng ban/bộ môn</option>
                                        {departmentOptions.map((department) => (
                                            <option key={department.publicId || department.code} value={getDepartmentOptionValue(department)}>
                                                {department.name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Trạng thái"><select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>{Object.entries(statusLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></Field>
                                <Field label="Địa chỉ"><textarea value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></Field>
                            </div>
                            <p className={cx('admin-users__note')}>Email, mã người dùng và vai trò chỉ nên thay đổi bằng quyền riêng. Hiện BE đang cho phép update chung qua PATCH /users/:id.</p>
                            <footer><button type="button" onClick={() => setEditOpen(false)}>Hủy</button><button type="submit" disabled={submitting}>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</button></footer>
                        </form>
                    </div>
                ) : null}

                {detailOpen ? (
                    <div className={cx('admin-users__backdrop')}>
                        <aside className={cx('admin-users__detail')}>
                            <header><div><span>Chi tiết người dùng</span><h2>{currentUserDetail?.fullName || 'Đang tải...'}</h2></div><button type="button" onClick={() => setDetailOpen(false)}><FiX /></button></header>
                            <nav>{['overview', 'role', 'work', 'login', 'activity'].map((tab) => <button key={tab} type="button" className={cx({ 'is-active': activeTab === tab })} onClick={() => setActiveTab(tab)}>{({ overview: 'Thông tin chung', role: 'Vai trò và quyền', work: 'Công tác/Học tập', login: 'Lịch sử đăng nhập', activity: 'Nhật ký hoạt động' })[tab]}</button>)}</nav>
                            {detailLoading ? <div className={cx('admin-users__skeleton')} /> : (
                                <div className={cx('admin-users__detail-body')}>
                                    {activeTab === 'overview' ? (
                                        <section><div className={cx('admin-users__profile-avatar')}>{getInitials(currentUserDetail?.fullName)}</div><dl><div><dt>Họ tên</dt><dd>{currentUserDetail?.fullName}</dd></div><div><dt>Email</dt><dd>{currentUserDetail?.email}</dd></div><div><dt>Số điện thoại</dt><dd>{currentUserDetail?.phone || '-'}</dd></div><div><dt>Mã người dùng</dt><dd>{currentUserDetail?.code}</dd></div><div><dt>Trạng thái</dt><dd>{statusLabels[currentUserDetail?.status] || currentUserDetail?.status}</dd></div><div><dt>Ngày tạo</dt><dd>{formatDate(currentUserDetail?.createdAt)}</dd></div><div><dt>Người tạo</dt><dd>{getCreatorName(currentUserDetail)}</dd></div></dl></section>
                                    ) : null}
                                    {activeTab === 'role' ? (
                                        <section>
                                            {(() => {
                                                const roleAssignment = getRoleAssignmentInfo(currentUserDetail);

                                                return (
                                                    <>
                                                        <h3>{getUserRoleName(currentUserDetail)}</h3>
                                                        <p>Người gán vai trò: {roleAssignment.actor}</p>
                                                        <p>Ngày được gán: {formatDateTime(roleAssignment.assignedAt || currentUserDetail?.createdAt)}</p>
                                                        {roleAssignment.source === 'audit-create' ? <p>Vai trò được xác định từ lúc tạo tài khoản.</p> : null}
                                                    </>
                                                );
                                            })()}
                                            <div className={cx('admin-users__permissions')}>{(currentUserDetail?.permissionCodes || currentUserDetail?.role?.permissions?.map((item) => item.permission?.code || item.code) || []).map((code) => <span key={code}>{code}</span>)}</div>
                                        </section>
                                    ) : null}
                                    {activeTab === 'work' ? (
                                        <section><dl><div><dt>Phòng ban/Bộ môn</dt><dd>{getDepartmentName(currentUserDetail)}</dd></div><div><dt>Thông tin chuyên môn</dt><dd>{currentUserDetail?.specialization || 'Chưa có API'}</dd></div><div><dt>Role nghiệp vụ</dt><dd>{getUserRoleName(currentUserDetail)}</dd></div></dl></section>
                                    ) : null}
                                    {activeTab === 'login' ? (
                                        <section className={cx('admin-users__mini-list')}>
                                            {userLoginHistory.length ? userLoginHistory.map((item) => (
                                                <article key={item.publicId || item.createdAt}>
                                                    <strong>{formatDateTime(item.createdAt)}</strong>
                                                    <span>{item.device || 'Unknown device'} · {item.browser || 'Unknown browser'} · IP: {item.ipAddress || '-'}</span>
                                                    <em>Thành công</em>
                                                </article>
                                            )) : <p>Chưa có lịch sử đăng nhập.</p>}
                                        </section>
                                    ) : null}
                                    {activeTab === 'activity' ? (
                                        <section className={cx('admin-users__mini-list')}>{userActivities.length ? userActivities.map((item) => <article key={item.publicId || item.createdAt}><strong>{item.action}</strong><span>{item.actor?.fullName || 'Hệ thống'} · {formatDateTime(item.createdAt)}</span><em>{item.result || 'Thành công'}</em></article>) : <p>Backend chưa trả nhật ký hoạt động riêng cho người dùng.</p>}</section>
                                    ) : null}
                                </div>
                            )}
                        </aside>
                    </div>
                ) : null}

                {lockTarget ? (
                    <ConfirmDialog title="Khóa tài khoản" message={`${lockTarget.fullName} · ${lockTarget.email}`} danger loading={submitting} confirmLabel="Xác nhận khóa" onCancel={() => setLockTarget(null)} onConfirm={submitLock}>
                        <Field label="Lý do khóa"><textarea value={lockForm.reason} onChange={(e) => setLockForm({ ...lockForm, reason: e.target.value })} /></Field>
                        <Field label="Thời hạn khóa"><input type="datetime-local" value={lockForm.expiresAt} onChange={(e) => setLockForm({ ...lockForm, expiresAt: e.target.value })} /></Field>
                        <label className={cx('admin-users__check')}><input type="checkbox" checked={lockForm.revokeSessions} onChange={(e) => setLockForm({ ...lockForm, revokeSessions: e.target.checked })} /> Đăng xuất khỏi tất cả thiết bị</label>
                        <label className={cx('admin-users__check')}><input type="checkbox" checked={lockForm.sendEmail} onChange={(e) => setLockForm({ ...lockForm, sendEmail: e.target.checked })} /> Gửi email thông báo</label>
                    </ConfirmDialog>
                ) : null}

                {unlockTarget ? (
                    <ConfirmDialog title="Mở khóa tài khoản" message={`${unlockTarget.fullName} · ${unlockTarget.email}`} loading={submitting} confirmLabel="Xác nhận mở khóa" onCancel={() => setUnlockTarget(null)} onConfirm={submitUnlock}>
                        <Field label="Lý do mở khóa"><textarea value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} /></Field>
                    </ConfirmDialog>
                ) : null}

                {deactivateTarget ? (
                    <ConfirmDialog
                        title="Vô hiệu hóa tài khoản"
                        message={deactivateTarget.bulk ? `${selectedUserIds.length} tài khoản đã chọn` : `Bạn đang vô hiệu hóa tài khoản: ${deactivateTarget.fullName} · Email: ${deactivateTarget.email} · Vai trò: ${getUserRoleName(deactivateTarget)}`}
                        danger
                        loading={submitting}
                        confirmLabel="Xác nhận vô hiệu hóa"
                        onCancel={() => setDeactivateTarget(null)}
                        onConfirm={submitDeactivate}
                    >
                        <ul className={cx('admin-users__impact-list')}>
                            <li>Người dùng không thể đăng nhập.</li>
                            <li>Các phiên đăng nhập hiện tại sẽ bị kết thúc.</li>
                            <li>Dữ liệu bài học, lớp học và điểm số vẫn được giữ nguyên.</li>
                            <li>Tài khoản chỉ có thể được kích hoạt lại bởi người có quyền.</li>
                        </ul>
                        <Field label="Lý do vô hiệu hóa">
                            <textarea value={deactivateForm.reason} onChange={(e) => setDeactivateForm({ ...deactivateForm, reason: e.target.value })} />
                        </Field>
                        <label className={cx('admin-users__check')}><input type="checkbox" checked={deactivateForm.revokeSessions} onChange={(e) => setDeactivateForm({ ...deactivateForm, revokeSessions: e.target.checked })} /> Đăng xuất tài khoản khỏi tất cả thiết bị</label>
                        <label className={cx('admin-users__check')}><input type="checkbox" checked={deactivateForm.sendEmail} onChange={(e) => setDeactivateForm({ ...deactivateForm, sendEmail: e.target.checked })} /> Gửi email thông báo cho người dùng</label>
                    </ConfirmDialog>
                ) : null}

                {activateTarget ? (
                    <ConfirmDialog title="Kích hoạt lại tài khoản" message={`${activateTarget.fullName} · ${activateTarget.email}`} loading={submitting} confirmLabel="Kích hoạt lại" onCancel={() => setActivateTarget(null)} onConfirm={submitActivate}>
                        <p>Tài khoản sẽ được chuyển về trạng thái đang hoạt động và có thể đăng nhập trở lại.</p>
                    </ConfirmDialog>
                ) : null}

                {resetTarget ? (
                    <ConfirmDialog title="Đặt lại mật khẩu" message={`${resetTarget.fullName} · ${resetTarget.email}`} loading={submitting} confirmLabel="Xác nhận" onCancel={() => { setResetTarget(null); setTemporaryPassword(''); }} onConfirm={submitResetPassword}>
                        <div className={cx('admin-users__radio-group')}><label><input type="radio" checked={resetForm.mode === 'link'} onChange={() => setResetForm({ ...resetForm, mode: 'link' })} /> Gửi liên kết đặt lại mật khẩu</label><label><input type="radio" checked={resetForm.mode === 'temporary'} onChange={() => setResetForm({ ...resetForm, mode: 'temporary' })} /> Tạo mật khẩu tạm thời</label></div>
                        <label className={cx('admin-users__check')}><input type="checkbox" checked={resetForm.forceChange} onChange={(e) => setResetForm({ ...resetForm, forceChange: e.target.checked })} /> Yêu cầu đổi mật khẩu lần đăng nhập tiếp theo</label>
                        <label className={cx('admin-users__check')}><input type="checkbox" checked={resetForm.revokeSessions} onChange={(e) => setResetForm({ ...resetForm, revokeSessions: e.target.checked })} /> Đăng xuất khỏi tất cả thiết bị</label>
                        {temporaryPassword ? <div className={cx('admin-users__temporary-password')}><strong>{temporaryPassword}</strong><button type="button" onClick={() => navigator.clipboard.writeText(temporaryPassword)}>Sao chép</button><small>Mật khẩu tạm thời chỉ hiển thị một lần.</small></div> : null}
                    </ConfirmDialog>
                ) : null}

                {roleTarget ? (
                    <ConfirmDialog title={roleTarget.bulk ? 'Gán vai trò hàng loạt' : 'Thay đổi vai trò'} message={roleTarget.bulk ? `${selectedUserIds.length} người dùng đã chọn` : `${roleTarget.fullName} · ${roleTarget.email}`} loading={submitting} confirmLabel="Gán vai trò" onCancel={() => setRoleTarget(null)} onConfirm={roleTarget.bulk ? () => userService.bulkAssignRole({ userIds: selectedUserIds, role: changeRoleCode }).then(() => { toast.success('Đã gán vai trò'); setRoleTarget(null); refreshData(); }).catch(() => toast.error('Backend chưa hỗ trợ gán vai trò hàng loạt')) : submitChangeRole}>
                        <Field label="Vai trò">
                            <select value={changeRoleCode} onChange={(e) => setChangeRoleCode(e.target.value)}>
                                <option value="">Chọn vai trò</option>
                                {roles.map((role) => <option key={role.code} value={role.code}>{role.name || roleLabels[role.code] || role.code}</option>)}
                            </select>
                        </Field>
                    </ConfirmDialog>
                ) : null}

                {submitting ? <div className={cx('admin-users__submit-overlay')}>Đang xử lý...</div> : null}
            </main>
        </div>
    );
}
