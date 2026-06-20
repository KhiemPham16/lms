import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaCog, FaSignOutAlt, FaTachometerAlt } from 'react-icons/fa';

import { flowWorkspaces, sharedRoutes } from '~/config/flowNavigation';
import { routes } from '~/config/routes';
import { useDashboardPermissions } from '~/hooks/useDashboardPermissions';
import { useAuthStore } from '~/stores/useAuthStore';
import { getWorkspaceModulesByAccess } from '~/utils/permissions';
import '~/pages/FlowWorkbench/FlowWorkbench.scss';

export default function AppSidebar({ workspaceKey }) {
    const navigate = useNavigate();
    const location = useLocation();
    const logout = useAuthStore((state) => state.logout);
    const permissions = useDashboardPermissions();
    const workspace = flowWorkspaces[workspaceKey] || flowWorkspaces.student;
    const isDashboard = location.pathname === workspace.dashboardPath;
    const visibleModules = getWorkspaceModulesByAccess(workspace, workspace.role, permissions);

    return (
        <aside className="flow-sidebar">
            <Link className="flow-brand" to={workspace.dashboardPath}>
                <div>E</div>
                <span>
                    <strong>EduLMS</strong>
                    <small>{workspace.title}</small>
                </span>
            </Link>

            <nav className="flow-nav" aria-label={`${workspace.title} navigation`}>
                <button
                    type="button"
                    className={isDashboard ? 'is-active' : ''}
                    onClick={() => navigate(workspace.dashboardPath)}
                >
                    <FaTachometerAlt />
                    Dashboard
                </button>
                {visibleModules.map((module) => {
                    const Icon = module.icon;
                    return (
                        <button
                            key={module.key}
                            type="button"
                            className={location.pathname === module.path ? 'is-active' : ''}
                            onClick={() => navigate(module.path)}
                        >
                            <Icon />
                            {module.title}
                        </button>
                    );
                })}
            </nav>

            <div className="flow-sidebar__bottom">
                {sharedRoutes.map((route) => {
                    const Icon = route.icon;
                    return (
                        <button
                            key={route.path}
                            type="button"
                            className={location.pathname === route.path ? 'is-active' : ''}
                            onClick={() => navigate(route.path)}
                        >
                            <Icon />
                            {route.title}
                        </button>
                    );
                })}
                <button
                    type="button"
                    className={location.pathname === routes.settings ? 'is-active' : ''}
                    onClick={() => navigate(routes.settings)}
                >
                    <FaCog />
                    Cài đặt
                </button>
                <button type="button" className="is-danger" onClick={logout}>
                    <FaSignOutAlt />
                    Đăng xuất
                </button>
            </div>
        </aside>
    );
}
