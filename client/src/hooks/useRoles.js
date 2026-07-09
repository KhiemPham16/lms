import { useQuery } from '@tanstack/react-query';

import rolesService from '~/services/roles.service';

export default function useRoles() {
    return useQuery({
        queryKey: ['roles'],
        queryFn: rolesService.getAll
    });
}
