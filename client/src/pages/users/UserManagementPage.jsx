import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiActivity,
    FiChevronLeft,
    FiChevronRight,
    FiDownload,
    FiEdit2,
    FiFileText,
    FiLock,
    FiPlus,
    FiRefreshCcw,
    FiSearch,
    FiShield,
    FiTrash2,
    FiUnlock,
    FiUpload,
    FiUserPlus,
    FiX
} from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { getApiMessage } from '~/shared/api/http.js';
import { adminModulesApi } from '~/shared/api/adminModulesApi.js';
import { userAccountsApi } from '~/shared/api/userAccountsApi.js';
import { ModalBackdrop } from '~/shared/components/ModalBackdrop.jsx';
import { managedUserRolesByRole, roleLabels, userRoles, visibleUserRolesByRole } from '~/shared/constants/roles.js';
import { useAuthStore } from '~/shared/store/authStore.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './UserManagementPage.module.scss';

const actorOptions = [
    { value: 'ALL', label: 'Tất cả tài khoản' },
    { value: userRoles.ADMIN, label: roleLabels[userRoles.ADMIN] },
    { value: userRoles.HR, label: roleLabels[userRoles.HR] },
    { value: userRoles.PRINCIPAL, label: roleLabels[userRoles.PRINCIPAL] },
    { value: userRoles.TRAINING_OFFICER, label: roleLabels[userRoles.TRAINING_OFFICER] },
    { value: userRoles.DEPARTMENT_HEAD, label: roleLabels[userRoles.DEPARTMENT_HEAD] },
    { value: userRoles.LECTURER, label: roleLabels[userRoles.LECTURER] },
    { value: userRoles.STUDENT, label: roleLabels[userRoles.STUDENT] }
];

const emptyForm = {
    fullName: '',
    email: '',
    phone: '',
    role: userRoles.STUDENT,
    departmentPublicId: ''
};

const vietnameseMobilePattern = /^0[35789]\d{8}$/;
const isValidPhone = (phone) => !phone.trim() || vietnameseMobilePattern.test(phone.trim());

const studentStatusOptions = [
    { value: 'STUDYING', label: 'Đang học' },
    { value: 'GRADUATED', label: 'Đã tốt nghiệp' },
    { value: 'RESERVED', label: 'Đang bảo lưu' },
    { value: 'DROPPED_OUT', label: 'Đã thôi học' },
    { value: 'SUSPENDED', label: 'Tạm đình chỉ học' }
];

const employmentStatusOptions = [
    { value: 'WORKING', label: 'Đang công tác' },
    { value: 'ON_LEAVE', label: 'Tạm nghỉ' },
    { value: 'CONTRACT_ENDED', label: 'Hết hợp đồng' },
    { value: 'RESIGNED', label: 'Đã nghỉ việc' },
    { value: 'TERMINATED', label: 'Đã chấm dứt công tác' }
];

const accountStatusOptions = [
    { value: 'ACTIVE', label: 'Đang hoạt động' },
    { value: 'PENDING', label: 'Chờ kích hoạt' },
    { value: 'INACTIVE', label: 'Ngừng hoạt động' },
    { value: 'LOCKED', label: 'Đã khóa' }
];

const lifecycleStatusOptions = [...studentStatusOptions, ...employmentStatusOptions];

const csvHeaderAliases = {
    fullName: ['fullname', 'name', 'hoten', 'hovaten', 'họ tên', 'ho ten', 'họ và tên', 'ho va ten'],
    email: ['email', 'mail'],
    phone: ['phone', 'sodienthoai', 'so dien thoai', 'số điện thoại', 'dien thoai', 'điện thoại'],
    role: ['role', 'actor', 'vaitro', 'vai tro', 'vai trò']
};

const normalizeHeader = (value) =>
    value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

const parseCsvLine = (line) => {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        const nextCharacter = line[index + 1];

        if (character === '"' && nextCharacter === '"') {
            current += '"';
            index += 1;
            continue;
        }

        if (character === '"') {
            inQuotes = !inQuotes;
            continue;
        }

        if (character === ',' && !inQuotes) {
            cells.push(current.trim());
            current = '';
            continue;
        }

        current += character;
    }

    cells.push(current.trim());
    return cells;
};

const normalizeRoleValue = (value) => {
    const normalizedValue = normalizeHeader(value);
    const roleEntry = Object.entries(roleLabels).find(([role, label]) => normalizeHeader(role) === normalizedValue || normalizeHeader(label) === normalizedValue);

    return roleEntry?.[0] ?? '';
};

