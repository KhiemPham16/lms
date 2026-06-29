import { axiosInstance as api } from '~/lib/axios';
import { unwrapApiResponse } from '~/lib/apiPayload';
import { userService } from '~/services/userService';
import { roleService } from '~/services/roleService';

export const adminDashboardService = {
    getUsers: (params = {}) => userService.getUsers(params),
    createUser: (payload) => userService.createUser(payload),
    getRoles: () => roleService.getRoles(),
    getAuditLogs: async (params = {}) => {
        const res = await api.get('/audit-logs', { params });
        return unwrapApiResponse(res);
    },
    getHealth: async () => {
        const res = await api.get('/');
        return unwrapApiResponse(res);
    }
};
