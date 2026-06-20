import { Navigate, Routes, Route } from 'react-router-dom';

import ProtectedRoute from '~/components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

import Login from '~/pages/Auth/Login';
import ForgotPassword from '~/pages/Auth/ForgotPassword';
import ResetPassword from '~/pages/Auth/ResetPassword';
import AdminDashboard from '~/pages/Admin/Dashboard';
import AdminPermissions from '~/pages/Admin/Permissions';
import AdminUsers from '~/pages/Admin/Users';
import FlowWorkbench from '~/pages/FlowWorkbench';
import SharedUtility from '~/pages/SharedUtility';
import NotFound from '~/pages/NotFound';
import { routes } from '~/config/routes';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to={routes.login} replace />} />
            <Route path={routes.login} element={<Login />} />
            <Route path={routes.forgotPassword} element={<ForgotPassword />} />
            <Route path={routes.resetPassword} element={<ResetPassword />} />

            <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                    <Route path={routes.profile} element={<SharedUtility type="profile" />} />
                    <Route path={routes.notifications} element={<SharedUtility type="notifications" />} />
                    <Route path={routes.settings} element={<SharedUtility type="settings" />} />
                    <Route path={routes.admin} element={<AdminDashboard />} />
                    <Route path={routes.adminUsers} element={<AdminUsers />} />
                    <Route path={routes.adminPermissions} element={<AdminPermissions />} />
                    <Route path={routes.adminAuditLogs} element={<FlowWorkbench workspaceKey="admin" moduleKey="audit" />} />
                    <Route path={routes.adminCurriculums} element={<FlowWorkbench workspaceKey="admin" moduleKey="curriculums" />} />
                    <Route path={routes.adminSubjects} element={<FlowWorkbench workspaceKey="admin" moduleKey="subjects" />} />
                    <Route path={routes.adminClasses} element={<FlowWorkbench workspaceKey="admin" moduleKey="classes" />} />
                    <Route path={routes.adminLessons} element={<FlowWorkbench workspaceKey="admin" moduleKey="lessons" />} />
                    <Route path={routes.adminExams} element={<FlowWorkbench workspaceKey="admin" moduleKey="exams" />} />
                    <Route path={routes.adminGrades} element={<FlowWorkbench workspaceKey="admin" moduleKey="grades" />} />
                    <Route path={routes.hr} element={<FlowWorkbench workspaceKey="hr" />} />
                    <Route path={routes.hrUsers} element={<AdminUsers workspaceKey="hr" />} />
                    <Route path="/hr/permissions" element={<FlowWorkbench workspaceKey="hr" moduleKey="permissions" />} />
                    <Route path={routes.principal} element={<FlowWorkbench workspaceKey="principal" />} />
                    <Route path={routes.principalUsers} element={<AdminUsers workspaceKey="principal" />} />
                    <Route path="/principal/proposals" element={<FlowWorkbench workspaceKey="principal" moduleKey="proposals" />} />
                    <Route path="/principal/proposals/history" element={<FlowWorkbench workspaceKey="principal" moduleKey="history" />} />
                    <Route path={routes.training} element={<FlowWorkbench workspaceKey="training" />} />
                    <Route path={routes.trainingUsers} element={<AdminUsers workspaceKey="training" />} />
                    <Route path="/training/curriculums" element={<FlowWorkbench workspaceKey="training" moduleKey="curriculums" />} />
                    <Route path="/training/subjects" element={<FlowWorkbench workspaceKey="training" moduleKey="subjects" />} />
                    <Route path="/training/classes" element={<FlowWorkbench workspaceKey="training" moduleKey="classes" />} />
                    <Route path="/training/grades" element={<FlowWorkbench workspaceKey="training" moduleKey="grades" />} />
                    <Route path={routes.department} element={<FlowWorkbench workspaceKey="department" />} />
                    <Route path={routes.departmentUsers} element={<AdminUsers workspaceKey="department" />} />
                    <Route path="/department/proposals" element={<FlowWorkbench workspaceKey="department" moduleKey="proposals" />} />
                    <Route path="/department/classes" element={<FlowWorkbench workspaceKey="department" moduleKey="classes" />} />
                    <Route path={routes.teacher} element={<FlowWorkbench workspaceKey="teacher" />} />
                    <Route path={routes.teacherUsers} element={<AdminUsers workspaceKey="teacher" />} />
                    <Route path="/teacher/classes" element={<FlowWorkbench workspaceKey="teacher" moduleKey="classes" />} />
                    <Route path="/teacher/lessons" element={<FlowWorkbench workspaceKey="teacher" moduleKey="lessons" />} />
                    <Route path="/teacher/exams" element={<FlowWorkbench workspaceKey="teacher" moduleKey="exams" />} />
                    <Route path="/teacher/grades" element={<FlowWorkbench workspaceKey="teacher" moduleKey="grades" />} />
                    <Route path={routes.student} element={<FlowWorkbench workspaceKey="student" />} />
                    <Route path="/student/registration" element={<FlowWorkbench workspaceKey="student" moduleKey="registration" />} />
                    <Route path="/student/classes" element={<FlowWorkbench workspaceKey="student" moduleKey="classes" />} />
                    <Route path="/student/exams" element={<FlowWorkbench workspaceKey="student" moduleKey="exams" />} />
                    <Route path="/student/grades" element={<FlowWorkbench workspaceKey="student" moduleKey="grades" />} />
                </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}
