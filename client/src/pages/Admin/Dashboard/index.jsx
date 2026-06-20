import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell,
    FaExclamationTriangle,
    FaPlus,
    FaRegClock,
    FaSearch,
    FaUserCog,
    FaUserFriends,
    FaUserPlus,
    FaUsers
} from 'react-icons/fa';

import AppSidebar from '~/components/AppSidebar';
import { userService } from '~/services/userService';
import { useAuthStore } from '~/stores/useAuthStore';
import { routes } from '~/config/routes';
import '~/pages/FlowWorkbench/FlowWorkbench.scss';
import './AdminDashboard.scss';

const roles = [
    'ADMIN',
    'STUDENT',
    'LECTURER',
    'DEPARTMENT_HEAD',
    'TRAINING_OFFICER',
    'PRINCIPAL'
];

const roleLabels = {
    ADMIN: 'Admin',
    STUDENT: 'Học sinh',
    LECTURER: 'Giáo viên',
    DEPARTMENT_HEAD: 'Trưởng khoa',
    TRAINING_OFFICER: 'Giáo vụ',
    PRINCIPAL: 'Hiệu trưởng'
};

const formatNumber = (value) => new Intl.NumberFormat('vi-VN').format(value || 0);

const unwrap = (payload) => payload?.data || payload;

const getInitials = (name = '') =>
    name
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'U';

const getRelativeTime = (value) => {
    if (!value) return 'Chưa có';

    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.max(1, Math.floor(diffMs / 60000));

    if (minutes < 60) return `${minutes} phút trước`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;

    const days = Math.floor(hours / 24);
    if (days === 1) return 'Hôm qua';
    return `${days} ngày trước`;
};

function StatCard({ icon: Icon, label, value, badge, tone }) {
    return (
        <section className={`admin-stat admin-stat--${tone}`}>
            <div className="admin-stat__icon">
                <Icon />
            </div>
            <span className="admin-stat__badge">{badge}</span>
            <p>{label}</p>
            <strong>{value}</strong>
        </section>
    );
}

