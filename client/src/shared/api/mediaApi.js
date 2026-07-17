import { apiClient } from './http.js';

const unwrap = (response) => {
    const body = response.data;
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
        return body.data;
    }
    return body;
};

const normalizeMedia = (media) => {
    const url = media?.url ?? `/api/v1/media/${media?.publicId ?? media?.id}`;
    const baseUrl = apiClient.defaults.baseURL?.replace(/\/api\/v\d+\/?$/, '') ?? '';

    return {
        id: media?.id ?? media?.publicId,
        publicId: media?.publicId ?? media?.id,
        fileName: media?.fileName ?? '',
        originalName: media?.originalName ?? '',
        title: media?.title ?? '',
        altText: media?.altText ?? '',
        caption: media?.caption ?? '',
        description: media?.description ?? '',
        folder: media?.folder ?? 'legacy',
        type: media?.type ?? '',
        mimeType: media?.mimeType ?? '',
        size: media?.size ?? 0,
        width: media?.width,
        height: media?.height,
        usageCount: media?.usageCount ?? 0,
        uploadedBy: media?.uploadedBy,
        createdAt: media?.createdAt,
        updatedAt: media?.updatedAt,
        url,
        absoluteUrl: url?.startsWith('http') ? url : `${baseUrl}${url}`
    };
};

const normalizeList = (payload) => ({
    items: (payload?.data ?? payload?.items ?? []).map(normalizeMedia),
    meta: payload?.meta ?? { page: 1, limit: 24, total: 0, totalPages: 1 }
});

const toFormData = (file, metadata = {}) => {
    const formData = new FormData();
    formData.append('file', file);

    Object.entries(metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            formData.append(key, value);
        }
    });

    return formData;
};

export const mediaApi = {
    async list(params) {
        return normalizeList(unwrap(await apiClient.get('/media', { params })));
    },

    async folders() {
        return unwrap(await apiClient.get('/media/folders'));
    },

    async upload(file, metadata) {
        const payload = unwrap(
            await apiClient.post('/media', toFormData(file, metadata), {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
        );
        return normalizeMedia(payload);
    },

    async update(publicId, payload) {
        return normalizeMedia(unwrap(await apiClient.patch(`/media/${publicId}`, payload)));
    },

    async replace(publicId, file) {
        const payload = unwrap(
            await apiClient.post(`/media/${publicId}/replace`, toFormData(file), {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
        );
        return normalizeMedia(payload);
    },

    async remove(publicId) {
        return unwrap(await apiClient.delete(`/media/${publicId}`));
    },

    async usage(publicId) {
        return unwrap(await apiClient.get(`/media/${publicId}/usage`));
    },

    async bulkDelete(publicIds) {
        return unwrap(await apiClient.post('/media/bulk-delete', { publicIds }));
    },

    async bulkMove(publicIds, folder) {
        return unwrap(await apiClient.patch('/media/bulk-folder', { publicIds, folder }));
    }
};
