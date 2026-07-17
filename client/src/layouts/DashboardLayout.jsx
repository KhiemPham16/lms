import classNames from 'classnames';
import { useEffect, useMemo, useState } from 'react';
import { FiBell, FiChevronDown, FiLogOut, FiMenu, FiSearch, FiUser, FiX } from 'react-icons/fi';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { moduleMeta, roleNavigation } from '~/shared/constants/modules.js';
import { roleDashboardPaths, roleLabels, userRoles, visibleUserRolesByRole } from '~/shared/constants/roles.js';
import { adminModulesApi } from '~/shared/api/adminModulesApi.js';
import { resolveApiAssetUrl } from '~/shared/api/http.js';
import ui from '~/shared/styles/ui.module.scss';
import { useAuthStore } from '~/shared/store/authStore.js';
import styles from './DashboardLayout.module.scss';

const accountActorOptions = [
    { value: 'ALL', label: 'Tất cả tài khoản' },
    { value: userRoles.ADMIN, label: roleLabels[userRoles.ADMIN] },
    { value: userRoles.HR, label: roleLabels[userRoles.HR] },
    { value: userRoles.PRINCIPAL, label: roleLabels[userRoles.PRINCIPAL] },
    { value: userRoles.TRAINING_OFFICER, label: roleLabels[userRoles.TRAINING_OFFICER] },
    { value: userRoles.DEPARTMENT_HEAD, label: roleLabels[userRoles.DEPARTMENT_HEAD] },
    { value: userRoles.LECTURER, label: roleLabels[userRoles.LECTURER] },
    { value: userRoles.STUDENT, label: roleLabels[userRoles.STUDENT] }
];

const proposalOptions = [
    { value: 'subjectProposals', label: moduleMeta.subjectProposals.label, path: moduleMeta.subjectProposals.path },
    { value: 'classProposals', label: moduleMeta.classProposals.label, path: moduleMeta.classProposals.path }
];

