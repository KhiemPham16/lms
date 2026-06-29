import { axiosInstance as api } from '~/lib/axios';
import { unwrapApiResponse } from '~/lib/apiPayload';

export const departmentService = {
    getDepartments: async () => {
        const res = await api.get('/departments');
        return unwrapApiResponse(res);
    }
};
