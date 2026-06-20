import { FaBell, FaChevronDown, FaSearch } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import AppSidebar from '~/components/AppSidebar';
import { routes } from '~/config/routes';
import { useAuthStore } from '~/stores/useAuthStore';
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
    const {
        activeRole,
        activeRoleLabel,
        selectedPermissions,
        hasWildcard,
        openGroups,
        hasChanges,
        showAudit,
        setActiveRole,
        setShowAudit,
        togglePermission,
        toggleGroup,
        toggleOpenGroup,
        resetChanges,
        savePermissions
    } = useAdminPermissions();

    const adminName = currentUser?.fullName || 'Admin EduLMS';

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
                                <span>Administrator</span>
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
                        onTogglePermission={togglePermission}
                        onToggleGroup={toggleGroup}
                        onToggleOpenGroup={toggleOpenGroup}
                    />
                </section>

                <PermissionSaveBar
                    activeRoleLabel={activeRoleLabel}
                    hasChanges={hasChanges}
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
