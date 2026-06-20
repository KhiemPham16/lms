import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell,
    FaCheckCircle,
    FaChevronRight,
    FaExclamationCircle,
    FaPlay,
    FaRegClock
} from 'react-icons/fa';

import AppSidebar from '~/components/AppSidebar';
import { flowWorkspaces } from '~/config/flowNavigation';
import { routes } from '~/config/routes';
import { useDashboardPermissions } from '~/hooks/useDashboardPermissions';
import { useAuthStore } from '~/stores/useAuthStore';
import { canAccessDashboardRoute, getWorkspaceModulesByAccess } from '~/utils/permissions';
import './FlowWorkbench.scss';

const getInitials = (name = '') =>
    name
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'U';

function getWorkspace(workspaceKey) {
    return flowWorkspaces[workspaceKey] || flowWorkspaces.student;
}

function getModule(workspace, moduleKey) {
    if (!moduleKey || moduleKey === 'dashboard') return null;
    return workspace.modules.find((module) => module.key === moduleKey) || workspace.modules[0];
}

export default function FlowWorkbench({ workspaceKey, moduleKey }) {
    const navigate = useNavigate();
    const currentUser = useAuthStore((state) => state.user);
    const permissions = useDashboardPermissions();

    const workspace = getWorkspace(workspaceKey);
    const activeModule = getModule(workspace, moduleKey);
    const isDashboard = !activeModule;
    const adminName = currentUser?.fullName || workspace.title;
    const workspaceRole = workspace.role;
    const visibleModules = getWorkspaceModulesByAccess(workspace, workspaceRole, permissions);
    const canViewActiveModule = !activeModule || canAccessDashboardRoute(workspaceRole, activeModule, permissions);

    const overviewStats = useMemo(
        () => [
            { label: 'Nhóm chức năng', value: visibleModules.length },
            { label: 'Use case chính', value: visibleModules.reduce((total, item) => total + item.actions.length, 0) },
            { label: 'Trạng thái API', value: visibleModules.filter((item) => item.status.includes('Chờ')).length }
        ],
        [visibleModules]
    );

    const selectedModules = isDashboard ? visibleModules : canViewActiveModule ? [activeModule] : [];

    return (
        <div className="flow-shell">
            <AppSidebar workspaceKey={workspaceKey} />

            <main className="flow-main">
                <header className="flow-topbar">
                    <div className="flow-breadcrumb">
                        <span>{workspace.title}</span>
                        <FaChevronRight />
                        <strong>{isDashboard ? 'Dashboard' : activeModule.title}</strong>
                    </div>
                    <div className="flow-profile">
                        <button type="button" aria-label="Thông báo" onClick={() => navigate(routes.notifications)}>
                            <FaBell />
                        </button>
                        <div>{getInitials(adminName)}</div>
                        <span>{adminName}</span>
                    </div>
                </header>

                <section className="flow-content">
                    <div className="flow-hero">
                        <div>
                            <p>{workspace.subtitle}</p>
                            <h1>{isDashboard ? `Dashboard ${workspace.title}` : activeModule.title}</h1>
                            <span>
                                {isDashboard
                                    ? 'Tổng quan các chức năng được thiết kế theo sơ đồ usecase và flow hoạt động.'
                                    : activeModule.description}
                            </span>
                        </div>
                        <button type="button">
                            <FaPlay />
                            Bắt đầu flow
                        </button>
                    </div>

                    {isDashboard ? (
                        <div className="flow-stats">
                            {overviewStats.map((stat) => (
                                <article key={stat.label}>
                                    <span>{stat.label}</span>
                                    <strong>{stat.value}</strong>
                                </article>
                            ))}
                        </div>
                    ) : null}

                    <div className="flow-grid">
                        {selectedModules.map((module) => {
                            const Icon = module.icon;
                            return (
                                <article className="flow-card" key={module.key}>
                                    <div className="flow-card__head">
                                        <div>
                                            <Icon />
                                        </div>
                                        <span className={module.status.includes('Chờ') ? 'is-waiting' : ''}>
                                            {module.status.includes('Chờ') ? <FaRegClock /> : <FaCheckCircle />}
                                            {module.status}
                                        </span>
                                    </div>
                                    <h2>{module.title}</h2>
                                    <p>{module.description}</p>
                                    <div className="flow-actions">
                                        {module.actions.map((action) => (
                                            <span key={action}>
                                                <FaCheckCircle />
                                                {action}
                                            </span>
                                        ))}
                                    </div>
                                    {isDashboard ? (
                                        <button type="button" onClick={() => navigate(module.path)}>
                                            Mở chức năng
                                            <FaChevronRight />
                                        </button>
                                    ) : null}
                                </article>
                            );
                        })}
                    </div>

                    {!selectedModules.length ? (
                        <section className="flow-process">
                            <div className="flow-process__title">
                                <FaExclamationCircle />
                                <div>
                                    <h2>Chưa được phân quyền</h2>
                                    <p>Chức năng này chưa được Admin cấp cho vai trò hiện tại.</p>
                                </div>
                            </div>
                        </section>
                    ) : null}

                    {!isDashboard && selectedModules.length ? (
                        <section className="flow-process">
                            <div className="flow-process__title">
                                <FaExclamationCircle />
                                <div>
                                    <h2>Luồng xử lý theo sơ đồ</h2>
                                    <p>FE đã có route và vùng thao tác. Khi backend bổ sung API, màn này sẽ nối dữ liệu thật.</p>
                                </div>
                            </div>
                            <ol>
                                <li>Người dùng mở chức năng và hệ thống kiểm tra quyền theo vai trò.</li>
                                <li>Người dùng nhập hoặc lọc dữ liệu theo nghiệp vụ trong sơ đồ flow.</li>
                                <li>Hệ thống validate dữ liệu, hiển thị lỗi hoặc cho phép lưu.</li>
                                <li>Thao tác quan trọng sẽ ghi Audit Log và gửi thông báo liên quan.</li>
                            </ol>
                        </section>
                    ) : null}
                </section>
            </main>
        </div>
    );
}
