import { create } from 'zustand';
import { toast } from 'sonner';

import { userService } from '~/services/userService';

const defaultFilters = {
    role: '',
    status: '',
    departmentId: '',
    createdBy: '',
    createdFrom: '',
    createdTo: '',
    emailVerified: '',
    roleAssigned: ''
};

const defaultSummary = {
    total: 0,
    active: 0,
    pending: 0,
    locked: 0,
    newThisMonth: 0,
    unassignedRole: 0,
    trends: {}
};

const getItems = (payload) => payload?.items || payload?.data?.items || [];
const getMeta = (payload) => payload?.meta || payload?.data?.meta || {};
const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;
const getTotal = (payload) => Number(getMeta(payload).total || 0);

const buildParams = (state) => ({
    page: state.pagination.page,
    limit: state.pagination.limit,
    keyword: state.search || undefined,
    role: state.filters.role || undefined,
    status: state.filters.status || undefined,
    departmentId: state.filters.departmentId || undefined,
    createdBy: state.filters.createdBy || undefined,
    createdFrom: state.filters.createdFrom || undefined,
    createdTo: state.filters.createdTo || undefined,
    emailVerified: state.filters.emailVerified || undefined,
    roleAssigned: state.filters.roleAssigned || undefined
});

export const useUserManagementStore = create((set, get) => ({
    users: [],
    summary: defaultSummary,
    filters: defaultFilters,
    search: '',
    pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1
    },
    selectedUserIds: [],
    loading: false,
    detailLoading: false,
    submitting: false,
    error: null,
    currentUserDetail: null,
    userActivities: [],

    fetchUsers: async (params = {}) => {
        set({ loading: true, error: null });
        try {
            const state = get();
            const payload = await userService.getUsers({ ...buildParams(state), ...params });
            const meta = getMeta(payload);

            set({
                users: getItems(payload),
                pagination: {
                    page: Number(meta.page || params.page || state.pagination.page || 1),
                    limit: Number(meta.limit || params.limit || state.pagination.limit || 20),
                    total: Number(meta.total || 0),
                    totalPages: Number(meta.totalPages || 1)
                },
                selectedUserIds: []
            });
        } catch (error) {
            set({
                users: [],
                error: getErrorMessage(error, 'Không thể tải danh sách người dùng')
            });
        } finally {
            set({ loading: false });
        }
    },

    fetchSummary: async (params = {}) => {
        try {
            const state = get();
            const summary = await userService.getUserSummary({ ...buildParams(state), ...params });
            set({ summary: { ...defaultSummary, ...summary } });
        } catch {
            const state = get();
            const baseParams = {
                keyword: state.search || undefined,
                role: state.filters.role || undefined,
                departmentId: state.filters.departmentId || undefined,
                page: 1,
                limit: 1
            };

            const safeCount = (extraParams = {}) =>
                userService.getUsers({ ...baseParams, ...extraParams })
                    .then(getTotal)
                    .catch(() => 0);

            const [total, active, locked, inactive] = await Promise.all([
                safeCount(),
                safeCount({ status: 'ACTIVE' }),
                safeCount({ status: 'LOCKED' }),
                safeCount({ status: 'INACTIVE' })
            ]);

            set({
                summary: {
                    ...defaultSummary,
                    total,
                    active,
                    locked,
                    pending: inactive,
                    trends: {
                        total: '+0%',
                        active: '+0%',
                        pending: '0%',
                        locked: '0%',
                        newThisMonth: '0%',
                        unassignedRole: '0%'
                    }
                }
            });
        }
    },

    setSearch: (search) => {
        set((state) => ({
            search,
            pagination: { ...state.pagination, page: 1 }
        }));
    },

    setFilters: (filters) => {
        set((state) => ({
            filters: { ...state.filters, ...filters },
            pagination: { ...state.pagination, page: 1 }
        }));
    },

    resetFilters: () => {
        set((state) => ({
            search: '',
            filters: defaultFilters,
            pagination: { ...state.pagination, page: 1 }
        }));
    },

    setPage: (page) => {
        set((state) => ({
            pagination: { ...state.pagination, page: Math.max(1, page) }
        }));
    },

    setLimit: (limit) => {
        set((state) => ({
            pagination: { ...state.pagination, page: 1, limit: Number(limit) }
        }));
    },

    selectUser: (id) => {
        set((state) => ({
            selectedUserIds: state.selectedUserIds.includes(id)
                ? state.selectedUserIds.filter((item) => item !== id)
                : [...state.selectedUserIds, id]
        }));
    },

    selectAllUsers: (ids) => {
        set((state) => {
            const allSelected = ids.length > 0 && ids.every((id) => state.selectedUserIds.includes(id));
            return { selectedUserIds: allSelected ? [] : ids };
        });
    },

    clearSelection: () => set({ selectedUserIds: [] }),

    createUser: async (data) => {
        set({ submitting: true });
        try {
            await userService.createUser(data);
            toast.success('Đã tạo tài khoản người dùng');
            await get().refreshData();
            return { ok: true };
        } catch (error) {
            toast.error(getErrorMessage(error, 'Tạo tài khoản thất bại'));
            return { ok: false, error };
        } finally {
            set({ submitting: false });
        }
    },

    updateUser: async (id, data) => {
        set({ submitting: true });
        try {
            const updatedUser = await userService.updateUser(id, data);
            set((state) => ({
                users: state.users.map((user) => (user.publicId === id ? updatedUser : user)),
                currentUserDetail: state.currentUserDetail?.publicId === id ? updatedUser : state.currentUserDetail
            }));
            toast.success('Đã cập nhật người dùng');
            await get().fetchSummary();
            return { ok: true };
        } catch (error) {
            toast.error(getErrorMessage(error, 'Cập nhật người dùng thất bại'));
            return { ok: false, error };
        } finally {
            set({ submitting: false });
        }
    },

    updateUserStatus: async (id, status) => {
        set({ submitting: true });
        try {
            await userService.updateUserStatus(id, status);
            toast.success('Đã cập nhật trạng thái người dùng');
            await get().refreshData();
            return { ok: true };
        } catch (error) {
            toast.error(getErrorMessage(error, 'Cập nhật trạng thái người dùng thất bại'));
            return { ok: false, error };
        } finally {
            set({ submitting: false });
        }
    },

    lockUser: async (id, data) => {
        set({ submitting: true });
        try {
            await userService.lockUser(id, data);
            toast.success('Đã khóa tài khoản');
            await get().refreshData();
            return { ok: true };
        } catch (error) {
            toast.error(getErrorMessage(error, 'Khóa tài khoản thất bại'));
            return { ok: false, error };
        } finally {
            set({ submitting: false });
        }
    },

    unlockUser: async (id, data) => {
        set({ submitting: true });
        try {
            await userService.unlockUser(id, data);
            toast.success('Đã mở khóa tài khoản');
            await get().refreshData();
            return { ok: true };
        } catch (error) {
            toast.error(getErrorMessage(error, 'Mở khóa tài khoản thất bại'));
            return { ok: false, error };
        } finally {
            set({ submitting: false });
        }
    },

    resetPassword: async (id, data) => {
        set({ submitting: true });
        try {
            const result = await userService.resetPassword(id, data);
            toast.success('Đã xử lý đặt lại mật khẩu');
            return { ok: true, data: result };
        } catch (error) {
            toast.error(getErrorMessage(error, 'Đặt lại mật khẩu thất bại'));
            return { ok: false, error };
        } finally {
            set({ submitting: false });
        }
    },

    changeUserRole: async (id, data) => {
        set({ submitting: true });
        try {
            await userService.changeUserRole(id, data);
            toast.success('Đã thay đổi vai trò');
            await get().refreshData();
            return { ok: true };
        } catch (error) {
            toast.error(getErrorMessage(error, 'Thay đổi vai trò thất bại'));
            return { ok: false, error };
        } finally {
            set({ submitting: false });
        }
    },

    fetchUserDetail: async (id) => {
        set({ detailLoading: true, currentUserDetail: null, userActivities: [] });
        try {
            const detail = await userService.getUserById(id);
            const activities = await userService.getUserActivities(id, { page: 1, limit: 20 }).catch(() => null);
            set({
                currentUserDetail: detail,
                userActivities: activities?.items || activities?.data?.items || []
            });
        } catch (error) {
            toast.error(getErrorMessage(error, 'Không thể tải chi tiết người dùng'));
        } finally {
            set({ detailLoading: false });
        }
    },

    refreshData: async () => {
        await Promise.all([get().fetchUsers(), get().fetchSummary()]);
    }
}));