export function DashboardLayout() {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [proposalMenuOpen, setProposalMenuOpen] = useState(false);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const user = useAuthStore((state) => state.user);
    const avatarUrl = resolveApiAssetUrl(user?.avatarUrl);
    const logout = useAuthStore((state) => state.logout);

    const navItems = useMemo(() => {
        const keys = roleNavigation[user?.role] ?? ['dashboard'];
        return keys.map((key) => moduleMeta[key]).filter(Boolean);
    }, [user?.role]);

    const visibleAccountActorOptions = useMemo(() => {
        const visibleRoles = visibleUserRolesByRole[user?.role] ?? [];
        const visibleActors = accountActorOptions.filter((actor) => visibleRoles.includes(actor.value));

        return visibleActors.length ? [accountActorOptions[0], ...visibleActors] : visibleActors;
    }, [user?.role]);

    const activeModule = Object.values(moduleMeta)
        .filter((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
        .sort((a, b) => b.path.length - a.path.length)[0];
    const isUsersPath = location.pathname === moduleMeta.users.path;
    const isProposalPath = proposalOptions.some((item) => item.path === location.pathname);
    const getModuleLabel = (item) =>
        user?.role === userRoles.DEPARTMENT_HEAD && item?.path === moduleMeta.approvals.path
            ? 'Quản lý đề xuất'
            : item?.label;
    const activeModuleLabel = isProposalPath ? 'Quản lý đề xuất' : getModuleLabel(activeModule) ?? 'Bảng điều khiển';

    useEffect(() => {
        let cancelled = false;
        adminModulesApi.notificationUnreadCount()
            .then((result) => { if (!cancelled) setUnreadNotificationCount(Number(result.count) || 0); })
            .catch(() => undefined);
        const handleNotificationUpdate = (event) => setUnreadNotificationCount(Number(event.detail?.count) || 0);
        window.addEventListener('notifications:updated', handleNotificationUpdate);
        return () => {
            cancelled = true;
            window.removeEventListener('notifications:updated', handleNotificationUpdate);
        };
    }, [location.pathname, user?.publicId]);

    return (
        <div className={styles.layout}>
            <aside className={classNames(styles.sidebar, { [styles.sidebarOpen]: sidebarOpen })}>
                <div className={styles.brand}>
                    <span className={styles.brandMark}>S</span>
                    <div>
                        <strong>SMART LMS</strong>
                        <small>Learning platform</small>
                    </div>
                    <button className={classNames(ui.iconButton, styles.sidebarClose)} type="button" onClick={() => setSidebarOpen(false)}>
                        <FiX />
                    </button>
                </div>

                <nav className={styles.nav} aria-label="Điều hướng chính">
                    {navItems.map((item) => {
                        const Icon = item.icon;

                        // Nhóm quản lý tài khoản hiển thị các actor ngay trong sidebar, không dùng popup.
                        if (item.path === moduleMeta.users.path) {
                            return (
                                <div className={styles.navGroup} key={item.path}>
                                    <button
                                        className={classNames(styles.navItem, styles.navButton, { [styles.navItemActive]: isUsersPath })}
                                        type="button"
                                        onClick={() => setAccountMenuOpen((current) => !current)}
                                    >
                                        <Icon />
                                        <span>{item.label}</span>
                                        <FiChevronDown className={classNames(styles.navChevron, { [styles.navChevronOpen]: accountMenuOpen })} />
                                    </button>
                                    {accountMenuOpen ? (
                                        <div className={styles.navSubmenu}>
                                            {visibleAccountActorOptions.map((actor) => {
                                                const currentActor = new URLSearchParams(location.search).get('actor');
                                                const to = actor.value === 'ALL' ? '/users' : `/users?actor=${actor.value}`;
                                                const isActive = isUsersPath && (actor.value === 'ALL' ? !currentActor : currentActor === actor.value);

                                                return (
                                                    <NavLink
                                                        className={classNames(styles.navSubitem, { [styles.navSubitemActive]: isActive })}
                                                        key={actor.value}
                                                        to={to}
                                                        onClick={() => setSidebarOpen(false)}
                                                    >
                                                        {actor.label}
                                                    </NavLink>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        }

                        // Nhóm quản lý đề xuất của Trưởng bộ môn tách đề xuất môn và đề xuất lớp thành hai trang riêng.
                        if (user?.role === userRoles.DEPARTMENT_HEAD && item.path === moduleMeta.approvals.path) {
                            return (
                                <div className={styles.navGroup} key={item.path}>
                                    <button
                                        className={classNames(styles.navItem, styles.navButton, { [styles.navItemActive]: isProposalPath || location.pathname === item.path })}
                                        type="button"
                                        onClick={() => setProposalMenuOpen((current) => !current)}
                                    >
                                        <Icon />
                                        <span>Quản lý đề xuất</span>
                                        <FiChevronDown className={classNames(styles.navChevron, { [styles.navChevronOpen]: proposalMenuOpen })} />
                                    </button>
                                    {proposalMenuOpen ? (
                                        <div className={styles.navSubmenu}>
                                            {proposalOptions.map((proposal) => (
                                                <NavLink
                                                    className={classNames(styles.navSubitem, { [styles.navSubitemActive]: location.pathname === proposal.path })}
                                                    key={proposal.value}
                                                    to={proposal.path}
                                                    onClick={() => setSidebarOpen(false)}
                                                >
                                                    {proposal.label}
                                                </NavLink>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        }

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === roleDashboardPaths[user?.role] || item.path === moduleMeta.dashboard.path}
                                className={({ isActive }) => classNames(styles.navItem, { [styles.navItemActive]: isActive })}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <Icon />
                                <span>{getModuleLabel(item)}</span>
                            </NavLink>
                        );
                    })}
                </nav>
            </aside>

            <div className={styles.main}>
                <header className={styles.topbar}>
                    <div className={styles.topbarLeft}>
                        <button className={classNames(ui.iconButton, styles.topbarMenu)} type="button" onClick={() => setSidebarOpen(true)}>
                            <FiMenu />
                        </button>
                        <div>
                            <p className={styles.breadcrumb}>Trang chủ / {activeModuleLabel}</p>
                            <h1>{activeModuleLabel}</h1>
                        </div>
                    </div>
                    <div className={styles.topbarActions}>
                        <label className={classNames(ui.searchBox, styles.searchBox)}>
                            <FiSearch />
                            <input type="search" placeholder="Tìm kiếm nhanh" />
                        </label>
                        <NavLink className={classNames(ui.iconButton, styles.notificationButton)} to="/notifications" aria-label="Thông báo">
                            <FiBell />
                            {unreadNotificationCount ? <span className={styles.notificationBadge}>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span> : null}
                        </NavLink>
                        <NavLink className={styles.userChip} to="/profile">
                            {avatarUrl ? <img className={styles.userAvatar} src={avatarUrl} alt="" /> : <FiUser />}
                            <span>{user?.fullName ?? 'Người dùng'}</span>
                            <small>{roleLabels[user?.role] ?? user?.role}</small>
                        </NavLink>
                        <button className={ui.iconButton} type="button" onClick={logout} aria-label="Đăng xuất">
                            <FiLogOut />
                        </button>
                    </div>
                </header>
                <main className={styles.contentShell}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
