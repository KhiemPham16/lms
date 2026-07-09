import { useQuery } from '@tanstack/react-query';

import usersService from '~/services/users.service';

export default function useUsers(params) {
    return useQuery({
        queryKey: ['users', params],
        queryFn: () => usersService.getAll(params),
        keepPreviousData: true
    });
}
