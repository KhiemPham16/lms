import { FaBell, FaChevronDown, FaSearch } from 'react-icons/fa';
import { Navigate, useNavigate } from 'react-router-dom';

import AppSidebar from '~/components/AppSidebar';
import { getDashboardRouteByRole, routes } from '~/config/routes';
import { userRoleLabels } from '~/config/userManagement';
import { useDashboardPermissions } from '~/hooks/useDashboardPermissions';
import { useAuthStore } from '~/stores/useAuthStore';
import { roleHasPermission } from '~/utils/permissions';
import { getInitials } from '~/utils/string';
import '~/pages/FlowWorkbench/FlowWorkbench.scss';
import '../Dashboard/AdminDashboard.scss';
import AuditDrawer from './components/AuditDrawer';
import PermissionGroups from './components/PermissionGroups';
import PermissionRoleTabs from './components/PermissionRoleTabs';
import PermissionSaveBar from './components/PermissionSaveBar';
import { useAdminPermissions } from './hooks/useAdminPermissions';
import './Permissions.scss';

export default function AdminPermissions() {
    const navigate = useNavigate();
    const currentUser = useAuthStore((state) => state.user);
    const permissions = useDashboardPermissions();
    const {
        activeRole,
        activeRoleLabel,
        selectedPermissions,
        hasWildcard,
        openGroups,
        hasChanges,
        showAudit,
        isLoading,
        isSaving,
        setActiveRole,
        setShowAudit,
        togglePermission,
        toggleGroup,
        toggleOpenGroup,
        resetChanges,
        savePermissions
    } = useAdminPermissions();

    const adminName = currentUser?.fullName || 'Admin EduLMS';
    const currentRoleLabel = userRoleLabels[currentUser?.role] || currentUser?.roleDetail?.name || currentUser?.role || '';
    const currentRole = currentUser?.role;

    if (currentRole && (currentRole !== 'ADMIN' || !roleHasPermission(currentRole, 'permissions.manage', permissions))) {
        return <Navigate to={getDashboardRouteByRole(currentRole)} replace />;
    }

    return (
        <div className="admin-shell permission-shell">
            <AppSidebar workspaceKey="admin" />

            <div className="admin-main permission-main">
                <header className="admin-topbar permission-topbar">
                    <div className="admin-breadcrumb permission-breadcrumb">
                        <span>Quản trị hệ thống</span>
                        <b>&gt;</b>
                        <span className="is-current">Quản lý Phân quyền</span>
                    </div>
                    <div className="admin-topbar__actions">
                        <button
                            type="button"
                            aria-label="Thông báo"
                            className="has-dot"
                            onClick={() => navigate(routes.notifications)}
                        >
                            <FaBell />
                        </button>
                        <button type="button" aria-label="Tìm kiếm" onClick={() => navigate(routes.adminUsers)}>
                            <FaSearch />
                        </button>
                        <div className="permission-profile">
                            <div className="admin-profile__avatar">{getInitials(adminName, 'AD')}</div>
                            <div>
                                <strong>{adminName}</strong>
                                <span>{currentRoleLabel}</span>
                            </div>
                            <FaChevronDown />
                        </div>
                    </div>
                </header>

                <section className="permission-content">
                    <div className="permission-hero">
                        <div>
                            <h1>Quản lý vai trò và phân quyền</h1>
                            <p>Thiết lập quyền hạn chi tiết cho từng nhóm người dùng trong hệ thống.</p>
                        </div>
                        <button type="button" className="permission-primary">
                            + Thêm vai trò mới
                        </button>
                    </div>

                    <PermissionRoleTabs activeRole={activeRole} onChangeRole={setActiveRole} />
                    <PermissionGroups
                        selectedPermissions={selectedPermissions}
                        hasWildcard={hasWildcard}
                        openGroups={openGroups}
                        onTogglePermission={isLoading || isSaving ? () => {} : togglePermission}
                        onToggleGroup={isLoading || isSaving ? () => {} : toggleGroup}
                        onToggleOpenGroup={toggleOpenGroup}
                    />
                </section>

                <PermissionSaveBar
                    activeRoleLabel={activeRoleLabel}
                    hasChanges={hasChanges}
                    isSaving={isSaving}
                    onReset={resetChanges}
                    onSave={savePermissions}
                />
            </div>

            {showAudit ? (
                <AuditDrawer
                    adminName={adminName}
                    activeRoleLabel={activeRoleLabel}
                    onClose={() => setShowAudit(false)}
                />
            ) : null}
        </div>
    );
}
