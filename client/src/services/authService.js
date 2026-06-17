import { axiosInstance as api } from '~/lib/axios';

export const authService = {
    login: async (email, password) => {
        const res = await api.post('/auth/login', {
            email,
            password
        });

        return res.data;
    },

    verifyEmail: async (token) => {
        const res = await api.get('/auth/verify-email', {
            params: { token }
        });

        return res.data;
    },

    logout: async () => {
        const res = await api.post('/auth/logout');
        return res.data;
    },

    refresh: async () => {
        const res = await api.post('/auth/refresh');
        return res.data;
    },

    forgotPassword: async (email) => {
        const res = await api.post('/auth/forgot-password', {
            email
        });

        return res.data;
    },

    resetPassword: async (email, otp, newPassword) => {
        const res = await api.post('/auth/reset-password', {
            email,
            otp,
            newPassword
        });

        return res.data;
    },

    fetchMe: async () => {
        const res = await api.get('/users/me');
        return res.data;
    }
};
