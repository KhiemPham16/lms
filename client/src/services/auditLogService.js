import { axiosInstance as api } from '~/lib/axios';

export const auditLogService = {
    getAuditLogs: async (params = {}) => {
        const res = await api.get('/audit-logs', { params });
        return res.data;
    }
};
