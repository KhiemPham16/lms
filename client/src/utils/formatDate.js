export const formatDate = (value, locale = 'vi-VN') => {
    if (!value) return '--';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';

    return new Intl.DateTimeFormat(locale).format(date);
};
