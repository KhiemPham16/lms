import { Navigate, Routes, Route } from 'react-router-dom';

import ProtectedRoute from '~/components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

import Login from '~/pages/Auth/Login';
import ForgotPassword from '~/pages/Auth/ForgotPassword';
import ResetPassword from '~/pages/Auth/ResetPassword';
import AdminDashboard from '~/pages/Admin/Dashboard';
import AdminPermissions from '~/pages/Admin/Permissions';
import AdminUsers from '~/pages/Admin/Users';
import AdminAuditLogs from '~/pages/Admin/AuditLogs';
import ClassesPage from '~/pages/Classes';
import CoursesPage from '~/pages/Courses';
import FlowWorkbench from '~/pages/FlowWorkbench';
import WorkspaceModuleRoute from '~/pages/WorkspaceModuleRoute';
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
                    <Route path={routes.adminAuditLogs} element={<AdminAuditLogs />} />
                    <Route path={routes.adminSubjects} element={<CoursesPage workspaceKey="admin" />} />
                    <Route path={routes.adminClasses} element={<ClassesPage workspaceKey="admin" />} />
                    <Route path={routes.adminLessons} element={<FlowWorkbench workspaceKey="admin" moduleKey="lessons" />} />
                    <Route path={routes.adminExams} element={<FlowWorkbench workspaceKey="admin" moduleKey="exams" />} />
                    <Route path={routes.adminGrades} element={<FlowWorkbench workspaceKey="admin" moduleKey="grades" />} />
                    <Route path={routes.hr} element={<FlowWorkbench workspaceKey="hr" />} />
                    <Route path={routes.hrUsers} element={<AdminUsers workspaceKey="hr" />} />
                    <Route path={routes.hrDepartments} element={<FlowWorkbench workspaceKey="hr" moduleKey="departments" />} />
                    <Route path={routes.hrPermissions} element={<AdminPermissions workspaceKey="hr" />} />
                    <Route path={routes.principal} element={<FlowWorkbench workspaceKey="principal" />} />
                    <Route path={routes.principalUsers} element={<AdminUsers workspaceKey="principal" />} />
                    <Route path={routes.principalDepartments} element={<FlowWorkbench workspaceKey="principal" moduleKey="departments" />} />
                    <Route path={routes.principalPermissions} element={<AdminPermissions workspaceKey="principal" />} />
                    <Route path={routes.principalProposals} element={<CoursesPage workspaceKey="principal" />} />
                    <Route path={routes.principalProposalHistory} element={<FlowWorkbench workspaceKey="principal" moduleKey="history" />} />
                    <Route path={routes.training} element={<FlowWorkbench workspaceKey="training" />} />
                    <Route path={routes.trainingUsers} element={<AdminUsers workspaceKey="training" />} />
                    <Route path={routes.trainingDepartments} element={<FlowWorkbench workspaceKey="training" moduleKey="departments" />} />
                    <Route path={routes.trainingPermissions} element={<AdminPermissions workspaceKey="training" />} />
                    <Route path={routes.trainingSubjects} element={<CoursesPage workspaceKey="training" />} />
                    <Route path={routes.trainingClasses} element={<ClassesPage workspaceKey="training" />} />
                    <Route path={routes.trainingGrades} element={<FlowWorkbench workspaceKey="training" moduleKey="grades" />} />
                    <Route path={routes.department} element={<FlowWorkbench workspaceKey="department" />} />
                    <Route path={routes.departmentUsers} element={<AdminUsers workspaceKey="department" />} />
                    <Route path={routes.departmentDepartments} element={<FlowWorkbench workspaceKey="department" moduleKey="departments" />} />
                    <Route path={routes.departmentPermissions} element={<AdminPermissions workspaceKey="department" />} />
                    <Route path={routes.departmentProposals} element={<CoursesPage workspaceKey="department" />} />
                    <Route path={routes.departmentClasses} element={<ClassesPage workspaceKey="department" />} />
                    <Route path={routes.teacher} element={<FlowWorkbench workspaceKey="teacher" />} />
                    <Route path={routes.teacherUsers} element={<AdminUsers workspaceKey="teacher" />} />
                    <Route path={routes.teacherDepartments} element={<FlowWorkbench workspaceKey="teacher" moduleKey="departments" />} />
                    <Route path={routes.teacherPermissions} element={<AdminPermissions workspaceKey="teacher" />} />
                    <Route path={routes.teacherClasses} element={<ClassesPage workspaceKey="teacher" />} />
                    <Route path={routes.teacherLessons} element={<FlowWorkbench workspaceKey="teacher" moduleKey="lessons" />} />
                    <Route path={routes.teacherExams} element={<FlowWorkbench workspaceKey="teacher" moduleKey="exams" />} />
                    <Route path={routes.teacherGrades} element={<FlowWorkbench workspaceKey="teacher" moduleKey="grades" />} />
                    <Route path={routes.student} element={<FlowWorkbench workspaceKey="student" />} />
                    <Route path={routes.studentUsers} element={<AdminUsers workspaceKey="student" />} />
                    <Route path={routes.studentDepartments} element={<FlowWorkbench workspaceKey="student" moduleKey="departments" />} />
                    <Route path={routes.studentPermissions} element={<AdminPermissions workspaceKey="student" />} />
                    <Route path={routes.studentRegistration} element={<ClassesPage workspaceKey="student" />} />
                    <Route path={routes.studentClasses} element={<ClassesPage workspaceKey="student" />} />
                    <Route path={routes.studentExams} element={<FlowWorkbench workspaceKey="student" moduleKey="exams" />} />
                    <Route path={routes.studentGrades} element={<FlowWorkbench workspaceKey="student" moduleKey="grades" />} />
                    <Route path="/:workspaceKey/:moduleSegment" element={<WorkspaceModuleRoute />} />
                </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}
