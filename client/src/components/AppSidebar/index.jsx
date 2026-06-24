import { useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiBell, FiGrid, FiLogOut, FiMenu, FiSettings, FiUser, FiX } from 'react-icons/fi';

import { flowWorkspaces, sharedRoutes } from '~/config/flowNavigation';
import { routes } from '~/config/routes';
import { useDashboardPermissions } from '~/hooks/useDashboardPermissions';
import { useAuthStore } from '~/stores/useAuthStore';
import { getWorkspaceModulesByAccess } from '~/utils/permissions';
import styles from '~/pages/FlowWorkbench/FlowWorkbench.module.scss';

const cx = classNames.bind(styles);

const sharedIconMap = {
    [routes.profile]: FiUser,
    [routes.notifications]: FiBell,
    [routes.settings]: FiSettings
};

export default function AppSidebar({ workspaceKey = 'student' }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [confirmLogout, setConfirmLogout] = useState(false);
    const logout = useAuthStore((state) => state.logout);
    const permissions = useDashboardPermissions();
    const workspace = flowWorkspaces[workspaceKey] || flowWorkspaces.student;
    const isDashboard = location.pathname === workspace.dashboardPath;
    const visibleModules = useMemo(
        () => getWorkspaceModulesByAccess(workspace, workspace.role, permissions),
        [permissions, workspace]
    );

    const goTo = (path) => {
        navigate(path);
        setDrawerOpen(false);
    };

    const confirmAndLogout = () => {
        setConfirmLogout(false);
        logout();
    };

    return (
        <>
            <button type="button" className={cx('flow-mobile-toggle')} onClick={() => setDrawerOpen(true)} aria-label="Mở Sidebar">
                <FiMenu />
            </button>
            <button
                type="button"
                className={cx('flow-overlay', { 'is-open': drawerOpen })}
                onClick={() => setDrawerOpen(false)}
                aria-label="Đóng Sidebar"
            />

            <aside className={cx('flow-sidebar', { 'is-collapsed': collapsed, 'is-open': drawerOpen })}>
                <div className={cx('flow-brand')}>
                    <button type="button" className={cx('flow-brand__link')} onClick={() => goTo(workspace.dashboardPath)}>
                        <div>E</div>
                        {!collapsed && (
                            <span>
                                <strong>EduLMS</strong>
                                <small>{workspace.title}</small>
                            </span>
                        )}
                    </button>
                    <button type="button" className={cx('flow-sidebar__toggle')} onClick={() => setCollapsed((value) => !value)} aria-label="Thu gọn Sidebar">
                        {collapsed ? <FiMenu /> : <FiX />}
                    </button>
                </div>

                <nav className={cx('flow-nav')} aria-label={`${workspace.title} navigation`}>
                    <button
                        type="button"
                        className={cx({ 'is-active': isDashboard })}
                        onClick={() => goTo(workspace.dashboardPath)}
                        title={collapsed ? 'Dashboard' : undefined}
                        aria-current={isDashboard ? 'page' : undefined}
                    >
                        <FiGrid />
                        {!collapsed && <span>Dashboard</span>}
                    </button>
                    {visibleModules.map((module) => {
                        const Icon = module.icon;
                        const active = location.pathname === module.path;

                        return (
                            <button
                                key={module.key}
                                type="button"
                                className={cx({ 'is-active': active })}
                                onClick={() => goTo(module.path)}
                                title={collapsed ? module.title : undefined}
                                aria-current={active ? 'page' : undefined}
                            >
                                <Icon />
                                {!collapsed && <span>{module.title}</span>}
                            </button>
                        );
                    })}
                </nav>

                <div className={cx('flow-sidebar__bottom')}>
                    {sharedRoutes.map((route) => {
                        const Icon = sharedIconMap[route.path] || route.icon;
                        const active = location.pathname === route.path;

                        return (
                            <button
                                key={route.path}
                                type="button"
                                className={cx({ 'is-active': active })}
                                onClick={() => goTo(route.path)}
                                title={collapsed ? route.title : undefined}
                                aria-current={active ? 'page' : undefined}
                            >
                                <Icon />
                                {!collapsed && <span>{route.title}</span>}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        className={cx({ 'is-active': location.pathname === routes.settings })}
                        onClick={() => goTo(routes.settings)}
                        title={collapsed ? 'Cài đặt' : undefined}
                    >
                        <FiSettings />
                        {!collapsed && <span>Cài đặt</span>}
                    </button>
                    <button type="button" className={cx('is-danger')} onClick={() => setConfirmLogout(true)} title={collapsed ? 'Đăng xuất' : undefined}>
                        <FiLogOut />
                        {!collapsed && <span>Đăng xuất</span>}
                    </button>
                </div>
            </aside>

            {confirmLogout && (
                <div className={cx('flow-logout-backdrop')} role="presentation">
                    <section className={cx('flow-logout-dialog')} role="dialog" aria-modal="true" aria-labelledby="flow-logout-title">
                        <div><FiLogOut /></div>
                        <h2 id="flow-logout-title">Xác nhận đăng xuất</h2>
                        <p>Bạn có chắc chắn muốn rời khỏi phiên làm việc EduLMS hiện tại không?</p>
                        <footer>
                            <button type="button" onClick={() => setConfirmLogout(false)}>Hủy</button>
                            <button type="button" onClick={confirmAndLogout}>Đăng xuất</button>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
}
