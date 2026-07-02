import { axiosInstance as api } from '~/lib/axios';
import { unwrapApiResponse } from '~/lib/apiPayload';

export const courseService = {
    getCourses: async (params = {}) => {
        const res = await api.get('/courses', { params });
        return unwrapApiResponse(res);
    },

    getCourse: async (publicId) => {
        const res = await api.get(`/courses/${publicId}`);
        return unwrapApiResponse(res);
    },

    createProposal: async (payload) => {
        const res = await api.post('/courses/proposals', payload);
        return unwrapApiResponse(res);
    },

    updateCourse: async (publicId, payload) => {
        const res = await api.patch(`/courses/${publicId}`, payload);
        return unwrapApiResponse(res);
    },

    deleteCourse: async (publicId) => {
        const res = await api.delete(`/courses/${publicId}`);
        return unwrapApiResponse(res);
    },

    assignDepartmentHead: async (publicId, payload) => {
        const res = await api.patch(`/courses/${publicId}/department-head`, payload);
        return unwrapApiResponse(res);
    },

    assignLecturers: async (publicId, payload) => {
        const res = await api.patch(`/courses/${publicId}/lecturers`, payload);
        return unwrapApiResponse(res);
    },

    updateStatus: async (publicId, payload) => {
        const res = await api.patch(`/courses/${publicId}/status`, payload);
        return unwrapApiResponse(res);
    },

    decideByTrainingOffice: async (publicId, payload) => {
        const res = await api.patch(`/courses/${publicId}/pdt-decision`, payload);
        return unwrapApiResponse(res);
    },

    decideByPrincipal: async (publicId, payload) => {
        const res = await api.patch(`/courses/${publicId}/principal-decision`, payload);
        return unwrapApiResponse(res);
    }
};