const parseUserCsv = (text) => {
    const lines = text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]).map(normalizeHeader);
    const findHeaderIndex = (field) => {
        const aliases = csvHeaderAliases[field].map(normalizeHeader);
        return headers.findIndex((header) => aliases.includes(header));
    };

    const indexes = {
        fullName: findHeaderIndex('fullName'),
        email: findHeaderIndex('email'),
        phone: findHeaderIndex('phone'),
        role: findHeaderIndex('role')
    };

    if (indexes.fullName < 0 || indexes.email < 0) {
        throw new Error('File CSV cần có cột Họ tên và Email');
    }

    return lines
        .slice(1)
        .map(parseCsvLine)
        .map((row) => ({
            fullName: row[indexes.fullName]?.trim() ?? '',
            email: row[indexes.email]?.trim() ?? '',
            phone: indexes.phone >= 0 ? (row[indexes.phone]?.trim() ?? '') : '',
            role: indexes.role >= 0 ? normalizeRoleValue(row[indexes.role] ?? '') : ''
        }))
        .filter((row) => row.fullName && row.email);
};

const escapeCsvCell = (value) => {
    const normalizedValue = String(value ?? '');
    return `"${normalizedValue.replace(/"/g, '""')}"`;
};

const downloadCsvFile = (filename, rows) => {
    const csvContent = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

const formatDateTime = (value) => {
    if (!value) return 'Chưa đăng nhập';
    return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(value));
};

const getStatusLabel = (status) => accountStatusOptions.find((option) => option.value === status)?.label ?? 'Không xác định';

const getAccountStatusPillClass = (status) => classNames(ui.statusPill, {
    [ui.statusPillActive]: status === 'ACTIVE',
    [ui.statusPillPending]: status === 'PENDING',
    [ui.statusPillInactive]: status === 'INACTIVE',
    [ui.statusPillLocked]: status === 'LOCKED'
});

const getStudentStatusLabel = (status) => studentStatusOptions.find((option) => option.value === status)?.label ?? 'Chưa cập nhật';

const getEmploymentStatusLabel = (status) => employmentStatusOptions.find((option) => option.value === status)?.label ?? 'Chưa cập nhật';

const getLifecycleStatusValue = (account) =>
    account.role === userRoles.STUDENT ? (account.studentStatus ?? 'STUDYING') : (account.employmentStatus ?? 'WORKING');

const getLifecycleStatusLabel = (account) =>
    account.role === userRoles.STUDENT ? getStudentStatusLabel(account.studentStatus) : getEmploymentStatusLabel(account.employmentStatus);

const getLifecycleStatusPillClass = (account) => {
    const status = getLifecycleStatusValue(account);

    return classNames(ui.statusPill, {
        [ui.statusPillActive]: ['STUDYING', 'WORKING'].includes(status),
        [ui.statusPillPending]: ['RESERVED', 'ON_LEAVE', 'CONTRACT_ENDED'].includes(status),
        [ui.statusPillLocked]: ['GRADUATED', 'DROPPED_OUT', 'SUSPENDED', 'RESIGNED', 'TERMINATED'].includes(status)
    });
};

