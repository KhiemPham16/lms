import { FaBell, FaPlus, FaUserPlus } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import AppSidebar from '~/components/AppSidebar';
import { flowWorkspaces } from '~/config/flowNavigation';
import { routes } from '~/config/routes';
import { hrManagedRoleOptions, userRoleOptions } from '~/config/userManagement';
import { useDashboardPermissions } from '~/hooks/useDashboardPermissions';
import { useAuthStore } from '~/stores/useAuthStore';
import { roleHasPermission } from '~/utils/permissions';
import { getInitials } from '~/utils/string';
import '~/pages/FlowWorkbench/FlowWorkbench.scss';
import '../Dashboard/AdminDashboard.scss';
import UserFormModal from './components/UserFormModal';
import UserStats from './components/UserStats';
import UserTable from './components/UserTable';
import UserToolbar from './components/UserToolbar';
import { useAdminUsers } from './hooks/useAdminUsers';
import './Users.scss';

export default function AdminUsers({ workspaceKey = 'admin' }) {
    const navigate = useNavigate();
    const currentUser = useAuthStore((state) => state.user);
    const permissions = useDashboardPermissions();
    const workspace = flowWorkspaces[workspaceKey] || flowWorkspaces.admin;
    const adminName = currentUser?.fullName || workspace.title || 'Admin';
    const currentRole = currentUser?.role || workspace.role;
    const canViewUsers = roleHasPermission(currentRole, 'users.view', permissions);
    const canCreateUsers = roleHasPermission(currentRole, 'users.create', permissions);
    const canUpdateUsers = roleHasPermission(currentRole, 'users.update', permissions);
    const canLockUsers = roleHasPermission(currentRole, 'users.lock', permissions);
    const canManageHighRoles = currentRole === 'ADMIN';
    const roleOptions = canManageHighRoles ? userRoleOptions : hrManagedRoleOptions;
    const defaultCreateRole = canManageHighRoles ? 'PRINCIPAL' : 'TRAINING_OFFICER';
    const canManageUser = (user) =>
        canManageHighRoles || hrManagedRoleOptions.some((role) => role.value === user.role);
    const {
        users,
        meta,
        filters,
        loading,
        saving,
        modalMode,
        form,
        activeUsers,
        lockedUsers,
        updateFilter,
        applyFilters,
        openCreate,
        openEdit,
        closeModal,
        changeForm,
        submitForm,
        changeStatus,
        changePage
    } = useAdminUsers(currentUser?.publicId, {
        enabled: canViewUsers
    });

    return (
        <div className="admin-shell user-shell">
            <AppSidebar workspaceKey={workspaceKey} />

            <main className="admin-main user-main">
                <header className="flow-topbar">
                    <div className="flow-breadcrumb">
                        <span>{workspace.title}</span>
                        <strong>Quản lý người dùng</strong>
                    </div>
                    <div className="flow-profile">
                        <button type="button" aria-label="Thông báo" onClick={() => navigate(routes.notifications)}>
                            <FaBell />
                        </button>
                        <div>{getInitials(adminName)}</div>
                        <span>{adminName}</span>
                    </div>
                </header>

                <section className="user-content">
                    <div className="user-hero">
                        <div>
                            <h1>Quản lý người dùng</h1>
                            <p>
                                Xem danh sách, tạo tài khoản, cập nhật thông tin và khóa hoặc mở khóa người dùng theo
                                quyền được cấp.
                            </p>
                        </div>
                        <div className="user-hero__actions">
                            {canCreateUsers && canManageHighRoles ? (
                                <button type="button" className="is-muted" onClick={() => openCreate('HR')}>
                                    <FaUserPlus />
                                    Tạo HR
                                </button>
                            ) : null}
                            {canCreateUsers && canManageHighRoles ? (
                                <button type="button" className="is-primary" onClick={() => openCreate('PRINCIPAL')}>
                                    <FaPlus />
                                    Tạo hiệu trưởng
                                </button>
                            ) : null}
                            {canCreateUsers && !canManageHighRoles ? (
                                <button type="button" className="is-primary" onClick={() => openCreate(defaultCreateRole)}>
                                    <FaPlus />
                                    Tạo tài khoản
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {!canViewUsers ? (
                        <div className="user-note">
                            Tài khoản hiện tại chưa được Admin cấp quyền xem danh sách người dùng.
                        </div>
                    ) : null}

                    {canViewUsers ? (
                        <>
                            <UserStats total={meta.total} activeUsers={activeUsers} lockedUsers={lockedUsers} />
                            <UserToolbar filters={filters} onFilterChange={updateFilter} onSubmit={applyFilters} />
                            <UserTable
                                users={users}
                                meta={meta}
                                loading={loading}
                                canUpdate={canUpdateUsers}
                                canLock={canLockUsers}
                                currentUserPublicId={currentUser?.publicId}
                                canManageUser={canManageUser}
                                onEdit={openEdit}
                                onChangeStatus={changeStatus}
                                onChangePage={changePage}
                            />
                        </>
                    ) : null}
                </section>
            </main>

            {modalMode && (canCreateUsers || canUpdateUsers) ? (
                <UserFormModal
                    mode={modalMode}
                    form={form}
                    saving={saving}
                    disableRoleStatus={form.publicId === currentUser?.publicId}
                    roleOptions={roleOptions}
                    onChange={changeForm}
                    onClose={closeModal}
                    onSubmit={submitForm}
                />
            ) : null}
        </div>
    );
}
