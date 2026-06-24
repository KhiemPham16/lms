import { axiosInstance as api } from '~/lib/axios';

const unwrap = (response) => response.data?.data || response.data;
const cleanParams = (params = {}) =>
    Object.entries(params).reduce((nextParams, [key, value]) => {
        if (value === '' || value === undefined || value === null) {
            return nextParams;
        }

        nextParams[key] = value;
        return nextParams;
    }, {});

export const userService = {
    getUsers: async (params = {}) => {
        const res = await api.get('/users', { params: cleanParams(params) });
        return unwrap(res);
    },

    getUserSummary: async (params = {}) => {
        const res = await api.get('/users/summary', { params: cleanParams(params) });
        return unwrap(res);
    },

    getUserById: async (id) => {
        const res = await api.get(`/users/${id}`);
        return unwrap(res);
    },

    createUser: async (data) => {
        const res = await api.post('/users', data);
        return unwrap(res);
    },

    updateUser: async (id, data) => {
        const res = await api.patch(`/users/${id}`, data);
        return unwrap(res);
    },

    changeUserRole: async (id, data) => {
        const res = await api.patch(`/users/${id}/role`, data);
        return unwrap(res);
    },

    lockUser: async (id, data = {}) => {
        const res = await api.patch(`/users/${id}/status`, {
            ...data,
            status: 'LOCKED'
        });
        return unwrap(res);
    },

    unlockUser: async (id, data = {}) => {
        const res = await api.patch(`/users/${id}/status`, {
            ...data,
            status: 'ACTIVE'
        });
        return unwrap(res);
    },

    resetPassword: async (id, data) => {
        const res = await api.post(`/users/${id}/reset-password`, data);
        return unwrap(res);
    },

    resendActivation: async (id) => {
        const res = await api.post(`/users/${id}/resend-activation`);
        return unwrap(res);
    },

    getUserActivities: async (id, params = {}) => {
        const res = await api.get(`/users/${id}/activities`, { params: cleanParams(params) });
        return unwrap(res);
    },

    getUserLoginHistory: async (id, params = {}) => {
        const res = await api.get(`/users/${id}/login-history`, { params: cleanParams(params) });
        return unwrap(res);
    },

    bulkLockUsers: async (data) => {
        const res = await api.post('/users/bulk/lock', data);
        return unwrap(res);
    },

    bulkUnlockUsers: async (data) => {
        const res = await api.post('/users/bulk/unlock', data);
        return unwrap(res);
    },

    bulkAssignRole: async (data) => {
        const res = await api.post('/users/bulk/assign-role', data);
        return unwrap(res);
    },

    exportUsers: async (params = {}) => {
        const res = await api.get('/users/export', {
            params: cleanParams(params),
            responseType: 'blob'
        });
        return res.data;
    },

    updateUserStatus: async (id, status) => {
        const res = await api.patch(`/users/${id}/status`, { status });
        return unwrap(res);
    }
};
