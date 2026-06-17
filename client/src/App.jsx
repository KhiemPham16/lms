import { Navigate, Routes, Route } from 'react-router-dom';

import ProtectedRoute from '~/components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

import Login from '~/pages/Auth/Login';
import ForgotPassword from '~/pages/Auth/ForgotPassword';
import ResetPassword from '~/pages/Auth/ResetPassword';
import AdminDashboard from '~/pages/Admin/Dashboard';
import HRDashboard from '~/pages/HR/Dashboard';
import PrincipalDashboard from '~/pages/Principal/Dashboard';
import TrainingDashboard from '~/pages/TrainingOffice/Dashboard';
import DepartmentDashboard from '~/pages/DepartmentHead/Dashboard';
import TeacherDashboard from '~/pages/Teacher/Dashboard';
import StudentDashboard from '~/pages/Student/Dashboard';
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
                    <Route path={routes.admin} element={<AdminDashboard />} />
                    <Route path={routes.hr} element={<HRDashboard />} />
                    <Route path={routes.principal} element={<PrincipalDashboard />} />
                    <Route path={routes.training} element={<TrainingDashboard />} />
                    <Route path={routes.department} element={<DepartmentDashboard />} />
                    <Route path={routes.teacher} element={<TeacherDashboard />} />
                    <Route path={routes.student} element={<StudentDashboard />} />
                </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}
