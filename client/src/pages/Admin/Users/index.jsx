import { FaBell, FaPlus, FaUserPlus } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import AppSidebar from '~/components/AppSidebar';
import { flowWorkspaces } from '~/config/flowNavigation';
import { routes } from '~/config/routes';
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
    const adminName = currentUser?.fullName || 'Admin';
    const currentRole = currentUser?.role || workspace.role;
    const isAdmin = currentRole === 'ADMIN';
    const canViewUsers = roleHasPermission(currentRole, 'users.view', permissions);
    const canCreateUsers = roleHasPermission(currentRole, 'users.create', permissions);
    const canUpdateUsers = roleHasPermission(currentRole, 'users.update', permissions);
    const canLockUsers = roleHasPermission(currentRole, 'users.lock', permissions);
    const backendSupportsUserCrud = isAdmin;
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
        enabled: backendSupportsUserCrud && canViewUsers
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
                            {canCreateUsers && backendSupportsUserCrud ? (
                                <button type="button" className="is-muted" disabled title="Backend chưa có role HR">
                                    <FaUserPlus />
                                    Tạo HR
                                </button>
                            ) : null}
                            {canCreateUsers && backendSupportsUserCrud ? (
                                <button type="button" className="is-primary" onClick={() => openCreate('PRINCIPAL')}>
                                    <FaPlus />
                                    Tạo Hiệu trưởng
                                </button>
                            ) : null}
                            {canCreateUsers && !backendSupportsUserCrud ? (
                                <button type="button" className="is-muted" disabled title="Backend chỉ mở API này cho Admin">
                                    <FaUserPlus />
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

                    {canViewUsers && !backendSupportsUserCrud ? (
                        <div className="user-note">
                            Admin đã cấp quyền người dùng cho vai trò này, nhưng backend hiện chỉ cho
                            <strong> Admin</strong> gọi API danh sách và CRUD người dùng. Vì không sửa backend, FE đang
                            ẩn bảng dữ liệu thật và chỉ hiển thị trạng thái chờ API.
                        </div>
                    ) : null}

                    {canCreateUsers && backendSupportsUserCrud ? (
                        <div className="user-note">
                            Backend hiện chưa có enum role <strong>HR</strong>, nên chức năng tạo HR đang chờ bổ sung
                            backend.
                        </div>
                    ) : null}

                    {canViewUsers && backendSupportsUserCrud ? (
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
                                onEdit={openEdit}
                                onChangeStatus={changeStatus}
                                onChangePage={changePage}
                            />
                        </>
                    ) : null}
                </section>
            </main>

            {modalMode && backendSupportsUserCrud && (canCreateUsers || canUpdateUsers) ? (
                <UserFormModal
                    mode={modalMode}
                    form={form}
                    saving={saving}
                    disableRoleStatus={form.publicId === currentUser?.publicId}
                    onChange={changeForm}
                    onClose={closeModal}
                    onSubmit={submitForm}
                />
            ) : null}
        </div>
    );
}
