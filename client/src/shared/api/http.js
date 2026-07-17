import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3500';
const apiPrefix = import.meta.env.VITE_API_PREFIX ?? '/api/v1';

export const apiClient = axios.create({
    baseURL: `${apiBaseUrl}${apiPrefix}`,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

let getAccessToken = () => null;
let refreshAccessToken = null;
let clearSession = null;
let refreshPromise = null;

export function configureHttpAuth(handlers) {
    getAccessToken = handlers.getAccessToken ?? getAccessToken;
    refreshAccessToken = handlers.refreshAccessToken ?? refreshAccessToken;
    clearSession = handlers.clearSession ?? clearSession;
}

apiClient.interceptors.request.use((config) => {
    const token = getAccessToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;

        if (!originalRequest || originalRequest._skipAuthRefresh || originalRequest._retry || status !== 401) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            if (!refreshPromise) {
                refreshPromise = refreshAccessToken?.();
            }

            await refreshPromise;
            refreshPromise = null;

            return apiClient(originalRequest);
        } catch (refreshError) {
            refreshPromise = null;
            clearSession?.();
            return Promise.reject(refreshError);
        }
    }
);

export function getApiMessage(error, fallback = 'Đã có lỗi xảy ra') {
    return error?.response?.data?.message ?? error?.response?.data?.error?.message ?? error?.message ?? fallback;
}

export function resolveApiAssetUrl(url) {
    if (!url || /^(https?:|data:|blob:)/i.test(url)) return url ?? '';
    const apiOrigin = (apiClient.defaults.baseURL ?? '').replace(/\/api\/v\d+\/?$/, '');
    return `${apiOrigin}${url.startsWith('/') ? url : `/${url}`}`;
}
