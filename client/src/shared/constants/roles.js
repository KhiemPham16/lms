export const userRoles = {
    ADMIN: 'ADMIN',
    HR: 'HR',
    PRINCIPAL: 'PRINCIPAL',
    TRAINING_OFFICER: 'TRAINING_OFFICER',
    DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
    LECTURER: 'LECTURER',
    STUDENT: 'STUDENT'
};

export const roleLabels = {
    [userRoles.ADMIN]: 'Quản trị hệ thống',
    [userRoles.HR]: 'Nhân sự',
    [userRoles.PRINCIPAL]: 'Hiệu trưởng',
    [userRoles.TRAINING_OFFICER]: 'Phòng đào tạo',
    [userRoles.DEPARTMENT_HEAD]: 'Trưởng bộ môn',
    [userRoles.LECTURER]: 'Giảng viên',
    [userRoles.STUDENT]: 'Sinh viên'
};

export const allUserRoles = [
    userRoles.ADMIN,
    userRoles.PRINCIPAL,
    userRoles.HR,
    userRoles.TRAINING_OFFICER,
    userRoles.DEPARTMENT_HEAD,
    userRoles.LECTURER,
    userRoles.STUDENT
];

export const managedUserRolesByRole = {
    [userRoles.ADMIN]: [
        userRoles.PRINCIPAL,
        userRoles.HR,
        userRoles.TRAINING_OFFICER,
        userRoles.DEPARTMENT_HEAD,
        userRoles.LECTURER,
        userRoles.STUDENT
    ],
    [userRoles.HR]: [userRoles.TRAINING_OFFICER, userRoles.DEPARTMENT_HEAD, userRoles.LECTURER, userRoles.STUDENT]
};

export const visibleUserRolesByRole = {
    [userRoles.ADMIN]: allUserRoles,
    [userRoles.HR]: managedUserRolesByRole[userRoles.HR],
    [userRoles.PRINCIPAL]: allUserRoles
};

export const roleDashboardPaths = {
    [userRoles.ADMIN]: '/admin',
    [userRoles.HR]: '/hr',
    [userRoles.PRINCIPAL]: '/principal',
    [userRoles.TRAINING_OFFICER]: '/training',
    [userRoles.DEPARTMENT_HEAD]: '/department-head',
    [userRoles.LECTURER]: '/lecturer',
    [userRoles.STUDENT]: '/student'
};

export function getHomePath(role) {
    return roleDashboardPaths[role] ?? '/dashboard';
}
