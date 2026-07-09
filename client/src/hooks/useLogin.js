import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import authService from '~/services/auth.service';
import useAuthStore from '~/stores/auth.store';
import { setAccessToken } from '~/utils/token';

export default function useLogin() {
    const login = useAuthStore((state) => state.login);

    return useMutation({
        mutationFn: authService.login,

        onSuccess: async (response) => {
            const { accessToken, message } = response;

            setAccessToken(accessToken);

            const user = await authService.me();

            login(user);

            toast.success(message);
        },

        onError: (error) => {
            toast.error(error.response?.data?.message ?? 'Đăng nhập thất bại');
        }
    });
}
