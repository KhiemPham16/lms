import { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { FiRefreshCw } from 'react-icons/fi';

import { useAuthStore } from '~/stores/useAuthStore';
import { useAdminDashboardStore } from '~/stores/useAdminDashboardStore';
import { formatNumber } from '~/utils/formatNumber';
import AppSidebar from '~/components/AppSidebar';

import styles from './AdminDashboard.module.scss';
import { kpiIcons, mockAlerts } from './data/adminDashboardMock';
import ActivityTimeline from './components/ActivityTimeline';
import AdminDashboardHeader from './components/AdminDashboardHeader';
import AlertsPanel from './components/AlertsPanel';
import CreateAdminUserModal from './components/CreateAdminUserModal';
import GrowthLineChart from './components/GrowthLineChart';
import KpiCard from './components/KpiCard';
import QuickActions from './components/QuickActions';
import RecentUsersTable from './components/RecentUsersTable';
import RoleBarChart from './components/RoleBarChart';
import SectionCard from './components/SectionCard';
import ServiceStatus from './components/ServiceStatus';
import Skeleton from './components/Skeleton';
import StatusDonutChart from './components/StatusDonutChart';

const cx = classNames.bind(styles);

const todayLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
}).format(new Date());

export default function AdminDashboard() {
    const [darkMode, setDarkMode] = useState(false);
    const [modalRole, setModalRole] = useState(null);

    const user = useAuthStore((state) => state.user);
    const {
        loading,
        error,
        overview,
        roleDistribution,
        growth,
        statusDistribution,
        recentUsers,
        activities,
        services,
        fetchDashboard,
        createPrivilegedUser
    } = useAdminDashboardStore();

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const kpis = useMemo(() => {
        const data = overview || { total: 1258, active: 1201, locked: 12, hr: 5, principal: 2, newThisMonth: 68 };
        const activeRate = data.total ? Math.round((data.active / data.total) * 100) : 0;

        return [
            { key: 'total', label: 'Tổng tài khoản', value: data.total, hint: '+8,2% so với tháng trước', icon: kpiIcons.total },
            { key: 'active', label: 'Đang hoạt động', value: data.active, hint: `${activeRate}% trên tổng`, icon: kpiIcons.active },
            { key: 'locked', label: 'Tài khoản bị khóa', value: data.locked, hint: 'Cần kiểm tra bảo mật', icon: kpiIcons.locked, danger: true },
            { key: 'hr', label: 'Tổng HR', value: data.hr, hint: 'Quản trị nhân sự', icon: kpiIcons.hr },
            { key: 'principal', label: 'Tổng Hiệu trưởng', value: data.principal, hint: 'Tài khoản cấp trường', icon: kpiIcons.principal },
            { key: 'newThisMonth', label: 'Người dùng mới', value: data.newThisMonth, hint: '+12% trong tháng', icon: kpiIcons.newThisMonth }
        ];
    }, [overview]);

    return (
        <div className={cx('dashboard', { dark: darkMode })}>
            <AppSidebar workspaceKey="admin" />

            <div className={cx('workspace')}>
                <AdminDashboardHeader
                    darkMode={darkMode}
                    onToggleTheme={() => setDarkMode((value) => !value)}
                />

                <main className={cx('content')}>
                    <section className={cx('hero')}>
                        <div>
                            <span>{todayLabel}</span>
                            <h2>Xin chào, {user?.fullName || 'Admin'}!</h2>
                            <p>Đây là tình hình hoạt động của hệ thống LMS hôm nay.</p>
                            {overview && <small>Đang theo dõi {formatNumber(overview.total)} tài khoản trong hệ thống.</small>}
                            {error && <small>Đang hiển thị dữ liệu dự phòng vì API chưa sẵn sàng.</small>}
                        </div>
                        <button type="button" onClick={fetchDashboard} disabled={loading}>
                            <FiRefreshCw /> {loading ? 'Đang tải...' : 'Làm mới dữ liệu'}
                        </button>
                    </section>

                    <section className={cx('kpiGrid')}>
                        {kpis.map((item) => <KpiCard key={item.key} item={item} loading={loading} />)}
                    </section>

                    <section className={cx('chartGrid')}>
                        <SectionCard title="Người dùng theo vai trò" action={<select aria-label="Lọc theo năm"><option>2026</option><option>2025</option></select>}>
                            {loading ? <Skeleton className={cx('chartSkeleton')} /> : <RoleBarChart data={roleDistribution} />}
                        </SectionCard>
                        <SectionCard title="Tăng trưởng tài khoản" action={<select aria-label="Khoảng thời gian"><option>12 tháng</option><option>6 tháng</option><option>30 ngày</option><option>7 ngày</option></select>}>
                            {loading ? <Skeleton className={cx('chartSkeleton')} /> : <GrowthLineChart data={growth} />}
                        </SectionCard>
                        <SectionCard title="Phân bố trạng thái tài khoản">
                            {loading ? <Skeleton className={cx('chartSkeleton')} /> : <StatusDonutChart data={statusDistribution} />}
                        </SectionCard>
                        <QuickActions onCreate={setModalRole} />
                    </section>

                    <section className={cx('lowerGrid')}>
                        <RecentUsersTable users={recentUsers} />
                        <AlertsPanel alerts={mockAlerts} />
                    </section>

                    <section className={cx('lowerGrid')}>
                        <ActivityTimeline activities={activities} />
                        <ServiceStatus services={services} />
                    </section>
                </main>
            </div>

            <CreateAdminUserModal role={modalRole} onClose={() => setModalRole(null)} onSubmit={createPrivilegedUser} />
        </div>
    );
}
