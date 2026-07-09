import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import usersService from '~/services/users.service';

export default function useCreateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: usersService.create,

        onSuccess: (response) => {
            toast.success(response?.message ?? 'Tạo người dùng thành công');

            queryClient.invalidateQueries({
                queryKey: ['users']
            });
        },

        onError: (error) => {
            const message = error?.response?.data?.message;

            toast.error(Array.isArray(message) ? message.join(', ') : (message ?? 'Tạo người dùng thất bại'));
        }
    });
}