export function UserManagementPage() {
    const currentUser = useAuthStore((state) => state.user);
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedActor = searchParams.get('actor') ?? 'ALL';
    const [accounts, setAccounts] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [keyword, setKeyword] = useState('');
    const [accountStatusFilter, setAccountStatusFilter] = useState('ALL');
    const [lifecycleStatusFilter, setLifecycleStatusFilter] = useState('ALL');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    const [isLoading, setIsLoading] = useState(false);
    const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(false);
    const [modalMode, setModalMode] = useState(null);
    const [creationMethodOpen, setCreationMethodOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [statusAccount, setStatusAccount] = useState(null);
    const [statusValue, setStatusValue] = useState('ACTIVE');
    const [importRole, setImportRole] = useState(userRoles.STUDENT);
    const [importFile, setImportFile] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const creatableActorOptions = useMemo(() => {
        const allowedRoles = managedUserRolesByRole[currentUser?.role] ?? [];
        return actorOptions.filter((actor) => allowedRoles.includes(actor.value));
    }, [currentUser?.role]);

    const canManageAccounts = creatableActorOptions.length > 0;
    const accountTableColumnCount = canManageAccounts ? 8 : 7;

    const visibleActorOptions = useMemo(() => {
        const visibleRoles = visibleUserRolesByRole[currentUser?.role] ?? [];
        const visibleActors = actorOptions.filter((actor) => visibleRoles.includes(actor.value));

        return visibleActors.length ? [actorOptions[0], ...visibleActors] : visibleActors;
    }, [currentUser?.role]);

    const canImportUsers = currentUser?.role === userRoles.HR;

    const queryParams = useMemo(() => {
        const params = {
            page,
            limit: pageSize
        };
        const search = keyword.trim();

        if (search) params.search = search;
        if (selectedActor !== 'ALL') params.role = selectedActor;
        if (accountStatusFilter !== 'ALL') params.status = accountStatusFilter;
        if (lifecycleStatusFilter !== 'ALL' && selectedActor === userRoles.STUDENT) {
            params.studentStatus = lifecycleStatusFilter;
        }
        if (lifecycleStatusFilter !== 'ALL' && selectedActor !== 'ALL' && selectedActor !== userRoles.STUDENT) {
            params.employmentStatus = lifecycleStatusFilter;
        }

        return params;
    }, [accountStatusFilter, keyword, lifecycleStatusFilter, page, pageSize, selectedActor]);

    const filteredAccounts = useMemo(() => {
        const normalizedKeyword = keyword.trim().toLowerCase();

        return accounts.filter((account) => {
            const matchActor = selectedActor === 'ALL' || account.role === selectedActor;
            const matchAccountStatus = accountStatusFilter === 'ALL' || account.status === accountStatusFilter;
            const matchLifecycleStatus = lifecycleStatusFilter === 'ALL' || getLifecycleStatusValue(account) === lifecycleStatusFilter;
            const matchKeyword =
                !normalizedKeyword ||
                [account.fullName, account.email, account.code, roleLabels[account.role], account.department?.name, account.department?.code]
                    .filter(Boolean)
                    .some((value) => value.toLowerCase().includes(normalizedKeyword));

            return matchActor && matchAccountStatus && matchLifecycleStatus && matchKeyword;
        });
    }, [accountStatusFilter, accounts, keyword, lifecycleStatusFilter, selectedActor]);

    const loadAccounts = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await userAccountsApi.list(queryParams);
            setAccounts(data.items);
            setPagination(data.meta);
            setSelectedAccount((current) => {
                if (!current) return current;
                return data.items.find((account) => (account.publicId ?? account.id) === (current.publicId ?? current.id)) ?? current;
            });
        } catch (error) {
            toast.error(getApiMessage(error, 'Không lấy được danh sách tài khoản'));
        } finally {
            setIsLoading(false);
        }
    }, [queryParams]);

    const loadDepartments = useCallback(async () => {
        setIsDepartmentsLoading(true);
        try {
            const result = await adminModulesApi.listDepartments();
            const items = Array.isArray(result) ? result : (result?.items ?? result?.data ?? []);
            setDepartments(items);
        } catch (error) {
            toast.error(getApiMessage(error, 'Không lấy được danh sách phòng ban'));
        } finally {
            setIsDepartmentsLoading(false);
        }
    }, []);

    useEffect(() => {
        const task = window.setTimeout(() => {
            loadAccounts();
        }, 0);

        return () => window.clearTimeout(task);
    }, [loadAccounts]);

    useEffect(() => {
        const task = window.setTimeout(loadDepartments, 0);
        return () => window.clearTimeout(task);
    }, [loadDepartments]);

    useEffect(() => {
        if (!visibleActorOptions.length) return;
        if (visibleActorOptions.some((actor) => actor.value === selectedActor)) return;

        const fallbackActor = visibleActorOptions[0].value;
        if (fallbackActor === 'ALL') {
            setSearchParams({});
            return;
        }
        setSearchParams({ actor: fallbackActor });
    }, [selectedActor, setSearchParams, visibleActorOptions]);

    const getDefaultCreatableRole = () => {
        const selectedRoleAllowed = creatableActorOptions.some((actor) => actor.value === selectedActor);
        return selectedRoleAllowed ? selectedActor : (creatableActorOptions[0]?.value ?? userRoles.STUDENT);
    };

    const openCreateEntry = () => {
        if (canImportUsers) {
            setCreationMethodOpen(true);
            return;
        }

        openCreateModal();
    };

    const openCreateModal = () => {
        const defaultRole = getDefaultCreatableRole();
        setForm({ ...emptyForm, role: defaultRole });
        setEditingAccount(null);
        setModalMode('create');
    };

    const openImportModal = () => {
        setImportRole(getDefaultCreatableRole());
        setImportFile(null);
        setCreationMethodOpen(false);
        setModalMode('import');
    };

    const openUpdateModal = (account) => {
        setForm({
            fullName: account.fullName,
            email: account.email,
            phone: account.phone ?? '',
            role: account.role,
            departmentPublicId: account.department?.publicId ?? ''
        });
        setEditingAccount(account);
        setModalMode('update');
    };

    const openStatusModal = (account) => {
        const isStudent = account.role === userRoles.STUDENT;
        const defaultValue = isStudent
            ? (account.studentStatus ?? studentStatusOptions[0].value)
            : (account.employmentStatus ?? employmentStatusOptions[0].value);

        setStatusAccount(account);
        setStatusValue(defaultValue);
    };

    const closeFormModal = () => {
        setModalMode(null);
        setEditingAccount(null);
        setForm(emptyForm);
        setImportFile(null);
        setIsImporting(false);
    };

    const closeDetailModal = () => {
        setSelectedAccount(null);
    };

    const closeStatusModal = () => {
        setStatusAccount(null);
        setStatusValue('');
    };

    const handleActorChange = (event) => {
        const actor = event.target.value;
        setPage(1);
        if (actor === 'ALL') {
            setSearchParams({});
            return;
        }
        setSearchParams({ actor });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!isValidPhone(form.phone)) {
            toast.error('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09');
            return;
        }

        try {
            if (modalMode === 'create') {
                await userAccountsApi.create(form);
                toast.success('Đã tạo tài khoản');
            } else {
                await userAccountsApi.update(editingAccount.publicId ?? editingAccount.id, form);
                toast.success('Đã cập nhật tài khoản');
            }

            closeFormModal();
            await loadAccounts();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không lưu được tài khoản'));
        }
    };

    const handleImportSubmit = async (event) => {
        event.preventDefault();

        if (!importFile) {
            toast.error('Vui lòng chọn file CSV');
            return;
        }

        setIsImporting(true);
        try {
            const content = await importFile.text();
            const rows = parseUserCsv(content);

            if (!rows.length) {
                toast.error('File import chưa có dữ liệu hợp lệ');
                return;
            }

            const allowedRoles = creatableActorOptions.map((actor) => actor.value);
            const importPayloads = rows.map((row) => ({ ...row, role: row.role || importRole }));
            const invalidRowIndex = importPayloads.findIndex((row) => !allowedRoles.includes(row.role));
            const invalidPhoneRowIndex = importPayloads.findIndex((row) => !isValidPhone(row.phone));

            if (invalidRowIndex >= 0) {
                toast.error(`Dòng ${invalidRowIndex + 2} có actor không hợp lệ hoặc vượt quyền tạo`);
                return;
            }

            if (invalidPhoneRowIndex >= 0) {
                toast.error(`Dòng ${invalidPhoneRowIndex + 2} có số điện thoại không hợp lệ`);
                return;
            }

            await Promise.all(importPayloads.map((row) => userAccountsApi.create(row)));
            toast.success(`Đã import ${rows.length} tài khoản`);
            closeFormModal();
            await loadAccounts();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : getApiMessage(error, 'Không import được danh sách tài khoản'));
        } finally {
            setIsImporting(false);
        }
    };

    const handleExportAccounts = () => {
        if (!filteredAccounts.length) {
            toast.error('Không có dữ liệu để xuất');
            return;
        }

        const selectedActorLabel = actorOptions.find((actor) => actor.value === selectedActor)?.label ?? selectedActor;
        const today = new Intl.DateTimeFormat('en-CA').format(new Date());
        const rows = [
            ['Họ tên', 'Email', 'Số điện thoại', 'Actor', 'Mã người dùng', 'Trạng thái tài khoản', 'Trạng thái học tập/công tác', 'Đăng nhập gần nhất'],
            ...filteredAccounts.map((account) => [
                account.fullName,
                account.email,
                account.phone || '',
                roleLabels[account.role] ?? account.role,
                account.code || 'Tự sinh',
                getStatusLabel(account.status),
                getLifecycleStatusLabel(account),
                account.lastLoginAt ? formatDateTime(account.lastLoginAt) : 'Chưa đăng nhập'
            ])
        ];

        downloadCsvFile(`danh-sach-nguoi-dung-${selectedActorLabel}-${today}.csv`, rows);
        toast.success(`Đã xuất ${filteredAccounts.length} tài khoản`);
    };

    const handleToggleLock = async (account) => {
        try {
            await userAccountsApi.toggleLock(account);
            toast.success(account.status === 'LOCKED' ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản');
            await loadAccounts();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không đổi được trạng thái tài khoản'));
        }
    };

    const handleChangeStatus = async (event) => {
        event.preventDefault();

        if (!statusAccount) return;

        try {
            if (statusAccount.role === userRoles.STUDENT) {
                await userAccountsApi.changeStudentStatus(statusAccount, statusValue);
            } else {
                await userAccountsApi.changeEmploymentStatus(statusAccount, statusValue);
            }

            toast.success('Đã cập nhật trạng thái');
            closeStatusModal();
            await loadAccounts();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không cập nhật được trạng thái'));
        }
    };

    const handleDelete = async (account) => {
        const confirmMessage =
            account.status === 'PENDING'
                ? `Xóa vĩnh viễn tài khoản mới tạo ${account.fullName}? Nếu tài khoản đã phát sinh dữ liệu, BE sẽ từ chối xóa vĩnh viễn.`
                : account.role === userRoles.STUDENT
                    ? `Xóa vĩnh viễn sinh viên ${account.fullName}? Tài khoản ACTIVE vẫn có thể xóa nếu chưa đăng ký lớp, làm bài hoặc phát sinh tiến độ học.`
                    : `Tài khoản ${account.fullName} đã kích hoạt hoặc có thể đã phát sinh dữ liệu. Nếu BE không cho xóa vĩnh viễn, hệ thống sẽ chuyển sang cập nhật trạng thái.`;

        if (!window.confirm(confirmMessage)) return;

        try {
            const result = await userAccountsApi.remove(account.publicId ?? account.id);
            toast.success(result?.message ?? (result?.permanentlyDeleted ? 'Đã xóa vĩnh viễn tài khoản' : 'Đã cập nhật trạng thái tài khoản'));
            closeDetailModal();
            await loadAccounts();
        } catch (error) {
            const relatedData = error?.response?.data?.relatedData ?? error?.response?.data?.error?.relatedData;
            const message = getApiMessage(error, 'Không xóa được tài khoản');
            toast.error(relatedData?.length ? `${message}. Dữ liệu liên quan: ${relatedData.join(', ')}` : message);
            openStatusModal(account);
        }
    };

    const handleResetPassword = async (account) => {
        try {
            await userAccountsApi.resetPassword(account);
            toast.success('Đã gửi yêu cầu đặt lại mật khẩu');
        } catch (error) {
            toast.error(getApiMessage(error, 'API đặt lại mật khẩu chưa sẵn sàng hoặc không thành công'));
        }
    };

    const handleRowAction = async (event, account) => {
        const action = event.target.value;
        event.target.value = '';

        if (!action) return;
        if (action === 'detail') setSelectedAccount(account);
        if (action === 'edit') openUpdateModal(account);
        if (action === 'change-status') openStatusModal(account);
        if (action === 'reset') await handleResetPassword(account);
        if (action === 'toggle-lock') await handleToggleLock(account);
        if (action === 'delete') await handleDelete(account);
    };

    const renderAccountActions = (account) => (
        <div className={styles.detailActions}>
            <button className={ui.secondaryButton} type="button" onClick={() => openUpdateModal(account)}>
                <FiEdit2 /> Cập nhật
            </button>
            <button className={ui.secondaryButton} type="button" onClick={() => handleResetPassword(account)}>
                <FiRefreshCcw /> Đặt lại mật khẩu
            </button>
            <button className={ui.secondaryButton} type="button" onClick={() => openStatusModal(account)}>
                <FiActivity /> Thay đổi học tập/công tác
            </button>
            <button className={ui.secondaryButton} type="button" onClick={() => handleToggleLock(account)}>
                {account.status === 'LOCKED' ? <FiUnlock /> : <FiLock />}
                {account.status === 'LOCKED' ? 'Mở khóa' : 'Khóa tài khoản'}
            </button>
            <button className={classNames(ui.secondaryButton, ui.dangerButton)} type="button" onClick={() => handleDelete(account)}>
                <FiTrash2 /> Xóa
            </button>
        </div>
    );

    const currentPage = pagination.page || page;
    const totalPages = Math.max(1, pagination.totalPages || 1);
    const firstRecord = pagination.total ? (currentPage - 1) * pagination.limit + 1 : 0;
    const lastRecord = pagination.total ? Math.min(currentPage * pagination.limit, pagination.total) : 0;

    return (
        <div className={classNames(ui.pageStack, styles.page)}>
            <section className={ui.moduleHeader}>
                <div className={ui.moduleHeaderIcon}>
                    <FiShield />
                </div>
                <div>
                    <p className={ui.eyebrow}>Quản lý tài khoản</p>
                    <h2>Danh sách người dùng theo actor</h2>
                    <p>{canManageAccounts ? 'Tạo, cập nhật, khóa/mở khóa và theo dõi tài khoản người dùng.' : 'Theo dõi thông tin tài khoản người dùng.'}</p>
                </div>
            </section>

            <section className={styles.toolbar}>
                <label className={ui.field}>
                    Actor
                    <select className={ui.plainInput} value={selectedActor} onChange={handleActorChange}>
                        {visibleActorOptions.map((actor) => (
                            <option key={actor.value} value={actor.value}>
                                {actor.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={classNames(ui.field, styles.toolbarSearch)}>
                    Tìm kiếm
                    <span className={ui.inputControl}>
                        <FiSearch />
                        <input
                            value={keyword}
                            onChange={(event) => {
                                setKeyword(event.target.value);
                                setPage(1);
                            }}
                            placeholder="Tên, email, mã hoặc vai trò"
                            type="search"
                        />
                    </span>
                </label>
                <label className={ui.field}>
                    Trạng thái tài khoản
                    <select
                        className={ui.plainInput}
                        value={accountStatusFilter}
                        onChange={(event) => {
                            setAccountStatusFilter(event.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="ALL">Tất cả</option>
                        {accountStatusOptions.map((status) => (
                            <option key={status.value} value={status.value}>
                                {status.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={ui.field}>
                    Học tập / Công tác
                    <select
                        className={ui.plainInput}
                        value={lifecycleStatusFilter}
                        onChange={(event) => {
                            setLifecycleStatusFilter(event.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="ALL">Tất cả</option>
                        {lifecycleStatusOptions.map((status) => (
                            <option key={status.value} value={status.value}>
                                {status.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={ui.field}>
                    Số dòng
                    <select
                        className={ui.plainInput}
                        value={pageSize}
                        onChange={(event) => {
                            setPageSize(Number(event.target.value));
                            setPage(1);
                        }}
                    >
                        {[10, 20, 50, 100].map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </label>
                <div className={styles.toolbarActions}>
                    <button className={ui.secondaryButton} type="button" onClick={loadAccounts} disabled={isLoading}>
                        <FiRefreshCcw /> Tải lại
                    </button>
                    <button className={ui.secondaryButton} type="button" onClick={handleExportAccounts} disabled={isLoading || filteredAccounts.length === 0}>
                        <FiDownload /> Xuất danh sách
                    </button>
                    {canManageAccounts ? (
                        <button className={ui.primaryButton} type="button" onClick={openCreateEntry}>
                            <FiUserPlus /> Tạo người dùng
                        </button>
                    ) : null}
                </div>
            </section>

            <section className={ui.tablePanel}>
                <div className={ui.sectionHeading}>
                    <div>
                        <p className={ui.eyebrow}>Dữ liệu thật</p>
                        <h3>{pagination.total} tài khoản</h3>
                    </div>
                </div>

                <div className={ui.responsiveTable}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Mã</th>
                                <th>Người dùng</th>
                                <th>Actor</th>
                                <th>Phòng ban</th>
                                <th>Trạng thái tài khoản</th>
                                <th>Học tập / Công tác</th>
                                <th>Đăng nhập gần nhất</th>
                                {canManageAccounts ? <th>Thao tác</th> : null}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAccounts.map((account) => (
                                <tr
                                    className={styles.row}
                                    key={account.publicId ?? account.id ?? account.email}
                                    tabIndex={0}
                                    onClick={() => setSelectedAccount(account)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') setSelectedAccount(account);
                                    }}
                                >
                                    <td>{account.code || 'Tự sinh'}</td>
                                    <td>
                                        <strong>{account.fullName}</strong>
                                        <span>{account.email}</span>
                                    </td>
                                    <td>{roleLabels[account.role] ?? account.role}</td>
                                    <td>{account.department?.name ?? 'Chưa gán'}</td>
                                    <td>
                                        <span className={getAccountStatusPillClass(account.status)}>
                                            {getStatusLabel(account.status)}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={getLifecycleStatusPillClass(account)}>
                                            {getLifecycleStatusLabel(account)}
                                        </span>
                                    </td>
                                    <td>{formatDateTime(account.lastLoginAt)}</td>
                                    {canManageAccounts ? (
                                        <td>
                                            <select
                                                className={styles.actionDropdown}
                                                defaultValue=""
                                                onChange={(event) => handleRowAction(event, account)}
                                                onClick={(event) => event.stopPropagation()}
                                            >
                                                <option value="" disabled>
                                                    Chọn thao tác
                                                </option>
                                                <option value="detail">Xem chi tiết</option>
                                                <option value="edit">Cập nhật</option>
                                                <option value="change-status">Thay đổi học tập/công tác</option>
                                                <option value="reset">Đặt lại mật khẩu</option>
                                                <option value="toggle-lock">{account.status === 'LOCKED' ? 'Mở khóa' : 'Khóa tài khoản'}</option>
                                                <option value="delete">Xóa</option>
                                            </select>
                                        </td>
                                    ) : null}
                                </tr>
                            ))}
                            {!isLoading && filteredAccounts.length === 0 ? (
                                <tr>
                                    <td colSpan={accountTableColumnCount} className={styles.emptyCell}>
                                        Không có tài khoản phù hợp.
                                    </td>
                                </tr>
                            ) : null}
                            {isLoading ? (
                                <tr>
                                    <td colSpan={accountTableColumnCount} className={styles.emptyCell}>
                                        Đang tải danh sách tài khoản...
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>

                <div className={styles.pagination}>
                    <span>
                        Hiển thị {firstRecord}-{lastRecord} / {pagination.total}
                    </span>
                    <div className={styles.paginationControls}>
                        <button className={ui.secondaryButton} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={isLoading || currentPage <= 1}>
                            <FiChevronLeft /> Trang trước
                        </button>
                        <strong>
                            Trang {currentPage} / {totalPages}
                        </strong>
                        <button
                            className={ui.secondaryButton}
                            type="button"
                            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                            disabled={isLoading || currentPage >= totalPages}
                        >
                            Trang sau <FiChevronRight />
                        </button>
                    </div>
                </div>
            </section>

            {selectedAccount ? (
                <ModalBackdrop onClose={closeDetailModal}>
                    <article className={classNames(ui.modal, styles.detailModal)}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>Chi tiết tài khoản</p>
                                <h3>{selectedAccount.fullName}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={closeDetailModal} aria-label="Đóng">
                                <FiX />
                            </button>
                        </div>

                        <div className={styles.detailGrid}>
                            <div>
                                <span>Mã người dùng</span>
                                <strong>{selectedAccount.code || 'Tự sinh'}</strong>
                            </div>
                            <div>
                                <span>Email</span>
                                <strong>{selectedAccount.email}</strong>
                            </div>
                            <div>
                                <span>Số điện thoại</span>
                                <strong>{selectedAccount.phone || 'Chưa cập nhật'}</strong>
                            </div>
                            <div>
                                <span>Actor</span>
                                <strong>{roleLabels[selectedAccount.role] ?? selectedAccount.role}</strong>
                            </div>
                            <div>
                                <span>Phòng ban / Bộ môn</span>
                                <strong>{selectedAccount.department ? `${selectedAccount.department.code} - ${selectedAccount.department.name}` : 'Chưa gán'}</strong>
                            </div>
                            <div>
                                <span>Trạng thái tài khoản</span>
                                <strong>{getStatusLabel(selectedAccount.status)}</strong>
                            </div>
                            <div>
                                <span>{selectedAccount.role === userRoles.STUDENT ? 'Trạng thái học tập' : 'Trạng thái công tác'}</span>
                                <strong>
                                    {selectedAccount.role === userRoles.STUDENT
                                        ? getStudentStatusLabel(selectedAccount.studentStatus)
                                        : getEmploymentStatusLabel(selectedAccount.employmentStatus)}
                                </strong>
                            </div>
                            <div>
                                <span>Đăng nhập gần nhất</span>
                                <strong>{formatDateTime(selectedAccount.lastLoginAt)}</strong>
                            </div>
                        </div>

                        {canManageAccounts ? renderAccountActions(selectedAccount) : null}
                    </article>
                </ModalBackdrop>
            ) : null}

            {canManageAccounts && statusAccount ? (
                <ModalBackdrop onClose={closeStatusModal}>
                    <form className={ui.modal} onSubmit={handleChangeStatus}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>{statusAccount.role === userRoles.STUDENT ? 'Trạng thái học tập' : 'Trạng thái công tác'}</p>
                                <h3>{statusAccount.fullName}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={closeStatusModal} aria-label="Đóng">
                                <FiX />
                            </button>
                        </div>

                        <div className={styles.statusPreview}>
                            <span>{statusAccount.role === userRoles.STUDENT ? 'Trạng thái học tập hiện tại' : 'Trạng thái công tác hiện tại'}</span>
                            <strong>
                                {statusAccount.role === userRoles.STUDENT
                                    ? getStudentStatusLabel(statusAccount.studentStatus)
                                    : getEmploymentStatusLabel(statusAccount.employmentStatus)}
                            </strong>
                        </div>

                        <label className={ui.field}>
                            {statusAccount.role === userRoles.STUDENT ? 'Trạng thái học tập mới' : 'Trạng thái công tác mới'}
                            <select className={ui.plainInput} value={statusValue} onChange={(event) => setStatusValue(event.target.value)}>
                                {(statusAccount.role === userRoles.STUDENT ? studentStatusOptions : employmentStatusOptions).map((status) => (
                                    <option key={status.value} value={status.value}>
                                        {status.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className={ui.modalFooter}>
                            <button className={ui.secondaryButton} type="button" onClick={closeStatusModal}>
                                Hủy
                            </button>
                            <button
                                className={ui.primaryButton}
                                type="submit"
                                disabled={statusValue === (statusAccount.role === userRoles.STUDENT ? statusAccount.studentStatus : statusAccount.employmentStatus)}
                            >
                                <FiActivity /> Cập nhật trạng thái
                            </button>
                        </div>
                    </form>
                </ModalBackdrop>
            ) : null}

            {canManageAccounts && creationMethodOpen ? (
                <ModalBackdrop onClose={() => setCreationMethodOpen(false)}>
                    <article className={ui.modal}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>Tạo tài khoản</p>
                                <h3>Chọn phương thức tạo người dùng</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={() => setCreationMethodOpen(false)} aria-label="Đóng">
                                <FiX />
                            </button>
                        </div>

                        <div className={styles.creationOptions}>
                            <button
                                className={styles.creationOption}
                                type="button"
                                onClick={() => {
                                    setCreationMethodOpen(false);
                                    openCreateModal();
                                }}
                            >
                                <FiUserPlus />
                                <strong>Tạo thủ công</strong>
                                <span>Nhập thông tin từng người dùng.</span>
                            </button>
                            <button className={styles.creationOption} type="button" onClick={openImportModal}>
                                <FiUpload />
                                <strong>Import danh sách</strong>
                                <span>Tải lên file CSV gồm họ tên, email và số điện thoại.</span>
                            </button>
                        </div>
                    </article>
                </ModalBackdrop>
            ) : null}

            {canManageAccounts && modalMode === 'import' ? (
                <ModalBackdrop onClose={closeFormModal}>
                    <form className={ui.modal} onSubmit={handleImportSubmit}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>Import danh sách</p>
                                <h3>Tạo người dùng từ file CSV</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={closeFormModal} aria-label="Đóng">
                                <FiX />
                            </button>
                        </div>

                        <div className={ui.modalGrid}>
                            <label className={ui.field}>
                                Actor
                                <select className={ui.plainInput} value={importRole} onChange={(event) => setImportRole(event.target.value)}>
                                    {creatableActorOptions.map((actor) => (
                                        <option key={actor.value} value={actor.value}>
                                            {actor.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className={ui.field}>
                                File CSV
                                <input
                                    className={ui.plainInput}
                                    type="file"
                                    accept=".csv,text/csv"
                                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                                    required
                                />
                            </label>
                        </div>

                        <div className={styles.importHint}>
                            <FiFileText />
                            <span>Header hợp lệ: Họ tên, Email, Số điện thoại, Actor. Nếu file không có Actor, hệ thống sẽ dùng actor đang chọn.</span>
                        </div>

                        <div className={ui.modalFooter}>
                            <button className={ui.secondaryButton} type="button" onClick={closeFormModal} disabled={isImporting}>
                                Hủy
                            </button>
                            <button className={ui.primaryButton} type="submit" disabled={isImporting || !importFile}>
                                <FiUpload /> {isImporting ? 'Đang import...' : 'Import danh sách'}
                            </button>
                        </div>
                    </form>
                </ModalBackdrop>
            ) : null}

            {canManageAccounts && modalMode && modalMode !== 'import' ? (
                <ModalBackdrop onClose={closeFormModal}>
                    <form className={ui.modal} onSubmit={handleSubmit}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>{modalMode === 'create' ? 'Tạo mới' : 'Cập nhật'}</p>
                                <h3>{modalMode === 'create' ? 'Tạo người dùng' : 'Cập nhật người dùng'}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={closeFormModal} aria-label="Đóng">
                                <FiX />
                            </button>
                        </div>

                        <div className={ui.modalGrid}>
                            <label className={ui.field}>
                                Họ và tên
                                <input
                                    className={ui.plainInput}
                                    value={form.fullName}
                                    onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                                    required
                                />
                            </label>
                            <label className={ui.field}>
                                Email
                                <input
                                    className={ui.plainInput}
                                    type="email"
                                    value={form.email}
                                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                                    required
                                />
                            </label>
                            <label className={ui.field}>
                                Số điện thoại
                                <input
                                    className={ui.plainInput}
                                    type="tel"
                                    inputMode="numeric"
                                    maxLength={10}
                                    pattern="0[35789][0-9]{8}"
                                    placeholder="Ví dụ: 0912345678"
                                    title="Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09"
                                    value={form.phone}
                                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))}
                                />
                            </label>
                            {modalMode === 'create' ? (
                                <label className={ui.field}>
                                    Actor
                                    <select className={ui.plainInput} value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
                                        {creatableActorOptions.map((actor) => (
                                            <option key={actor.value} value={actor.value}>
                                                {actor.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : null}
                            <label className={ui.field}>
                                Phòng ban / Bộ môn
                                <select
                                    className={ui.plainInput}
                                    value={form.departmentPublicId}
                                    onChange={(event) => setForm((current) => ({ ...current, departmentPublicId: event.target.value }))}
                                    disabled={isDepartmentsLoading}
                                >
                                    <option value="" disabled={modalMode === 'update' && Boolean(editingAccount?.department)}>
                                        Chưa gán phòng ban
                                    </option>
                                    {departments.map((department) => (
                                        <option key={department.publicId} value={department.publicId}>
                                            {department.code} - {department.name}{department.isActive === false ? ' (Ngừng hoạt động)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className={ui.modalFooter}>
                            <button className={ui.secondaryButton} type="button" onClick={closeFormModal}>
                                Hủy
                            </button>
                            <button className={ui.primaryButton} type="submit">
                                <FiPlus /> {modalMode === 'create' ? 'Tạo tài khoản' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </form>
                </ModalBackdrop>
            ) : null}
        </div>
    );
}
