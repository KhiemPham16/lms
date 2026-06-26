import { flowWorkspaces, sharedRoutes } from '~/config/flowNavigation';

export const DASHBOARD_PERMISSIONS_STORAGE_KEY = 'dashboard-role-permissions';
export const DASHBOARD_PERMISSIONS_UPDATED_EVENT = 'dashboard-permissions-updated';

export const clientToBackendPermissionMap = {
    'users.view': 'users.read',
    'users.create': 'users.create',
    'users.update': 'users.update',
    'users.lock': 'users.status',
    'permissions.manage': 'system.permissions.manage',
    'audit.view': 'system.audit.read',
    'departments.view': 'departments.read',
    'departments.create': 'departments.create',
    'departments.update': 'departments.update',
    'departments.delete': 'departments.delete',
    'programs.view': 'curriculum.read',
    'programs.create': 'curriculum.create',
    'subjects.view': 'courses.read',
    'subjects.update': 'courses.update',
    'proposals.create': 'course_proposals.create',
    'proposals.approve': 'course_proposals.approve',
    'proposals.history': 'course_proposals.history.read',
    'classes.view': 'classes.read',
    'classes.create': 'classes.create',
    'classes.assignLecturer': 'classes.assign_lecturer',
    'classes.registration': 'classes.registration.toggle',
    'lessons.view': 'lessons.read',
    'lessons.create': 'lessons.create',
    'exams.view': 'exams.read',
    'exams.create': 'exams.create',
    'exams.take': 'exams.submit',
    'exams.grade': 'exams.grade',
    'scores.view': 'grades.read',
    'scores.calculate': 'grades.calculate',
    'scores.export': 'grades.export'
};

export const backendToClientPermissionMap = Object.entries(clientToBackendPermissionMap).reduce(
    (acc, [clientPermission, backendPermission]) => ({
        ...acc,
        [backendPermission]: clientPermission
    }),
    {}
);

export const defaultRolePermissions = {
    ADMIN: ['*'],
    HR: [],
    PRINCIPAL: [],
    TRAINING_OFFICER: [],
    DEPARTMENT_HEAD: [],
    LECTURER: [],
    STUDENT: []
};

export const dashboardRoutes = [
    ...Object.values(flowWorkspaces).flatMap((workspace) => [
        {
            key: `${workspace.role}.dashboard`,
            path: workspace.dashboardPath,
            title: `Dashboard ${workspace.title}`,
            icon: null,
            end: true,
            roles: [workspace.role],
            workspaceKey: workspace.basePath.replace('/', '')
        },
        ...workspace.modules.map((module) => ({
            ...module,
            roles: module.roles || [workspace.role],
            workspaceKey: workspace.basePath.replace('/', ''),
            workspaceTitle: workspace.title
        }))
    ]),
    ...sharedRoutes.map((route) => ({
        ...route,
        roles: ['ADMIN', 'HR', 'PRINCIPAL', 'TRAINING_OFFICER', 'DEPARTMENT_HEAD', 'LECTURER', 'STUDENT'],
        shared: true
    }))
];

export const normalizeRole = (role) => String(role || '').toUpperCase();

export const toBackendPermission = (permission) => clientToBackendPermissionMap[permission] || permission;

export const toClientPermission = (permission) => backendToClientPermissionMap[permission] || permission;

export const toBackendPermissions = (permissions = []) =>
    permissions.includes('*') ? ['*'] : [...new Set(permissions.map(toBackendPermission))];

export const toClientPermissions = (permissions = []) =>
    permissions.includes('*') ? ['*'] : [...new Set(permissions.map(toClientPermission))];

export const buildDashboardPermissionsFromUser = (user) => {
    const role = normalizeRole(user?.role);
    const permissionCodes = user?.permissionCodes || user?.roleDetail?.permissionCodes || [];

    return {
        ...defaultRolePermissions,
        ...(role ? { [role]: role === 'ADMIN' ? ['*'] : toClientPermissions(permissionCodes) } : {}),
        ADMIN: ['*']
    };
};

export const readDashboardPermissions = () => {
    if (typeof window === 'undefined') return defaultRolePermissions;

    try {
        const stored = window.localStorage.getItem(DASHBOARD_PERMISSIONS_STORAGE_KEY);
        const permissions = stored ? { ...defaultRolePermissions, ...JSON.parse(stored) } : defaultRolePermissions;
        return { ...permissions, ADMIN: ['*'] };
    } catch (error) {
        console.error(error);
        return defaultRolePermissions;
    }
};

export const saveDashboardPermissions = (permissions) => {
    if (typeof window === 'undefined') return;
    const nextPermissions = { ...permissions, ADMIN: ['*'] };
    window.dispatchEvent(new CustomEvent(DASHBOARD_PERMISSIONS_UPDATED_EVENT, { detail: nextPermissions }));
};

export const roleHasPermission = (role, permission, permissions = readDashboardPermissions()) => {
    const normalizedRole = normalizeRole(role);

    if (normalizedRole === 'ADMIN') {
        return true;
    }

    const rolePermissions = permissions?.[normalizedRole] || [];

    return !permission || rolePermissions.includes(permission);
};

export const canAccessDashboardRoute = (role, route, permissions = readDashboardPermissions()) => {
    const normalizedRole = normalizeRole(role);

    if (!route?.roles?.includes(normalizedRole)) return false;
    if (!route.permission && !route.anyPermissions?.length) return true;
    if (route.permission && roleHasPermission(normalizedRole, route.permission, permissions)) return true;
    return route.anyPermissions?.some((permission) => roleHasPermission(normalizedRole, permission, permissions)) || false;
};

export const getUserPermissionCodes = (user) => {
    if (!user) return [];
    if (normalizeRole(user?.role || user?.roleDetail?.code) === 'ADMIN') return ['*'];

    return [
        ...(user?.permissionCodes || []),
        ...(user?.roleDetail?.permissionCodes || []),
        ...(user?.permissions?.map((permission) => permission.code || permission.permission?.code).filter(Boolean) || []),
        ...(user?.role?.permissions?.map((item) => item.code || item.permission?.code).filter(Boolean) || [])
    ];
};

export const userHasBackendPermission = (user, permission) => {
    if (!permission) return true;
    const permissions = getUserPermissionCodes(user);
    return permissions.includes('*') || permissions.includes(permission);
};

export const userHasAnyBackendPermission = (user, permissions = []) =>
    permissions.some((permission) => userHasBackendPermission(user, permission));

export const getDashboardRoutesByRole = (role, permissions = readDashboardPermissions()) =>
    dashboardRoutes.filter((route) => canAccessDashboardRoute(role, route, permissions));

export const getDefaultDashboardPath = (role, permissions = readDashboardPermissions()) =>
    getDashboardRoutesByRole(role, permissions)[0]?.path || '/';

export const getDashboardTitle = (pathname, role, permissions = readDashboardPermissions()) => {
    const currentRoute = dashboardRoutes.find((route) =>
        route.end ? pathname === route.path : pathname.startsWith(route.path)
    );

    if (currentRoute && canAccessDashboardRoute(role, currentRoute, permissions)) {
        return currentRoute.title;
    }

    return getDashboardRoutesByRole(role, permissions)[0]?.title || 'Dashboard';
};

export const getWorkspaceModulesByAccess = (workspace, role, permissions = readDashboardPermissions()) =>
    workspace.modules.filter((module) => canAccessDashboardRoute(role, module, permissions));
