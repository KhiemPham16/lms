import { axiosInstance as api } from '~/lib/axios';
import { unwrapApiResponse } from '~/lib/apiPayload';

export const roleService = {
    createRole: async (data) => {
        const res = await api.post('/roles', data);
        return unwrapApiResponse(res);
    },

    getRoles: async () => {
        const res = await api.get('/roles');
        return unwrapApiResponse(res);
    },

    getRoleById: async (publicId) => {
        const res = await api.get(`/roles/${publicId}`);
        return unwrapApiResponse(res);
    },

    getPermissions: async () => {
        const res = await api.get('/roles/permissions');
        return unwrapApiResponse(res);
    },

    updateRole: async (publicId, data) => {
        const res = await api.patch(`/roles/${publicId}`, data);
        return unwrapApiResponse(res);
    },

    updateRolePermissions: async (publicId, permissionCodes, reason) => {
        const res = await api.put(`/roles/${publicId}/permissions`, {
            permissionCodes,
            reason
        });

        return unwrapApiResponse(res);
    },

    deleteRole: async (publicId) => {
        const res = await api.delete(`/roles/${publicId}`);
        return unwrapApiResponse(res);
    }
};
