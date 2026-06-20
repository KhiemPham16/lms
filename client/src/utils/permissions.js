import { flowWorkspaces, sharedRoutes } from '~/config/flowNavigation';

export const DASHBOARD_PERMISSIONS_STORAGE_KEY = 'dashboard-role-permissions';
export const DASHBOARD_PERMISSIONS_UPDATED_EVENT = 'dashboard-permissions-updated';

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
    window.localStorage.setItem(DASHBOARD_PERMISSIONS_STORAGE_KEY, JSON.stringify(nextPermissions));
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
    return roleHasPermission(normalizedRole, route.permission, permissions);
};

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
