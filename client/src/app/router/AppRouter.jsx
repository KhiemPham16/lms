import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';

import { AuthLayout } from '~/layouts/AuthLayout.jsx';
import { DashboardLayout } from '~/layouts/DashboardLayout.jsx';
import { ExamLayout } from '~/layouts/ExamLayout.jsx';
import { AcademicAdminPage } from '~/pages/admin-modules/AcademicAdminPage.jsx';
import { AnnouncementsPage } from '~/pages/admin-modules/AnnouncementsPage.jsx';
import { AuditLogPage } from '~/pages/admin-modules/AuditLogPage.jsx';
import { GradesAdminPage } from '~/pages/admin-modules/GradesAdminPage.jsx';
import { LearningAdminPage } from '~/pages/admin-modules/LearningAdminPage.jsx';
import { SystemSettingsPage } from '~/pages/admin-modules/SystemSettingsPage.jsx';
import { ActivateAccountPage } from '~/pages/auth/ActivateAccountPage.jsx';
import { ForgotPasswordPage } from '~/pages/auth/ForgotPasswordPage.jsx';
import { LoginPage } from '~/pages/auth/LoginPage.jsx';
import { ResetPasswordPage } from '~/pages/auth/ResetPasswordPage.jsx';
import { DashboardPage } from '~/pages/dashboard/DashboardPage.jsx';
import { DepartmentsPage } from '~/pages/departments/DepartmentsPage.jsx';
import { ExamTakingPage } from '~/pages/exams/ExamTakingPage.jsx';
import { MediaManagementPage } from '~/pages/media/MediaManagementPage.jsx';
import { NotificationsPage } from '~/pages/notifications/NotificationsPage.jsx';
import { AnnouncementsFeedPage } from '~/pages/announcements/AnnouncementsFeedPage.jsx';
import { ProfilePage } from '~/pages/profile/ProfilePage.jsx';
import {
    LecturerClassesPage,
    LecturerAutoGradingPage,
    LecturerDashboardPage,
    LecturerGradebookPage,
    LecturerGradingPage
} from '~/pages/lecturer/LecturerPortalPages.jsx';
import { StudentClassPage } from '~/pages/student/StudentClassPage.jsx';
import {
    StudentClassesPage,
    StudentDashboardPage,
    StudentEnrollmentsPage,
    StudentGradesPage
} from '~/pages/student/StudentPortalPages.jsx';
import { NotFoundPage } from '~/pages/status/NotFoundPage.jsx';
import { UnauthorizedPage } from '~/pages/status/UnauthorizedPage.jsx';
import { UserManagementPage } from '~/pages/users/UserManagementPage.jsx';
import { GuestRoute } from './GuestRoute.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { roleDashboardPaths, userRoles } from '~/shared/constants/roles.js';
import { useAuthStore } from '~/shared/store/authStore.js';

function DashboardEntry() {
    const user = useAuthStore((state) => state.user);
    const homePath = user?.homePath;

    return homePath && homePath !== '/dashboard'
        ? <Navigate to={homePath} replace />
        : <DashboardPage />;
}

