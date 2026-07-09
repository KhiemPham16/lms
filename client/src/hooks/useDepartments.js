import { useQuery } from '@tanstack/react-query';

import departmentsService from '~/services/departments.service';

export default function useDepartments() {
    return useQuery({
        queryKey: ['departments'],
        queryFn: departmentsService.getAll
    });
}
