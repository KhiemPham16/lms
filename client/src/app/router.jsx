import { createBrowserRouter, Navigate } from 'react-router-dom';

import LoginPage from '~/pages/Auth/LoginPage';
import ActivateAccountPage from '~/pages/Auth/ActivateAccountPage';
import DashboardLayout from '~/layouts/DashboardLayout';
import DashboardPage from '~/pages/Dashboard';
import ProfilePage from '~/pages/Profile';
import UsersPage from '~/pages/Users';
import AuditLogsPage from '~/pages/Lms/AuditLogsPage';
import ClassContentPage from '~/pages/Lms/ClassContentPage';
import ClassPreviewPage from '~/pages/Lms/ClassPreviewPage';
import ClassesPage from '~/pages/Lms/ClassesPage';
import CodeLabPage from '~/pages/Lms/CodeLabPage';
import CoursesPage from '~/pages/Lms/CoursesPage';
import DepartmentsPage from '~/pages/Lms/DepartmentsPage';
import MediaPage from '~/pages/Lms/MediaPage';
import NotificationsPage from '~/pages/Lms/NotificationsPage';
import RolesPage from '~/pages/Lms/RolesPage';

import GuestRoute from '~/routes/GuestRoute';
import PersistLogin from '~/routes/PersistLogin';
import ProtectedRoute from '~/routes/ProtectedRoute';

const router = createBrowserRouter([
    {
        path: '/',
        element: <Navigate to="/dashboard" replace />
    },
    {
        element: <PersistLogin />,
        children: [
            {
                element: <GuestRoute />,
                children: [
                    {
                        path: '/auth/login',
                        element: <LoginPage />
                    },
                    {
                        path: '/auth/activate',
                        element: <ActivateAccountPage />
                    }
                ]
            },
            {
                element: <ProtectedRoute />,
                children: [
                    {
                        path: '/classes/:publicId/preview',
                        element: <ClassPreviewPage />
                    },
                    {
                        path: '/classes/:publicId/learn',
                        element: <ClassPreviewPage mode="learn" />
                    },
                    {
                        path: '/lessons/:publicId/code-lab',
                        element: <CodeLabPage />
                    },
                    {
                        element: <DashboardLayout />,
                        children: [
                            {
                                path: '/dashboard',
                                element: <DashboardPage />
                            },
                            {
                                path: '/profile',
                                element: <ProfilePage />
                            },
                            {
                                path: '/users',
                                element: <UsersPage />
                            },
                            {
                                path: '/departments',
                                element: <DepartmentsPage />
                            },
                            {
                                path: '/roles',
                                element: <RolesPage />
                            },
                            {
                                path: '/courses',
                                element: <CoursesPage />
                            },
                            {
                                path: '/courses/:publicId/classes',
                                element: <ClassesPage />
                            },
                            {
                                path: '/classes',
                                element: <Navigate to="/courses" replace />
                            },
                            {
                                path: '/classes/:publicId/content',
                                element: <ClassContentPage />
                            },
                            {
                                path: '/media',
                                element: <MediaPage />
                            },
                            {
                                path: '/notifications',
                                element: <NotificationsPage />
                            },
                            {
                                path: '/audit-logs',
                                element: <AuditLogsPage />
                            }
                        ]
                    }
                ]
            }
        ]
    }
]);

export default router;
