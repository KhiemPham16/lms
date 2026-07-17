import { apiClient } from './http.js';

const unwrapList = (body) => {
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.data)) return body.data;
    if (Array.isArray(body?.data?.items)) return body.data.items;
    if (Array.isArray(body?.items)) return body.items;
    if (Array.isArray(body?.users)) return body.users;
    return [];
};

const unwrapMeta = (body, fallbackLimit) => {
    const meta = body?.meta ?? body?.data?.meta ?? {};
    return {
        page: Number(meta.page ?? 1),
        limit: Number(meta.limit ?? fallbackLimit ?? 100),
        total: Number(meta.total ?? unwrapList(body).length),
        totalPages: Number(meta.totalPages ?? 1)
    };
};

const normalizeStatus = (status) => {
    const upperStatus = String(status ?? 'ACTIVE').toUpperCase();
    if (upperStatus === 'PENDING') return 'PENDING';
    if (upperStatus === 'INACTIVE') return 'INACTIVE';
    if (['LOCKED', 'BLOCKED', 'DISABLED'].includes(upperStatus)) return 'LOCKED';
    return 'ACTIVE';
};

export const normalizeUserAccount = (account) => ({
    id: account?.publicId ?? account?.id ?? account?._id ?? account?.email,
    publicId: account?.publicId ?? account?.id ?? account?._id,
    code: account?.code ?? account?.userCode ?? account?.studentCode ?? account?.employeeCode ?? '',
    fullName: account?.fullName ?? account?.name ?? account?.profile?.fullName ?? '',
    email: account?.email ?? '',
    role: account?.role ?? account?.roleCode ?? account?.role?.code ?? 'STUDENT',
    status: normalizeStatus(account?.status ?? account?.accountStatus),
    studentStatus: account?.studentStatus ?? null,
    employmentStatus: account?.employmentStatus ?? null,
    employmentEndedAt: account?.employmentEndedAt ?? null,
    phone: account?.phone ?? '',
    department: account?.department ?? null,
    lastLoginAt: account?.lastLoginAt ?? account?.lastLogin ?? null
});

const getAccountId = (accountOrId) => {
    if (typeof accountOrId === 'string') return accountOrId;
    return accountOrId?.publicId ?? accountOrId?.id;
};

const normalizeCreatePayload = (payload) => {
    const normalized = {
        fullName: payload.fullName?.trim(),
        email: payload.email?.trim(),
        role: payload.role
    };

    if (payload.phone?.trim()) {
        normalized.phone = payload.phone.trim();
    }

    if (payload.departmentPublicId) {
        normalized.departmentPublicId = payload.departmentPublicId;
    }

    return normalized;
};

const normalizeUpdatePayload = (payload) => {
    const normalized = {
        fullName: payload.fullName?.trim(),
        email: payload.email?.trim()
    };

    if (payload.phone?.trim()) {
        normalized.phone = payload.phone.trim();
    }

    if (payload.departmentPublicId) {
        normalized.departmentPublicId = payload.departmentPublicId;
    }

    return normalized;
};

export const userAccountsApi = {
    async list(params = {}) {
        const response = await apiClient.get('/users', { params });
        return {
            items: unwrapList(response.data).map(normalizeUserAccount),
            meta: unwrapMeta(response.data, params.limit)
        };
    },

    async create(payload) {
        const response = await apiClient.post('/users', normalizeCreatePayload(payload));
        return normalizeUserAccount(response.data?.data ?? response.data);
    },

    async update(accountId, payload) {
        const response = await apiClient.patch(`/users/${accountId}`, normalizeUpdatePayload(payload));
        return normalizeUserAccount(response.data?.data ?? response.data);
    },

    async remove(accountId) {
        const response = await apiClient.delete(`/users/${accountId}`);
        return response.data?.data ?? response.data;
    },

    async changeStatus(account, status) {
        const accountId = getAccountId(account);
        const response = await apiClient.patch(`/users/${accountId}/status`, { status });
        return normalizeUserAccount(response.data?.data ?? { ...account, status });
    },

    async changeStudentStatus(account, status) {
        const accountId = getAccountId(account);
        const response = await apiClient.patch(`/users/${accountId}/student-status`, { status });
        return normalizeUserAccount(response.data?.data ?? { ...account, studentStatus: status });
    },

    async changeEmploymentStatus(account, status) {
        const accountId = getAccountId(account);
        const response = await apiClient.patch(`/users/${accountId}/employment-status`, { status });
        return normalizeUserAccount(response.data?.data ?? { ...account, employmentStatus: status });
    },

    async toggleLock(account) {
        const nextStatus = account.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
        return this.changeStatus(account, nextStatus);
    },

    async resetPassword(account) {
        const accountId = getAccountId(account);
        const response = await apiClient.patch(`/users/${accountId}/reset-password`);
        return response.data?.data ?? response.data;
    }
};
