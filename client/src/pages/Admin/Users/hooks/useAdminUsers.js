import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { defaultUserFilters, defaultUserMeta, emptyUserForm } from '~/config/userManagement';
import { unwrapApiPayload } from '~/lib/apiPayload';
import { userService } from '~/services/userService';

const buildUserQuery = (filters) =>
    Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );

export function useAdminUsers(currentUserPublicId, options = {}) {
    const { enabled = true } = options;
    const [users, setUsers] = useState([]);
    const [meta, setMeta] = useState(defaultUserMeta);
    const [filters, setFilters] = useState(defaultUserFilters);
    const [loading, setLoading] = useState(enabled);
    const [saving, setSaving] = useState(false);
    const [modalMode, setModalMode] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [form, setForm] = useState(emptyUserForm);

    const activeUsers = useMemo(() => users.filter((user) => user.status === 'ACTIVE').length, [users]);
    const lockedUsers = useMemo(() => users.filter((user) => user.status === 'LOCKED').length, [users]);

    const loadUsers = async (nextFilters = filters, showLoading = true) => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        try {
            if (showLoading) {
                setLoading(true);
            }

            const payload = unwrapApiPayload(await userService.getUsers(buildUserQuery(nextFilters)));
            setUsers(payload?.items || []);
            setMeta(payload?.meta || defaultUserMeta);
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.message || 'Không tải được danh sách người dùng');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        const timer = window.setTimeout(() => {
            loadUsers(defaultUserFilters, false);
        }, 0);

        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    const updateFilter = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        const nextFilters = { ...filters, page: 1 };
        setFilters(nextFilters);
        loadUsers(nextFilters);
    };

    const openCreate = (role = 'PRINCIPAL') => {
        setEditingUser(null);
        setForm({ ...emptyUserForm, role });
        setModalMode('create');
    };

    const openEdit = (user) => {
        setEditingUser(user);
        setForm({
            ...emptyUserForm,
            publicId: user.publicId,
            code: user.code || '',
            fullName: user.fullName || '',
            email: user.email || '',
            phone: user.phone || '',
            role: user.role || 'STUDENT',
            status: user.status || 'ACTIVE',
            gender: user.gender || '',
            dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
            address: user.address || '',
            departmentId: user.departmentId || ''
        });
        setModalMode('edit');
    };

    const closeModal = () => {
        setModalMode('');
        setEditingUser(null);
        setForm(emptyUserForm);
    };

    const changeForm = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const buildPayload = () => {
        const isEditingSelf = modalMode === 'edit' && editingUser?.publicId === currentUserPublicId;
        const payload = {
            code: form.code.trim(),
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            phone: form.phone?.trim() || undefined,
            role: isEditingSelf ? undefined : form.role,
            status: isEditingSelf ? undefined : form.status,
            gender: form.gender || undefined,
            dateOfBirth: form.dateOfBirth || undefined,
            address: form.address?.trim() || undefined,
            departmentId: form.departmentId ? Number(form.departmentId) : undefined
        };

        if (modalMode === 'create') {
            payload.password = form.password || '123456';
        }

        return payload;
    };

    const submitForm = async (event) => {
        event.preventDefault();
        try {
            setSaving(true);
            if (modalMode === 'create') {
                await userService.createUser(buildPayload());
                toast.success('Tạo tài khoản thành công');
            } else if (editingUser) {
                await userService.updateUser(editingUser.publicId, buildPayload());
                toast.success('Cập nhật tài khoản thành công');
            }
            closeModal();
            loadUsers(filters);
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.message || 'Lưu tài khoản không thành công');
        } finally {
            setSaving(false);
        }
    };

    const changeStatus = async (user) => {
        if (user.publicId === currentUserPublicId) {
            toast.error('Không thể thay đổi trạng thái của chính mình');
            return;
        }

        const nextStatus = user.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
        try {
            await userService.updateUserStatus(user.publicId, nextStatus);
            toast.success(nextStatus === 'LOCKED' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản');
            loadUsers(filters);
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.message || 'Cập nhật trạng thái không thành công');
        }
    };

    const changePage = (page) => {
        const nextFilters = { ...filters, page };
        setFilters(nextFilters);
        loadUsers(nextFilters);
    };

    return {
        users,
        meta,
        filters,
        loading,
        saving,
        modalMode,
        form,
        activeUsers,
        lockedUsers,
        updateFilter,
        applyFilters,
        openCreate,
        openEdit,
        closeModal,
        changeForm,
        submitForm,
        changeStatus,
        changePage
    };
}
