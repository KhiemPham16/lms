import { axiosInstance as api } from '~/lib/axios';

const unwrap = (response) => response.data?.data || response.data;

export const departmentService = {
    getDepartments: async () => {
        const res = await api.get('/departments');
        return unwrap(res);
    }
};
