import { axiosInstance as api } from '~/lib/axios';
import { unwrapApiResponse } from '~/lib/apiPayload';

export const auditLogService = {
    getAuditLogs: async (params = {}) => {
        const res = await api.get('/audit-logs', { params });
        return unwrapApiResponse(res);
    }
};
