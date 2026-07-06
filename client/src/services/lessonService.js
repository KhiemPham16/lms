import { axiosInstance as api } from '~/lib/axios';
import { unwrapApiResponse } from '~/lib/apiPayload';

const cleanParams = (params = {}) =>
    Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null));

export const lessonService = {
    getSummary: async (params = {}) => unwrapApiResponse(await api.get('/lessons/summary', { params: cleanParams(params) })),
    getLessons: async (params = {}) => unwrapApiResponse(await api.get('/lessons', { params: cleanParams(params) })),
    getLesson: async (publicId) => unwrapApiResponse(await api.get(`/lessons/${publicId}`)),
    createLesson: async (payload) => unwrapApiResponse(await api.post('/lessons', payload)),
    updateLesson: async (publicId, payload) => unwrapApiResponse(await api.patch(`/lessons/${publicId}`, payload)),
    duplicateLesson: async (publicId) => unwrapApiResponse(await api.post(`/lessons/${publicId}/duplicate`)),
    publishLesson: async (publicId) => unwrapApiResponse(await api.patch(`/lessons/${publicId}/publish`)),
    hideLesson: async (publicId, payload) => unwrapApiResponse(await api.patch(`/lessons/${publicId}/hide`, payload)),
    archiveLesson: async (publicId) => unwrapApiResponse(await api.patch(`/lessons/${publicId}/archive`)),
    deleteLesson: async (publicId) => unwrapApiResponse(await api.delete(`/lessons/${publicId}`)),
    reorderLessons: async (payload) => unwrapApiResponse(await api.post('/lessons/reorder', payload)),
    startLesson: async (publicId) => unwrapApiResponse(await api.post(`/student/lessons/${publicId}/start`)),
    completeLesson: async (publicId) => unwrapApiResponse(await api.post(`/student/lessons/${publicId}/complete`))
};
