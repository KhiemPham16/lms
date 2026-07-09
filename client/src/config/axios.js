import axios from 'axios';

import env from '~/config/env';
import authService from '~/services/auth.service';
import { getAccessToken, removeAccessToken, setAccessToken } from '~/utils/token';

const publicAuthRoutes = ['/auth/login', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

const axiosClient = axios.create({
    baseURL: `${env.API_BASE_URL}${env.API_PREFIX}`,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

export const refreshClient = axios.create({
    baseURL: `${env.API_BASE_URL}${env.API_PREFIX}`,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

axiosClient.interceptors.request.use((config) => {
    const token = getAccessToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

axiosClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        const requestPath = originalRequest?.url ?? '';

        const isPublicAuthRoute = publicAuthRoutes.some(
            (route) => requestPath === route || requestPath.startsWith(`${route}/`)
        );

        if (error.response?.status !== 401 || originalRequest._retry || isPublicAuthRoute) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            const { accessToken } = await authService.refresh();

            setAccessToken(accessToken);

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;

            return axiosClient(originalRequest);
        } catch (refreshError) {
            removeAccessToken();

            return Promise.reject(refreshError);
        }
    }
);

export default axiosClient;
