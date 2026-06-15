import { create } from 'zustand';

import { getMe, login, logout } from '~/services/authService';
import { clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from '~/services/axiosClient';

export const useAuthStore = create((set, get) => ({
    accessToken: getStoredAccessToken(),
    user: null,
    isLoading: false,
    error: null,

    isAuthenticated: () => Boolean(get().accessToken),

    login: async ({ email, password, remember }) => {
        set({ isLoading: true, error: null });

        try {
            const result = await login({ email, password });

            setStoredAccessToken(result.accessToken, remember);

            const user = await getMe();

            set({
                accessToken: result.accessToken,
                user,
                isLoading: false,
                error: null
            });

            return user;
        } catch (error) {
            clearStoredAccessToken();

            const message = error.response?.data?.message || 'Dang nhap that bai';

            set({
                accessToken: null,
                user: null,
                isLoading: false,
                error: message
            });

            throw new Error(message, { cause: error });
        }
    },

    logout: async () => {
        try {
            await logout();
        } finally {
            clearStoredAccessToken();
            set({ accessToken: null, user: null, error: null });
        }
    },

    clearError: () => set({ error: null })
}));
