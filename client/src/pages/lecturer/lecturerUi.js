export const asList = (value) => (Array.isArray(value) ? value : value?.items ?? value?.data ?? []);

export const classStatusLabels = {
    DRAFT: 'Bản nháp',
    OPEN_REGISTRATION: 'Đang mở đăng ký',
    CLOSED_REGISTRATION: 'Đã đóng đăng ký',
    IN_PROGRESS: 'Đang giảng dạy',
    COMPLETED: 'Đã hoàn thành',
    CANCELLED: 'Đã hủy'
};

export const categoryLabels = {
    ASSIGNMENT: 'Bài tập',
    QUIZ: 'Bài kiểm tra',
    MIDTERM: 'Giữa kỳ',
    FINAL: 'Cuối kỳ'
};

export const weekdayLabels = {
    MONDAY: 'Thứ 2', TUESDAY: 'Thứ 3', WEDNESDAY: 'Thứ 4', THURSDAY: 'Thứ 5',
    FRIDAY: 'Thứ 6', SATURDAY: 'Thứ 7', SUNDAY: 'Chủ nhật'
};

export const todayKeys = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

export const formatSchedule = (schedules = []) => schedules.length
    ? schedules.map((item) => `${weekdayLabels[item.weekDay] ?? item.weekDay}, ${item.startTime}-${item.endTime}${item.room ? ` · ${item.room}` : ''}`).join('; ')
    : 'Chưa xếp lịch';

export const isManualAnswer = (answer) => ['ESSAY', 'HTML_CSS'].includes(answer.question?.type);
export const isPendingManualAnswer = (answer) => isManualAnswer(answer) && answer.awardedPoints == null;

export const lecturerClasses = (classes, userPublicId) => asList(classes).filter((item) => item.lecturer?.publicId === userPublicId);
