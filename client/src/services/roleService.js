import { axiosInstance as api } from '~/lib/axios';

export const roleService = {
    createRole: async (data) => {
        const res = await api.post('/roles', data);
        return res.data;
    },

    getRoles: async () => {
        const res = await api.get('/roles');
        return res.data;
    },

    getRoleById: async (publicId) => {
        const res = await api.get(`/roles/${publicId}`);
        return res.data;
    },

    getPermissions: async () => {
        const res = await api.get('/roles/permissions');
        return res.data;
    },

    updateRole: async (publicId, data) => {
        const res = await api.patch(`/roles/${publicId}`, data);
        return res.data;
    },

    updateRolePermissions: async (publicId, permissionCodes, reason) => {
        const res = await api.put(`/roles/${publicId}/permissions`, {
            permissionCodes,
            reason
        });

        return res.data;
    },

    deleteRole: async (publicId) => {
        const res = await api.delete(`/roles/${publicId}`);
        return res.data;
    }
};
