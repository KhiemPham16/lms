import axios from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '~/stores/useAuthStore';

export const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL + '/api/v1',
    withCredentials: true
});

axiosInstance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

let refreshPromise = null;

const publicAuthRoutes = [
    '/auth/login',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password'
];

axiosInstance.interceptors.response.use(
    (res) => res,
    async (err) => {
        const status = err.response?.status;
        const original = err.config;

        if (!original) {
            throw err;
        }

        const requestPath = original.url?.split('?')[0] || '';
        const isPublicAuthRoute = publicAuthRoutes.some(
            (route) => requestPath === route || requestPath.startsWith(`${route}/`)
        );

        if (isPublicAuthRoute) {
            throw err;
        }

        const responseMessage = err.response?.data?.message || '';
        const isInactiveAccount =
            status === 403 &&
            (
                responseMessage.includes('vô hiệu hóa') ||
                responseMessage.includes('ACCOUNT_INACTIVE') ||
                responseMessage.toLowerCase().includes('inactive')
            );

        if (isInactiveAccount) {
            useAuthStore.getState().clearState();
            toast.error('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ bộ phận quản trị để được hỗ trợ.');

            if (window.location.pathname !== '/login') {
                window.location.assign('/login');
            }

            throw err;
        }

        if (status !== 401 || original._retry) {
            throw err;
        }

        original._retry = true;

        try {
            if (!refreshPromise) {
                refreshPromise = axiosInstance.post('/auth/refresh').finally(() => {
                    refreshPromise = null;
                });
            }

            const refreshRes = await refreshPromise;

            const newToken = refreshRes.data?.data?.accessToken || refreshRes.data?.accessToken;

            if (!newToken) {
                useAuthStore.getState().clearState();
                throw err;
            }

            useAuthStore.getState().setAccessToken(newToken);

            original.headers.Authorization = `Bearer ${newToken}`;

            return axiosInstance.request(original);
        } catch (refreshError) {
            useAuthStore.getState().clearState();
            throw refreshError;
        }
    }
);
