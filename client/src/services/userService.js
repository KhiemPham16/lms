import { axiosInstance as api } from '~/lib/axios';

export const userService = {
    getUsers: async (params = {}) => {
        const res = await api.get('/users', { params });
        return res.data;
    },

    createUser: async (payload) => {
        const res = await api.post('/users', payload);
        return res.data;
    },

    updateUser: async (publicId, payload) => {
        const res = await api.patch(`/users/${publicId}`, payload);
        return res.data;
    },

    updateUserStatus: async (publicId, status) => {
        const res = await api.patch(`/users/${publicId}/status`, { status });
        return res.data;
    }
};
