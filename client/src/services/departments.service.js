import axiosClient from '~/config/axios';

const departmentsService = {
    async getAll() {
        const response = await axiosClient.get('/departments');
        return response.data;
    }
};

export default departmentsService;
