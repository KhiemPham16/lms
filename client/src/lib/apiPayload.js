export const unwrapApiPayload = (payload) => payload?.data ?? payload;

export const unwrapApiResponse = (response) => unwrapApiPayload(response?.data);

export const getPayloadItems = (payload) => unwrapApiPayload(payload)?.items || [];

export const getPayloadMeta = (payload) => unwrapApiPayload(payload)?.meta || {};

export const getApiErrorMessage = (error, fallback = 'Thao tác thất bại') =>
    error?.response?.data?.message || error?.message || fallback;

export const getApiErrorCode = (error) => error?.response?.data?.code;

export const isAccountStatusError = (error) => {
    const status = error?.response?.status;
    const response = error?.response?.data || {};
    const code = response.code;
    const message = String(response.message || '').toLowerCase();

    return (
        status === 403 &&
        (
            code === 'ACCOUNT_NOT_ACTIVE' ||
            code === 'ACCOUNT_INACTIVE' ||
            message.includes('account_not_active') ||
            message.includes('account_inactive') ||
            message.includes('inactive') ||
            message.includes('locked')
        )
    );
};

export const getAccountStatusMessage = (status) => {
    const normalizedStatus = String(status || '').toUpperCase();

    if (normalizedStatus === 'LOCKED') {
        return 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.';
    }

    if (normalizedStatus === 'PENDING') {
        return 'Tài khoản của bạn chưa được kích hoạt.';
    }

    if (normalizedStatus === 'INACTIVE') {
        return 'Tài khoản của bạn đã bị vô hiệu hóa.';
    }

    return 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.';
};
