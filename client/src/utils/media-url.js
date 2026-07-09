import env from '~/config/env';

const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

const getMediaBaseUrl = () => {
    const apiBaseUrl = trimTrailingSlash(env.API_BASE_URL || window.location.origin);

    try {
        return new URL(apiBaseUrl, window.location.origin).origin;
    } catch {
        return apiBaseUrl;
    }
};

export function resolveMediaUrl(url) {
    if (!url) return '';
    if (/^(https?:)?\/\//i.test(url) || /^blob:/i.test(url) || /^data:/i.test(url)) return url;

    const mediaBaseUrl = getMediaBaseUrl();
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;

    return `${mediaBaseUrl}${normalizedUrl}`;
}

export function getMediaUrlCandidates(item) {
    if (!item) return [];

    return [
        resolveMediaUrl(item.url),
        resolveMediaUrl(`/uploads/media/${item.folder}/${item.fileName}`),
        resolveMediaUrl(`/uploads/lms/media/${item.folder}/${item.fileName}`),
        resolveMediaUrl(`/uploads/lms/media/learning-materials/${item.fileName}`)
    ].filter(Boolean);
}
