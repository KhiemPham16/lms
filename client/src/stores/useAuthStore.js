import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import { authService } from '~/services/authService';

export const useAuthStore = create(
    persist(
        (set, get) => ({
            accessToken: null,
            user: null,
            loading: false,

            setAccessToken: (accessToken) => {
                set({ accessToken });
            },

            setUser: (user) => {
                set({ user });
            },

            clearState: () => {
                set({
                    accessToken: null,
                    user: null,
                    loading: false
                });

                localStorage.removeItem('auth-storage');
                sessionStorage.clear();
            },

            login: async (email, password) => {
                try {
                    set({ loading: true });

                    const data = await authService.login(email, password);

                    set({
                        accessToken: data.accessToken
                    });

                    await get().fetchMe();

                    toast.success(data.message || 'Đăng nhập thành công');
                    return true;
                } catch (error) {
                    console.error(error?.response?.data || error);
                    toast.error(error?.response?.data?.message || 'Đăng nhập không thành công');
                    return false;
                } finally {
                    set({ loading: false });
                }
            },

            logout: async () => {
                try {
                    await authService.logout();
                    toast.success('Đăng xuất thành công');
                } catch (error) {
                    console.error(error);
                    toast.error('Đăng xuất thất bại');
                } finally {
                    get().clearState();
                }
            },

            fetchMe: async () => {
                try {
                    set({ loading: true });

                    const data = await authService.fetchMe();

                    set({
                        user: data
                    });

                    return true;
                } catch (error) {
                    console.error(error?.response?.data || error);

                    set({
                        user: null
                    });

                    return false;
                } finally {
                    set({ loading: false });
                }
            },

            forgotPassword: async (email) => {
                try {
                    set({ loading: true });

                    await authService.forgotPassword(email);

                    toast.success('Vui lòng kiểm tra email để đặt lại mật khẩu');
                    return true;
                } catch (error) {
                    console.error(error);
                    toast.error(error?.response?.data?.message || 'Gửi yêu cầu thất bại');
                    return false;
                } finally {
                    set({ loading: false });
                }
            },

            resetPassword: async (email, otp, newPassword) => {
                try {
                    set({ loading: true });

                    await authService.resetPassword(email, otp, newPassword);

                    toast.success('Đặt lại mật khẩu thành công');
                    return true;
                } catch (error) {
                    console.error(error);
                    toast.error(error?.response?.data?.message || 'Đặt lại mật khẩu thất bại');
                    return false;
                } finally {
                    set({ loading: false });
                }
            },

            refresh: async () => {
                try {
                    set({ loading: true });

                    const data = await authService.refresh();

                    set({
                        accessToken: data?.accessToken || data?.data?.accessToken
                    });
                } catch (error) {
                    console.error(error);
                    get().clearState();
                } finally {
                    set({ loading: false });
                }
            }
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken
            })
        }
    )
);
