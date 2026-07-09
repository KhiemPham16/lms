import { BookOpen, Boxes, ClipboardList, FileClock, Home, Image, Shield, Users } from 'lucide-react';

export const navigationItems = [
    { title: 'Tổng quan', path: '/dashboard', icon: Home },
    {
        title: 'Quản lý người dùng',
        path: '/users',
        icon: Users,
        permissions: ['users.read'],
        children: [
            { title: 'Quản lý sinh viên', path: '/users?roles=STUDENT', permissions: ['users.read'] },
            { title: 'Quản lý giảng viên', path: '/users?roles=LECTURER,DEPARTMENT_HEAD', permissions: ['users.read'] },
            { title: 'Quản lý nhân sự', path: '/users?roles=ADMIN,HR,TRAINING_OFFICER,PRINCIPAL', permissions: ['users.read'] }
        ]
    },
    { title: 'Khoa/phòng', path: '/departments', icon: Boxes, permissions: ['departments.read'] },
    { title: 'Vai trò', path: '/roles', icon: Shield, permissions: ['system.permissions.manage'] },
    { title: 'Môn học', path: '/courses', icon: BookOpen, permissions: ['courses.read'] },
    { title: 'Media', path: '/media', icon: Image, permissions: ['media.read'] },
    { title: 'Thông báo', path: '/notifications', icon: ClipboardList, permissions: ['notifications.read'] },
    { title: 'Nhật ký', path: '/audit-logs', icon: FileClock, permissions: ['system.audit.read'] }
];

export function getUserPermissionCodes(user) {
    return user?.permissionCodes || user?.role?.permissionCodes || user?.permissions?.map((permission) => permission.code) || [];
}

export function userHasAnyPermission(user, permissions = []) {
    if (!permissions.length) return true;
    if (user?.role?.code === 'ADMIN') return true;

    const permissionCodes = getUserPermissionCodes(user);
    return permissions.some((permission) => permissionCodes.includes(permission));
}

export function getVisibleNavigationItems(user) {
    return navigationItems
        .filter((item) => userHasAnyPermission(user, item.permissions))
        .map((item) => ({
            ...item,
            children: item.children?.filter((child) => userHasAnyPermission(user, child.permissions))
        }));
}

export function getDefaultPathForUser(user) {
    return getVisibleNavigationItems(user)[0]?.path || '/dashboard';
}

export function canAccessPath(user, pathname) {
    const flatItems = navigationItems.flatMap((item) => [item, ...(item.children || [])]);
    const matchedItem = flatItems
        .filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
        .sort((a, b) => b.path.length - a.path.length)[0];

    if (!matchedItem) return true;
    return userHasAnyPermission(user, matchedItem.permissions);
}