export default function AdminDashboard() {
    const navigate = useNavigate();
    const currentUser = useAuthStore((state) => state.user);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({
        totalUsers: 0,
        activeUsers: 0,
        roleCounts: {},
        recentUsers: []
    });
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;

        async function loadDashboard() {
            try {
                setLoading(true);
                setError('');

                const [totalRes, activeRes, recentRes, ...roleResponses] = await Promise.all([
                    userService.getUsers({ page: 1, limit: 1 }),
                    userService.getUsers({ page: 1, limit: 1, status: 'ACTIVE' }),
                    userService.getUsers({ page: 1, limit: 6 }),
                    ...roles.map((role) => userService.getUsers({ page: 1, limit: 1, role }))
                ]);

                if (!alive) return;

                const totalData = unwrap(totalRes);
                const activeData = unwrap(activeRes);
                const recentData = unwrap(recentRes);
                const roleCounts = roles.reduce((acc, role, index) => {
                    const data = unwrap(roleResponses[index]);
                    acc[role] = data?.meta?.total || 0;
                    return acc;
                }, {});

                setSummary({
                    totalUsers: totalData?.meta?.total || 0,
                    activeUsers: activeData?.meta?.total || 0,
                    roleCounts,
                    recentUsers: recentData?.items || []
                });
            } catch (err) {
                if (!alive) return;
                console.error(err);
                setError(err?.response?.data?.message || 'Chưa tải được dữ liệu dashboard');
            } finally {
                if (alive) setLoading(false);
            }
        }

        loadDashboard();

        return () => {
            alive = false;
        };
    }, []);

    const roleTotal = useMemo(
        () => Object.values(summary.roleCounts).reduce((total, count) => total + count, 0),
        [summary.roleCounts]
    );

    const activityRows = useMemo(() => {
        return summary.recentUsers.map((user) => {
            const latestTime = user.lastLoginAt || user.updatedAt || user.createdAt;
            const action = user.lastLoginAt
                ? 'Đăng nhập hệ thống'
                : user.updatedAt !== user.createdAt
                  ? 'Cập nhật hồ sơ người dùng'
                  : 'Tài khoản mới được tạo';

            return {
                id: user.publicId,
                name: user.fullName,
                action,
                role: roleLabels[user.role] || user.role,
                roleKey: user.role,
                time: getRelativeTime(latestTime),
                initials: getInitials(user.fullName)
            };
        });
    }, [summary.recentUsers]);

    const adminName = currentUser?.fullName || 'Admin';
    const activeRate = summary.totalUsers
        ? Math.round((summary.activeUsers / summary.totalUsers) * 100)
        : 0;

    return (
        <div className="admin-shell">
            <AppSidebar workspaceKey="admin" />

            <div className="admin-main">
                <header className="admin-topbar">
                    <div className="admin-breadcrumb">
                        <span>Khóa học</span>
                        <b>/</b>
                        <span>Lớp 10A</span>
                        <b>/</b>
                        <span>Danh sách học sinh</span>
                    </div>
                    <div className="admin-topbar__actions">
                        <button type="button" aria-label="Tìm kiếm" onClick={() => navigate(routes.adminUsers)}>
                            <FaSearch />
                        </button>
                        <button type="button" aria-label="Thông báo" className="has-dot" onClick={() => navigate(routes.notifications)}>
                            <FaBell />
                        </button>
                        <div className="admin-profile">
                            <div className="admin-profile__avatar">{getInitials(adminName)}</div>
                            <span>{adminName}</span>
                            <FaUserCog />
                        </div>
                    </div>
                </header>

                <section className="admin-content">
                    <div className="admin-hero">
                        <div>
                            <h1>Bảng điều khiển Admin</h1>
                            <p>Tổng quan hoạt động hệ thống EduLMS hôm nay.</p>
                        </div>
                        <div className="admin-hero__actions">
                            <button type="button" onClick={() => navigate(routes.adminAuditLogs)}>Xuất báo cáo</button>
                            <button type="button" className="is-primary" onClick={() => navigate(routes.adminUsers)}>
                                <FaPlus />
                                Thêm người dùng
                            </button>
                        </div>
                    </div>

                    {error ? <div className="admin-alert">{error}</div> : null}

                    <div className="admin-stats">
                        <StatCard
                            icon={FaUsers}
                            label="Tổng người dùng"
                            value={loading ? '...' : formatNumber(summary.totalUsers)}
                            badge="+ dữ liệu thật"
                            tone="blue"
                        />
                        <StatCard
                            icon={FaUserFriends}
                            label="Tài khoản đang hoạt động"
                            value={loading ? '...' : formatNumber(summary.activeUsers)}
                            badge={`${activeRate}%`}
                            tone="peach"
                        />
                        <StatCard
                            icon={FaUserCog}
                            label="Vai trò hệ thống"
                            value={formatNumber(roles.length)}
                            badge="Ổn định"
                            tone="violet"
                        />
                        <StatCard
                            icon={FaExclamationTriangle}
                            label="Log quan trọng"
                            value="--"
                            badge="Chờ BE"
                            tone="red"
                        />
                    </div>

                    <div className="admin-grid">
                        <section className="admin-panel admin-panel--activity">
                            <div className="admin-panel__heading">
                                <h2>Hoạt động gần đây</h2>
                                <button type="button" onClick={() => navigate(routes.adminAuditLogs)}>Xem tất cả</button>
                            </div>
                            <div className="admin-table">
                                <div className="admin-table__head">
                                    <span>Người dùng</span>
                                    <span>Hành động</span>
                                    <span>Vai trò</span>
                                    <span>Thời gian</span>
                                </div>
                                {loading ? (
                                    <div className="admin-empty">Đang tải dữ liệu từ hệ thống...</div>
                                ) : activityRows.length ? (
                                    activityRows.map((row) => (
                                        <div className="admin-table__row" key={row.id}>
                                            <div className="admin-user-cell">
                                                <span>{row.initials}</span>
                                                <strong>{row.name}</strong>
                                            </div>
                                            <p>{row.action}</p>
                                            <em className={`role-${row.roleKey}`}>{row.role}</em>
                                            <time>{row.time}</time>
                                        </div>
                                    ))
                                ) : (
                                    <div className="admin-empty">Chưa có hoạt động người dùng.</div>
                                )}
                            </div>
                        </section>

                        <aside className="admin-side-panels">
                            <section className="admin-panel">
                                <div className="admin-panel__heading">
                                    <h2>Hành động nhanh</h2>
                                </div>
                                <div className="quick-actions">
                                    <button type="button" onClick={() => navigate(routes.adminUsers)}>
                                        <FaUserPlus />
                                        Tạo tài khoản HR
                                    </button>
                                    <button type="button" onClick={() => navigate(routes.adminPermissions)}>
                                        <FaUserCog />
                                        Quản lý phân quyền
                                    </button>
                                    <button type="button" onClick={() => navigate(routes.adminAuditLogs)}>
                                        <FaRegClock />
                                        Xem Audit Log
                                    </button>
                                </div>
                            </section>

                            <section className="admin-panel">
                                <div className="admin-panel__heading">
                                    <h2>Trạng thái hệ thống</h2>
                                </div>
                                <div className="role-summary">
                                    <div>
                                        <span>Phân bố vai trò</span>
                                        <button type="button" onClick={() => navigate(routes.adminPermissions)}>Chi tiết</button>
                                    </div>
                                    <div className="role-bar" aria-label="Phân bố vai trò">
                                        {roles.map((role) => {
                                            const width = roleTotal ? (summary.roleCounts[role] / roleTotal) * 100 : 0;
                                            return (
                                                <span
                                                    className={`role-bar__item role-${role}`}
                                                    key={role}
                                                    style={{ width: `${Math.max(width, summary.roleCounts[role] ? 8 : 0)}%` }}
                                                    title={`${roleLabels[role]}: ${summary.roleCounts[role] || 0}`}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="role-legend">
                                        {roles.slice(0, 3).map((role) => (
                                            <span key={role}>
                                                <i className={`role-${role}`} />
                                                {roleLabels[role]}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="server-card">
                                    <div>
                                        <span>Tải Server</span>
                                        <em>Chờ dữ liệu</em>
                                    </div>
                                    <div className="server-bars" aria-hidden="true">
                                        {[28, 38, 24, 48, 62, 42, 34].map((height, index) => (
                                            <span key={index} style={{ height: `${height}%` }} />
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </aside>
                    </div>
                </section>
            </div>
        </div>
    );
}
