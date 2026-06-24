import { create } from 'zustand';
import { toast } from 'sonner';

import { adminDashboardService } from '~/services/adminDashboardService';
import {
    mockActivities,
    mockGrowth,
    mockRecentUsers,
    mockRoleDistribution,
    mockServices,
    mockStatusDistribution,
    roleLabels
} from '~/pages/Admin/Dashboard/data/adminDashboardMock';

const unwrapItems = (payload) => payload?.data?.items || payload?.items || [];
const unwrapMeta = (payload) => payload?.data?.meta || payload?.meta || {};

const buildRoleDistribution = (users) => {
    if (!users.length) return mockRoleDistribution;

    const counts = users.reduce((acc, user) => {
        const role = user.role || user.roleDetail?.code || 'UNKNOWN';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
    }, {});

    return Object.entries(roleLabels).map(([key, label]) => ({
        key,
        label,
        value: counts[key] || 0
    }));
};

const buildStatusDistribution = (users) => {
    if (!users.length) return mockStatusDistribution;

    const palette = {
        ACTIVE: '#22c55e',
        PENDING: '#f59e0b',
        LOCKED: '#ef4444',
        INACTIVE: '#94a3b8'
    };
    const labels = {
        ACTIVE: 'Đang hoạt động',
        PENDING: 'Chưa kích hoạt',
        LOCKED: 'Bị khóa',
        INACTIVE: 'Ngừng hoạt động'
    };
    const counts = users.reduce((acc, user) => {
        const status = user.status || 'PENDING';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    return Object.keys(labels).map((key) => ({
        key,
        label: labels[key],
        value: counts[key] || 0,
        color: palette[key]
    }));
};

const buildRecentUsers = (users) => {
    if (!users.length) return mockRecentUsers;

    return users.slice(0, 6).map((user) => ({
        name: user.fullName,
        email: user.email,
        role: user.role || user.roleDetail?.code || 'STUDENT',
        creator: 'Hệ thống',
        createdAt: user.createdAt,
        status: user.status
    }));
};

const buildActivities = (auditLogs) => {
    if (!auditLogs.length) return mockActivities;

    return auditLogs.slice(0, 6).map((log) => ({
        actor: log.actor?.fullName || 'Hệ thống',
        action: `${log.action || 'UPDATE'} trong ${log.module || 'hệ thống'}`,
        target: log.targetType || log.targetPublicId || 'bản ghi',
        time: log.createdAt,
        success: !['DELETE', 'REJECT'].includes(log.action)
    }));
};

const buildServices = (health) => {
    if (!health) return mockServices;

    return mockServices.map((item) =>
        item.name === 'Backend API'
            ? { ...item, status: health.status === 'ok' ? 'Operational' : 'Down', response: `${health.apiCount || 0} API` }
            : item
    );
};

export const useAdminDashboardStore = create((set, get) => ({
    loading: false,
    error: null,
    lastUpdatedAt: null,
    overview: null,
    roleDistribution: mockRoleDistribution,
    growth: mockGrowth,
    statusDistribution: mockStatusDistribution,
    recentUsers: mockRecentUsers,
    activities: mockActivities,
    services: mockServices,

    fetchDashboard: async () => {
        set({ loading: true, error: null });

        try {
            const [usersRes, auditRes, healthRes] = await Promise.allSettled([
                adminDashboardService.getUsers({ page: 1, limit: 100 }),
                adminDashboardService.getAuditLogs({ page: 1, limit: 10 }),
                adminDashboardService.getHealth()
            ]);

            const usersPayload = usersRes.status === 'fulfilled' ? usersRes.value : null;
            const auditPayload = auditRes.status === 'fulfilled' ? auditRes.value : null;
            const health = healthRes.status === 'fulfilled' ? healthRes.value : null;
            const users = unwrapItems(usersPayload);
            const auditLogs = unwrapItems(auditPayload);
            const meta = unwrapMeta(usersPayload);
            const roleDistribution = buildRoleDistribution(users);
            const statusDistribution = buildStatusDistribution(users);
            const total = meta.total || users.length || 1258;
            const active = statusDistribution.find((item) => item.key === 'ACTIVE')?.value || 1201;
            const locked = statusDistribution.find((item) => item.key === 'LOCKED')?.value || 12;
            const hr = roleDistribution.find((item) => item.key === 'HR')?.value || 5;
            const principal = roleDistribution.find((item) => item.key === 'PRINCIPAL')?.value || 2;

            set({
                loading: false,
                overview: {
                    total,
                    active,
                    locked,
                    hr,
                    principal,
                    newThisMonth: users.length ? users.filter((user) => {
                        const date = new Date(user.createdAt);
                        const now = new Date();
                        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                    }).length : 68
                },
                roleDistribution,
                statusDistribution,
                recentUsers: buildRecentUsers(users),
                activities: buildActivities(auditLogs),
                services: buildServices(health),
                growth: mockGrowth,
                lastUpdatedAt: new Date()
            });
        } catch (error) {
            set({
                loading: false,
                error: error?.response?.data?.message || 'Không thể tải dữ liệu dashboard',
                overview: {
                    total: 1258,
                    active: 1201,
                    locked: 12,
                    hr: 5,
                    principal: 2,
                    newThisMonth: 68
                },
                roleDistribution: mockRoleDistribution,
                statusDistribution: mockStatusDistribution,
                recentUsers: mockRecentUsers,
                activities: mockActivities,
                services: mockServices,
                growth: mockGrowth
            });
        }
    },

    createPrivilegedUser: async (payload) => {
        try {
            await adminDashboardService.createUser(payload);
            toast.success('Tạo tài khoản thành công');
            await get().fetchDashboard();
            return true;
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Tạo tài khoản thất bại');
            return false;
        }
    }
}));
