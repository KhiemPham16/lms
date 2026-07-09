export function normalizeList(data) {
    if (Array.isArray(data)) {
        return { items: data, meta: { page: 1, totalPages: 1, total: data.length } };
    }

    if (Array.isArray(data?.items)) {
        return {
            items: data.items,
            meta: {
                page: data.meta?.page ?? 1,
                totalPages: data.meta?.totalPages ?? 1,
                total: data.meta?.total ?? data.items.length
            }
        };
    }

    return { items: [], meta: { page: 1, totalPages: 1, total: 0 } };
}

export function displayDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('vi-VN');
}

export function getItemName(item) {
    return item?.name || item?.title || item?.fullName || item?.code || item?.publicId || 'bản ghi';
}
