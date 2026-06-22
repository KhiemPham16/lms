import { axiosInstance as api } from '~/lib/axios';

export const roleService = {
    getRoles: async () => {
        const res = await api.get('/roles');
        return res.data;
    },

    getPermissions: async () => {
        const res = await api.get('/roles/permissions');
        return res.data;
    },

    updateRolePermissions: async (publicId, permissionCodes) => {
        const res = await api.put(`/roles/${publicId}/permissions`, {
            permissionCodes
        });

        return res.data;
    }
};
