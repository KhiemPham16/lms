import axiosClient from '~/config/axios';

const unwrap = (response) => response.data;

const lmsService = {
    async getDashboard() {
        return unwrap(await axiosClient.get('/'));
    },

    async listDepartments() {
        return unwrap(await axiosClient.get('/departments'));
    },
    async createDepartment(data) {
        return unwrap(await axiosClient.post('/departments', data));
    },
    async updateDepartment(publicId, data) {
        return unwrap(await axiosClient.patch(`/departments/${publicId}`, data));
    },
    async deleteDepartment(publicId) {
        return unwrap(await axiosClient.delete(`/departments/${publicId}`));
    },

    async listRoles() {
        return unwrap(await axiosClient.get('/roles'));
    },
    async listPermissions() {
        return unwrap(await axiosClient.get('/roles/permissions'));
    },
    async createRole(data) {
        return unwrap(await axiosClient.post('/roles', data));
    },
    async updateRole(publicId, data) {
        return unwrap(await axiosClient.patch(`/roles/${publicId}`, data));
    },
    async updateRolePermissions(publicId, data) {
        return unwrap(await axiosClient.put(`/roles/${publicId}/permissions`, data));
    },
    async deleteRole(publicId) {
        return unwrap(await axiosClient.delete(`/roles/${publicId}`));
    },

    async listCourses(params) {
        return unwrap(await axiosClient.get('/courses', { params }));
    },
    async getCourse(publicId) {
        return unwrap(await axiosClient.get(`/courses/${publicId}`));
    },
    async createCourse(data) {
        return unwrap(await axiosClient.post('/courses', data));
    },
    async createCourseProposal(data) {
        return unwrap(await axiosClient.post('/courses/proposals', data));
    },
    async updateCourse(publicId, data) {
        return unwrap(await axiosClient.patch(`/courses/${publicId}`, data));
    },
    async decideCourseByTrainingOffice(publicId, data) {
        return unwrap(await axiosClient.patch(`/courses/${publicId}/pdt-decision`, data));
    },
    async decideCourseByPrincipal(publicId, data) {
        return unwrap(await axiosClient.patch(`/courses/${publicId}/principal-decision`, data));
    },
    async deleteCourse(publicId) {
        return unwrap(await axiosClient.delete(`/courses/${publicId}`));
    },

    async listClasses(params) {
        return unwrap(await axiosClient.get('/classes', { params }));
    },
    async getClass(publicId) {
        return unwrap(await axiosClient.get(`/classes/${publicId}`));
    },
    async classSummary(params) {
        return unwrap(await axiosClient.get('/classes/summary', { params }));
    },
    async createClass(data) {
        return unwrap(await axiosClient.post('/classes', data));
    },
    async updateClass(publicId, data) {
        return unwrap(await axiosClient.patch(`/classes/${publicId}`, data));
    },
    async updateClassStatus(publicId, status) {
        return unwrap(await axiosClient.patch(`/classes/${publicId}/status`, { status }));
    },
    async deleteClass(publicId) {
        return unwrap(await axiosClient.delete(`/classes/${publicId}`));
    },
    async completeClass(publicId) {
        return unwrap(await axiosClient.patch(`/classes/${publicId}/complete`));
    },

    async listMyEnrollments() {
        return unwrap(await axiosClient.get('/enrollments/my'));
    },
    async enrollClass(classPublicId) {
        return unwrap(await axiosClient.post(`/enrollments/classes/${classPublicId}`));
    },
    async dropClass(classPublicId) {
        return unwrap(await axiosClient.patch(`/enrollments/classes/${classPublicId}/drop`));
    },

    async listLessons(classPublicId, params) {
        return unwrap(await axiosClient.get(`/classes/${classPublicId}/lessons`, { params }));
    },
    async getLesson(publicId) {
        return unwrap(await axiosClient.get(`/lessons/${publicId}`));
    },
    async createLesson(classPublicId, data) {
        return unwrap(await axiosClient.post(`/classes/${classPublicId}/lessons`, data));
    },
    async updateLesson(publicId, data) {
        return unwrap(await axiosClient.patch(`/lessons/${publicId}`, data));
    },
    async reorderLessons(classPublicId, items) {
        return unwrap(await axiosClient.patch(`/classes/${classPublicId}/lessons/reorder`, { items }));
    },
    async publishLesson(publicId, isPublished) {
        return unwrap(await axiosClient.patch(`/lessons/${publicId}/publish`, { isPublished }));
    },
    async checkCodeLesson(publicId, data) {
        return unwrap(await axiosClient.post(`/lessons/${publicId}/code-submissions/check`, data));
    },
    async submitCodeLesson(publicId, data) {
        return unwrap(await axiosClient.post(`/lessons/${publicId}/code-submissions`, data));
    },
    async myCodeSubmissions(publicId) {
        return unwrap(await axiosClient.get(`/lessons/${publicId}/code-submissions/me`));
    },
    async deleteLesson(publicId) {
        return unwrap(await axiosClient.delete(`/lessons/${publicId}`));
    },

    async listLessonSections(classPublicId, params) {
        return unwrap(await axiosClient.get(`/classes/${classPublicId}/lesson-sections`, { params }));
    },
    async createLessonSection(classPublicId, data) {
        return unwrap(await axiosClient.post(`/classes/${classPublicId}/lesson-sections`, data));
    },
    async updateLessonSection(publicId, data) {
        return unwrap(await axiosClient.patch(`/lesson-sections/${publicId}`, data));
    },
    async reorderLessonSections(classPublicId, items) {
        return unwrap(await axiosClient.patch(`/classes/${classPublicId}/lesson-sections/reorder`, { items }));
    },
    async deleteLessonSection(publicId) {
        return unwrap(await axiosClient.delete(`/lesson-sections/${publicId}`));
    },

    async listExams(classPublicId, params) {
        return unwrap(await axiosClient.get(`/classes/${classPublicId}/exams`, { params }));
    },
    async createExam(classPublicId, data) {
        return unwrap(await axiosClient.post(`/classes/${classPublicId}/exams`, data));
    },
    async getExam(publicId) {
        return unwrap(await axiosClient.get(`/exams/${publicId}`));
    },
    async createExamQuestion(examPublicId, data) {
        return unwrap(await axiosClient.post(`/exams/${examPublicId}/questions`, data));
    },
    async updateExamQuestion(publicId, data) {
        return unwrap(await axiosClient.patch(`/exam-questions/${publicId}`, data));
    },
    async deleteExamQuestion(publicId) {
        return unwrap(await axiosClient.delete(`/exam-questions/${publicId}`));
    },
    async publishExam(publicId, isPublished) {
        return unwrap(await axiosClient.patch(`/exams/${publicId}/publish`, { isPublished }));
    },
    async deleteExam(publicId) {
        return unwrap(await axiosClient.delete(`/exams/${publicId}`));
    },

    async listMedia(params) {
        return unwrap(await axiosClient.get('/media', { params }));
    },
    async uploadMedia(data) {
        return unwrap(
            await axiosClient.post('/media/upload', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
        );
    },
    async updateMedia(publicId, data) {
        return unwrap(await axiosClient.patch(`/media/${publicId}`, data));
    },
    async deleteMedia(publicId) {
        return unwrap(await axiosClient.delete(`/media/${publicId}`));
    },

    async listNotifications(params) {
        return unwrap(await axiosClient.get('/notifications', { params }));
    },
    async unreadNotifications() {
        return unwrap(await axiosClient.get('/notifications/unread-count'));
    },
    async markAllNotificationsRead() {
        return unwrap(await axiosClient.patch('/notifications/read-all'));
    },

    async listAuditLogs(params) {
        return unwrap(await axiosClient.get('/audit-logs', { params }));
    }
};

export default lmsService;
