import { create } from 'zustand';

const useAuthStore = create((set) => ({
    user: null,
    isAuthenticated: false,
    initialized: false,

    login(user) {
        set({
            user,
            isAuthenticated: true,
            initialized: true
        });
    },

    logout() {
        set({
            user: null,
            isAuthenticated: false,
            initialized: true
        });
    },

    initialize(user) {
        set({
            user,
            isAuthenticated: !!user,
            initialized: true
        });
    }
}));

export default useAuthStore;
