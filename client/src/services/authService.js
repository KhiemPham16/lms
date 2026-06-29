import { axiosInstance as api } from '~/lib/axios';
import { unwrapApiResponse } from '~/lib/apiPayload';

export const authService = {
    login: async (email, password) => {
        const res = await api.post('/auth/login', {
            email,
            password
        });

        return unwrapApiResponse(res);
    },

    logout: async () => {
        const res = await api.post('/auth/logout');
        return unwrapApiResponse(res);
    },

    refresh: async () => {
        const res = await api.post('/auth/refresh');
        return unwrapApiResponse(res);
    },

    forgotPassword: async (email) => {
        const res = await api.post('/auth/forgot-password', {
            email
        });

        return unwrapApiResponse(res);
    },

    resetPassword: async (email, otp, newPassword) => {
        const res = await api.post('/auth/reset-password', {
            email,
            otp,
            newPassword
        });

        return unwrapApiResponse(res);
    },

    fetchMe: async () => {
        const res = await api.get('/users/me');
        return unwrapApiResponse(res);
    }
};
