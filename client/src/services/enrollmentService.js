import { axiosInstance as api } from '~/lib/axios';
import { unwrapApiResponse } from '~/lib/apiPayload';

export const enrollmentService = {
    enrollClass: async (classPublicId) => {
        const res = await api.post(`/enrollments/classes/${classPublicId}`);
        return unwrapApiResponse(res);
    },

    dropClass: async (classPublicId) => {
        const res = await api.patch(`/enrollments/classes/${classPublicId}/drop`);
        return unwrapApiResponse(res);
    }
};
