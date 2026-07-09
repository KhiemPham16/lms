import axiosClient, { refreshClient } from '~/config/axios';

const authService = {
    async login(data) {
        const response = await axiosClient.post('/auth/login', data);

        return response.data;
    },

    async refresh() {
        const response = await refreshClient.post('/auth/refresh');

        return response.data;
    },

    async logout() {
        const response = await axiosClient.post('/auth/logout');

        return response.data;
    },

    async forgotPassword(data) {
        const response = await axiosClient.post('/auth/forgot-password', data);

        return response.data;
    },

    async resetPassword(data) {
        const response = await axiosClient.post('/auth/reset-password', data);

        return response.data;
    },

    async activate(token) {
        const response = await axiosClient.post('/auth/activate', { token });

        return response.data;
    },

    async me() {
        const response = await axiosClient.get('/users/me');

        return response.data;
    }
};

export default authService;
