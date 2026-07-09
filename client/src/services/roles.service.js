import axiosClient from '~/config/axios';

const rolesService = {
    async getAll() {
        const response = await axiosClient.get('/roles');
        return response.data;
    }
};

export default rolesService;
