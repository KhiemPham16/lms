export const routes = {
    login: '/login',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
    admin: '/admin',
    hr: '/hr',
    principal: '/principal',
    training: '/training',
    department: '/department',
    teacher: '/teacher',
    student: '/student'
};

export const roleRoutes = {
    ADMIN: routes.admin,
    HR: routes.hr,
    PRINCIPAL: routes.principal,
    TRAINING_OFFICER: routes.training,
    DEPARTMENT_HEAD: routes.department,
    LECTURER: routes.teacher,
    STUDENT: routes.student
};

export function getDashboardRouteByRole(role) {
    return roleRoutes[role] || routes.login;
}
