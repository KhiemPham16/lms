import axiosClient from '~/config/axios';

const usersService = {
    async getAll(params) {
        const query = {
            page: params.page,
            limit: params.limit
        };

        if (params.keyword?.trim()) {
            query.keyword = params.keyword.trim();
        }

        if (params.roles?.length) {
            query.roles = params.roles.join(',');
        }

        const response = await axiosClient.get('/users', {
            params: query
        });

        return response.data;
    },
    async summary(params = {}) {
        const response = await axiosClient.get('/users/summary', {
            params
        });
        return response.data;
    },
    async create(data) {
        const response = await axiosClient.post('/users', data);
        return response.data;
    },
    async update(publicId, data) {
        const response = await axiosClient.patch(`/users/${publicId}`, data);
        return response.data;
    },
    async updateMyProfile(data) {
        const response = await axiosClient.patch('/users/me/profile', data);
        return response.data;
    },
    async updateStatus(publicId, status) {
        const response = await axiosClient.patch(`/users/${publicId}/status`, {
            status,
            revokeSessions: true,
            sendEmail: true
        });
        return response.data;
    },
    async updateRole(publicId, roleId) {
        const response = await axiosClient.patch(`/users/${publicId}/role`, { roleId });
        return response.data;
    },
    async bulkLock(userIds, reason = 'Khóa hàng loạt từ màn quản lý người dùng') {
        const response = await axiosClient.post('/users/bulk/lock', {
            userIds,
            reason,
            revokeSessions: true
        });
        return response.data;
    },
    async bulkUnlock(userIds, reason = 'Mở khóa hàng loạt từ màn quản lý người dùng') {
        const response = await axiosClient.post('/users/bulk/unlock', {
            userIds,
            reason,
            revokeSessions: true
        });
        return response.data;
    },
    async bulkAssignRole(userIds, roleId) {
        const response = await axiosClient.post('/users/bulk/assign-role', {
            userIds,
            roleId
        });
        return response.data;
    },
    async resetPassword(publicId) {
        const response = await axiosClient.post(`/users/${publicId}/reset-password`, {
            mode: 'temporary',
            forceChange: true,
            revokeSessions: true
        });
        return response.data;
    },
    async resendActivation(publicId) {
        const response = await axiosClient.post(`/users/${publicId}/resend-activation`);
        return response.data;
    },
    async remove(publicId) {
        const response = await axiosClient.delete(`/users/${publicId}`);
        return response.data;
    },
    async activities(publicId) {
        const response = await axiosClient.get(`/users/${publicId}/activities`, {
            params: {
                page: 1,
                limit: 10
            }
        });
        return response.data;
    }
};

export default usersService;
