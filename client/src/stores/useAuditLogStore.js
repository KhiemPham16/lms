import { create } from 'zustand';
import { toast } from 'sonner';

import { auditLogService } from '~/services/auditLogService';
import { getApiErrorMessage, getPayloadItems, getPayloadMeta } from '~/lib/apiPayload';

const defaultFilters = {
    action: '',
    module: '',
    targetType: '',
    targetPublicId: '',
    actorId: ''
};

const getErrorMessage = getApiErrorMessage;

const buildParams = (state) => ({
    page: state.pagination.page,
    limit: state.pagination.limit,
    action: state.filters.action || undefined,
    module: state.filters.module || undefined,
    targetType: state.filters.targetType || undefined,
    targetPublicId: state.filters.targetPublicId || undefined,
    actorId: state.filters.actorId || undefined
});

export const useAuditLogStore = create((set, get) => ({
    logs: [],
    filters: defaultFilters,
    pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1
    },
    loading: false,
    error: null,
    selectedLog: null,

    fetchLogs: async (params = {}) => {
        set({ loading: true, error: null });
        try {
            const state = get();
            const payload = await auditLogService.getAuditLogs({ ...buildParams(state), ...params });
            const meta = getPayloadMeta(payload);

            set({
                logs: getPayloadItems(payload),
                pagination: {
                    page: Number(meta.page || params.page || state.pagination.page || 1),
                    limit: Number(meta.limit || params.limit || state.pagination.limit || 20),
                    total: Number(meta.total || 0),
                    totalPages: Number(meta.totalPages || 1)
                }
            });
        } catch (error) {
            set({
                logs: [],
                error: getErrorMessage(error, 'Không thể tải Audit Log hệ thống')
            });
        } finally {
            set({ loading: false });
        }
    },

    setFilters: (filters) => {
        set((state) => ({
            filters: { ...state.filters, ...filters },
            pagination: { ...state.pagination, page: 1 }
        }));
    },

    resetFilters: () => {
        set((state) => ({
            filters: defaultFilters,
            pagination: { ...state.pagination, page: 1 }
        }));
    },

    setPage: (page) => {
        set((state) => ({
            pagination: { ...state.pagination, page }
        }));
    },

    setLimit: (limit) => {
        set((state) => ({
            pagination: { ...state.pagination, page: 1, limit }
        }));
    },

    selectLog: (log) => set({ selectedLog: log }),
    closeDetail: () => set({ selectedLog: null }),

    refreshData: async () => {
        await get().fetchLogs();
        toast.success('Đã làm mới Audit Log');
    }
}));
