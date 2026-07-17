import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { apiClient, configureHttpAuth } from '~/shared/api/http.js';
import { getHomePath } from '~/shared/constants/roles.js';

const normalizeUser = (user) => (user ? { ...user, homePath: getHomePath(user.role) } : null);

export const useAuthStore = create(
    persist(
        (set, get) => ({
            accessToken: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            hasBootstrapped: false,

            async login(payload) {
                set({ isLoading: true });
                try {
                    const response = await apiClient.post('/auth/login', payload, { _skipAuthRefresh: true });
                    const accessToken = response.data?.accessToken;

                    set({ accessToken, isAuthenticated: Boolean(accessToken) });
                    await get().loadMe();

                    return response.data;
                } finally {
                    set({ isLoading: false });
                }
            },

            async loadMe() {
                const response = await apiClient.get('/auth/me');
                const user = normalizeUser(response.data?.data ?? response.data);

                set({ user, isAuthenticated: true, hasBootstrapped: true });
                return user;
            },

            async refreshAccessToken() {
                const response = await apiClient.post('/auth/refresh', undefined, { _skipAuthRefresh: true });
                const accessToken = response.data?.accessToken;

                if (!accessToken) {
                    throw new Error('Access token không hợp lệ');
                }

                set({ accessToken, isAuthenticated: true });
                return accessToken;
            },

            async bootstrapSession() {
                if (get().hasBootstrapped) return;

                const existingToken = get().accessToken;

                if (!existingToken) {
                    set({ hasBootstrapped: true, isAuthenticated: false, user: null });
                    return;
                }

                try {
                    await get().loadMe();
                } catch {
                    get().clearSession();
                    set({ hasBootstrapped: true });
                }
            },

            async logout() {
                try {
                    await apiClient.post('/auth/logout', undefined, { _skipAuthRefresh: true });
                } finally {
                    get().clearSession();
                }
            },

            clearSession() {
                set({ accessToken: null, user: null, isAuthenticated: false, hasBootstrapped: true });
            }
        }),
        {
            name: 'lms-auth',
            partialize: (state) => ({
                accessToken: state.accessToken,
                user: state.user,
                isAuthenticated: state.isAuthenticated
            })
        }
    )
);

configureHttpAuth({
    getAccessToken: () => useAuthStore.getState().accessToken,
    refreshAccessToken: () => useAuthStore.getState().refreshAccessToken(),
    clearSession: () => useAuthStore.getState().clearSession()
});
