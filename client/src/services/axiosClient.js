import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3500';

export const ACCESS_TOKEN_STORAGE_KEY = 'lms_access_token';

export function getStoredAccessToken() {
    return sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setStoredAccessToken(accessToken, remember = false) {
    sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);

    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
}

export function clearStoredAccessToken() {
    sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export const axiosClient = axios.create({
    baseURL: `${API_URL}/api/v1`,
    withCredentials: true
});

axiosClient.interceptors.request.use((config) => {
    const accessToken = getStoredAccessToken();

    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

export default axiosClient;
