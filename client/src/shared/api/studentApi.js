import { apiClient } from './http.js';

const unwrap = (response) => response.data?.data ?? response.data;

export const studentApi = {
    availableClasses: () => apiClient.get('/enrollments/available-classes').then(unwrap),
    myEnrollments: () => apiClient.get('/enrollments/me').then(unwrap),
    enroll: (classPublicId) => apiClient.post('/enrollments', { classPublicId }).then(unwrap),
    dropEnrollment: (enrollmentPublicId) => apiClient.delete(`/enrollments/${enrollmentPublicId}`).then(unwrap),
    subjects: () => apiClient.get('/subjects').then(unwrap),
    classContent: (classPublicId) => apiClient.get(`/learning/classes/${classPublicId}/content`).then(unwrap),
    classAssessments: (classPublicId) => apiClient.get(`/learning/classes/${classPublicId}/assessments`).then(unwrap),
    completeLesson: (lessonPublicId) => apiClient.patch(`/learning/lessons/${lessonPublicId}/complete`).then(unwrap),
    startAssessment: (assessmentPublicId) => apiClient.post(`/learning/assessments/${assessmentPublicId}/start`).then(unwrap),
    saveAnswer: (attemptPublicId, payload) => apiClient.post(`/learning/attempts/${attemptPublicId}/answers`, payload).then(unwrap),
    submitAttempt: (attemptPublicId) => apiClient.post(`/learning/attempts/${attemptPublicId}/submit`).then(unwrap),
    recordViolation: (attemptPublicId, type) => apiClient.post(`/learning/attempts/${attemptPublicId}/violations`, { type }).then(unwrap),
    attemptResult: (attemptPublicId) => apiClient.get(`/learning/attempts/${attemptPublicId}/result`).then(unwrap),
    courseGrades: () => apiClient.get('/grades/me/courses').then(unwrap),
    notifications: (params = { page: 1, limit: 10 }) => apiClient.get('/notifications', { params }).then(unwrap),
    mediaBlob: (mediaPublicId) => apiClient.get(`/media/${mediaPublicId}`, { responseType: 'blob' }).then((response) => response.data)
};
