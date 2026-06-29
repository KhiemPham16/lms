import { axiosInstance as api } from '~/lib/axios';
import { unwrapApiResponse } from '~/lib/apiPayload';

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
        return unwrapApiResponse(res);
    },

    getUserSummary: async (params = {}) => {
        const res = await api.get('/users/summary', { params: cleanParams(params) });
        return unwrapApiResponse(res);
    },

    getUserById: async (id) => {
        const res = await api.get(`/users/${id}`);
        return unwrapApiResponse(res);
    },

    createUser: async (data) => {
        const res = await api.post('/users', data);
        return unwrapApiResponse(res);
    },

    updateUser: async (id, data) => {
        const res = await api.patch(`/users/${id}`, data);
        return unwrapApiResponse(res);
    },

    changeUserRole: async (id, data) => {
        const res = await api.patch(`/users/${id}/role`, data);
        return unwrapApiResponse(res);
    },

    lockUser: async (id, data = {}) => {
        const res = await api.patch(`/users/${id}/status`, {
            ...data,
            status: 'LOCKED'
        });
        return unwrapApiResponse(res);
    },

    unlockUser: async (id, data = {}) => {
        const res = await api.patch(`/users/${id}/status`, {
            ...data,
            status: 'ACTIVE'
        });
        return unwrapApiResponse(res);
    },

    deactivateUser: async (id, data = {}) => {
        const res = await api.patch(`/users/${id}/status`, {
            ...data,
            status: 'INACTIVE'
        });
        return unwrapApiResponse(res);
    },

    activateUser: async (id, data = {}) => {
        const res = await api.patch(`/users/${id}/status`, {
            ...data,
            status: 'ACTIVE'
        });
        return unwrapApiResponse(res);
    },

    resetPassword: async (id, data) => {
        const res = await api.post(`/users/${id}/reset-password`, data);
        return unwrapApiResponse(res);
    },

    resendActivation: async (id) => {
        const res = await api.post(`/users/${id}/resend-activation`);
        return unwrapApiResponse(res);
    },

    getUserActivities: async (id, params = {}) => {
        const res = await api.get(`/users/${id}/activities`, { params: cleanParams(params) });
        return unwrapApiResponse(res);
    },

    getUserLoginHistory: async (id, params = {}) => {
        const res = await api.get(`/users/${id}/login-history`, { params: cleanParams(params) });
        return unwrapApiResponse(res);
    },

    bulkLockUsers: async (data) => {
        const res = await api.post('/users/bulk/lock', data);
        return unwrapApiResponse(res);
    },

    bulkUnlockUsers: async (data) => {
        const res = await api.post('/users/bulk/unlock', data);
        return unwrapApiResponse(res);
    },

    bulkAssignRole: async (data) => {
        const res = await api.post('/users/bulk/assign-role', data);
        return unwrapApiResponse(res);
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
        return unwrapApiResponse(res);
    }
};