const router = createBrowserRouter([
    {
        path: '/',
        element: <Navigate to="/dashboard" replace />
    },
    {
        element: <GuestRoute />,
        children: [
            {
                element: <AuthLayout />,
                children: [
                    { path: '/login', element: <LoginPage /> },
                    { path: '/forgot-password', element: <ForgotPasswordPage /> },
                    { path: '/reset-password', element: <ResetPasswordPage /> },
                    { path: '/activate', element: <ActivateAccountPage /> }
                ]
            }
        ]
    },
    {
        element: <ProtectedRoute />,
        children: [
            {
                element: <DashboardLayout />,
                children: [
                    { path: '/dashboard', element: <DashboardEntry /> },
                    { path: '/profile', element: <ProfilePage /> },
                    { path: '/notifications', element: <NotificationsPage /> },
                    { path: '/announcements', element: <AnnouncementsFeedPage /> },
                    {
                        path: roleDashboardPaths.ADMIN,
                        element: (
                            <ProtectedRoute allowedRoles={[userRoles.ADMIN]}>
                                <DashboardPage roleScope={userRoles.ADMIN} />
                            </ProtectedRoute>
                        )
                    },
                    {
                        path: roleDashboardPaths.HR,
                        element: (
                            <ProtectedRoute allowedRoles={[userRoles.HR]}>
                                <DashboardPage roleScope={userRoles.HR} />
                            </ProtectedRoute>
                        )
                    },
                    {
                        path: roleDashboardPaths.PRINCIPAL,
                        element: (
                            <ProtectedRoute allowedRoles={[userRoles.PRINCIPAL]}>
                                <DashboardPage roleScope={userRoles.PRINCIPAL} />
                            </ProtectedRoute>
                        )
                    },
                    {
                        path: roleDashboardPaths.TRAINING_OFFICER,
                        element: (
                            <ProtectedRoute allowedRoles={[userRoles.TRAINING_OFFICER]}>
                                <DashboardPage roleScope={userRoles.TRAINING_OFFICER} />
                            </ProtectedRoute>
                        )
                    },
                    {
                        path: roleDashboardPaths.DEPARTMENT_HEAD,
                        element: (
                            <ProtectedRoute allowedRoles={[userRoles.DEPARTMENT_HEAD]}>
                                <DashboardPage roleScope={userRoles.DEPARTMENT_HEAD} />
                            </ProtectedRoute>
                        )
                    },
                    {
                        path: roleDashboardPaths.LECTURER,
                        element: (
                            <ProtectedRoute allowedRoles={[userRoles.LECTURER]}>
                                <LecturerDashboardPage />
                            </ProtectedRoute>
                        )
                    },
                    {
                        path: '/lecturer/classes',
                        element: <ProtectedRoute allowedRoles={[userRoles.LECTURER]}><LecturerClassesPage /></ProtectedRoute>
                    },
                    {
                        path: '/lecturer/classes/:classPublicId',
                        element: <ProtectedRoute allowedRoles={[userRoles.LECTURER]}><AcademicAdminPage moduleKey="classes" /></ProtectedRoute>
                    },
                    {
                        path: '/lecturer/grading',
                        element: <ProtectedRoute allowedRoles={[userRoles.LECTURER]}><LecturerGradingPage /></ProtectedRoute>
                    },
                    {
                        path: '/lecturer/auto-grading',
                        element: <ProtectedRoute allowedRoles={[userRoles.LECTURER]}><LecturerAutoGradingPage /></ProtectedRoute>
                    },
                    {
                        path: '/lecturer/grades',
                        element: <ProtectedRoute allowedRoles={[userRoles.LECTURER]}><LecturerGradebookPage /></ProtectedRoute>
                    },
                    {
                        path: roleDashboardPaths.STUDENT,
                        element: (
                            <ProtectedRoute allowedRoles={[userRoles.STUDENT]}>
                                <StudentDashboardPage />
                            </ProtectedRoute>
                        )
                    },
                    {
                        path: '/student/enrollments',
                        element: <ProtectedRoute allowedRoles={[userRoles.STUDENT]}><StudentEnrollmentsPage /></ProtectedRoute>
                    },
                    {
                        path: '/student/classes',
                        element: <ProtectedRoute allowedRoles={[userRoles.STUDENT]}><StudentClassesPage /></ProtectedRoute>
                    },
                    {
                        path: '/student/classes/:classPublicId',
                        element: <ProtectedRoute allowedRoles={[userRoles.STUDENT]}><StudentClassPage /></ProtectedRoute>
                    },
                    {
                        path: '/student/grades',
                        element: <ProtectedRoute allowedRoles={[userRoles.STUDENT]}><StudentGradesPage /></ProtectedRoute>
                    },
                    { path: '/users', element: <UserManagementPage /> },
                    {
                        path: '/departments',
                        element: (
                            <ProtectedRoute allowedRoles={[userRoles.ADMIN, userRoles.HR, userRoles.PRINCIPAL, userRoles.TRAINING_OFFICER]}>
                                <DepartmentsPage />
                            </ProtectedRoute>
                        )
                    },
                    { path: '/subjects', element: <AcademicAdminPage moduleKey="subjects" /> },
                    { path: '/classes', element: <AcademicAdminPage moduleKey="classes" /> },
                    { path: '/classes/:classPublicId', element: <AcademicAdminPage moduleKey="classes" /> },
                    { path: '/enrollments', element: <AcademicAdminPage moduleKey="enrollments" /> },
                    { path: '/lessons', element: <LearningAdminPage moduleKey="lessons" /> },
                    { path: '/media', element: <MediaManagementPage /> },
                    { path: '/assignments', element: <LearningAdminPage moduleKey="assignments" /> },
                    { path: '/assessments', element: <LearningAdminPage moduleKey="assessments" /> },
                    {
                        path: '/grades',
                        element: (
                            <ProtectedRoute allowedRoles={[userRoles.TRAINING_OFFICER, userRoles.DEPARTMENT_HEAD]}>
                                <GradesAdminPage />
                            </ProtectedRoute>
                        )
                    },
                    { path: '/approvals', element: <AcademicAdminPage moduleKey="approvals" /> },
                    { path: '/subject-proposals', element: <AcademicAdminPage moduleKey="subjectProposals" /> },
                    { path: '/class-proposals', element: <AcademicAdminPage moduleKey="classProposals" /> },
                    { path: '/reports', element: <AcademicAdminPage moduleKey="reports" /> },
                    {
                        path: '/audit-log',
                        element: (
                            <ProtectedRoute allowedRoles={[userRoles.ADMIN]}>
                                <AuditLogPage />
                            </ProtectedRoute>
                        )
                    },
                    { path: '/settings', element: <SystemSettingsPage /> },
                    { path: '/announcements/manage', element: <ProtectedRoute allowedRoles={[userRoles.ADMIN]}><AnnouncementsPage /></ProtectedRoute> }
                ]
            }
        ]
    },
    {
        element: <ProtectedRoute />,
        children: [
            {
                element: <ExamLayout />,
                children: [{ path: '/exam/attempt/:attemptId', element: <ExamTakingPage /> }]
            }
        ]
    },
    { path: '/unauthorized', element: <UnauthorizedPage /> },
    { path: '*', element: <NotFoundPage /> }
]);

export function AppRouter() {
    return <RouterProvider router={router} />;
}
