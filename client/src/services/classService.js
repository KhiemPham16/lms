import { axiosInstance as api } from '~/lib/axios';
import { unwrapApiResponse } from '~/lib/apiPayload';

const compactParams = (params = {}) =>
    Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)
    );

export const classService = {
    getSummary: async (params = {}) => {
        const res = await api.get('/classes/summary', { params: compactParams(params) });
        return unwrapApiResponse(res);
    },

    getClasses: async (params = {}) => {
        const res = await api.get('/classes', { params: compactParams(params) });
        return unwrapApiResponse(res);
    },

    getClass: async (publicId) => {
        const res = await api.get(`/classes/${publicId}`);
        return unwrapApiResponse(res);
    },

    createClass: async (payload) => {
        const res = await api.post('/classes', payload);
        return unwrapApiResponse(res);
    },

    updateClass: async (publicId, payload) => {
        const res = await api.patch(`/classes/${publicId}`, payload);
        return unwrapApiResponse(res);
    },

    deleteClass: async (publicId) => {
        const res = await api.delete(`/classes/${publicId}`);
        return unwrapApiResponse(res);
    },

    assignDepartmentHead: async (publicId, payload) => {
        const res = await api.patch(`/classes/${publicId}/department-head`, payload);
        return unwrapApiResponse(res);
    },

    assignLecturer: async (publicId, payload) => {
        const res = await api.patch(`/classes/${publicId}/lecturer`, payload);
        return unwrapApiResponse(res);
    },

    updateStatus: async (publicId, status) => {
        const res = await api.patch(`/classes/${publicId}/status`, { status });
        return unwrapApiResponse(res);
    }
};
