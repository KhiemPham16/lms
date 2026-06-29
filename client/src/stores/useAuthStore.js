import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import { getAccountStatusMessage, getApiErrorMessage, isAccountStatusError } from '~/lib/apiPayload';
import { authService } from '~/services/authService';

const isActiveUser = (user) => String(user?.status || '').toUpperCase() === 'ACTIVE';

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
                    set({
                        loading: true,
                        accessToken: null,
                        user: null
                    });

                    const data = await authService.login(email, password);

                    if (!data?.accessToken) {
                        throw new Error('Missing access token');
                    }

                    set({ accessToken: data.accessToken });

                    const fetchedUser = await get().fetchMe({ silent: true, clearOnFailure: true });

                    if (!fetchedUser) {
                        return false;
                    }

                    toast.success(data.message || 'Đăng nhập thành công');
                    return true;
                } catch (error) {
                    console.error(error?.response?.data || error);
                    toast.error(
                        isAccountStatusError(error)
                            ? getAccountStatusMessage(error.response?.data?.status)
                            : getApiErrorMessage(error, 'Đăng nhập không thành công')
                    );
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

            fetchMe: async (options = {}) => {
                try {
                    if (!options.silent) {
                        set({ loading: true });
                    }

                    const data = await authService.fetchMe();

                    if (!isActiveUser(data)) {
                        get().clearState();
                        if (!options.silent) {
                            toast.error(getAccountStatusMessage(data?.status));
                        }
                        return false;
                    }

                    set({ user: data });
                    return true;
                } catch (error) {
                    console.error(error?.response?.data || error);

                    if (options.clearOnFailure || isAccountStatusError(error)) {
                        get().clearState();
                    } else {
                        set({ user: null });
                    }

                    return false;
                } finally {
                    if (!options.silent) {
                        set({ loading: false });
                    }
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
                    toast.error(getApiErrorMessage(error, 'Gửi yêu cầu thất bại'));
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
                    toast.error(getApiErrorMessage(error, 'Đặt lại mật khẩu thất bại'));
                    return false;
                } finally {
                    set({ loading: false });
                }
            },

            refresh: async (options = {}) => {
                try {
                    if (!options.silent) {
                        set({ loading: true });
                    }

                    const data = await authService.refresh();
                    const accessToken = data?.accessToken;

                    if (!accessToken) {
                        get().clearState();
                        return false;
                    }

                    set({ accessToken });
                    return true;
                } catch (error) {
                    console.error(error);
                    get().clearState();
                    return false;
                } finally {
                    if (!options.silent) {
                        set({ loading: false });
                    }
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
