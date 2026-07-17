import {
    FiActivity,
    FiAward,
    FiBarChart2,
    FiBell,
    FiBookOpen,
    FiBriefcase,
    FiCheckSquare,
    FiClipboard,
    FiCode,
    FiFileText,
    FiGrid,
    FiImage,
    FiLayers,
    FiLock,
    FiSettings,
    FiUserCheck,
    FiUsers
} from 'react-icons/fi';

import { userRoles } from './roles.js';

export const moduleMeta = {
    dashboard: {
        label: 'Bảng điều khiển',
        description: 'Tổng quan công việc, cảnh báo và tác vụ ưu tiên theo vai trò.',
        icon: FiGrid,
        path: '/dashboard'
    },
    studentDashboard: {
        label: 'Tổng quan',
        description: 'Hoạt động học tập, lịch học, hạn nộp và thông báo mới nhất.',
        icon: FiGrid,
        path: '/student'
    },
    studentEnrollments: {
        label: 'Đăng ký lớp',
        description: 'Tìm lớp đang mở, kiểm tra lịch học và đăng ký trong thời hạn.',
        icon: FiUserCheck,
        path: '/student/enrollments'
    },
    studentClasses: {
        label: 'Lớp học của tôi',
        description: 'Danh sách lớp đã đăng ký, nội dung học và tiến độ cá nhân.',
        icon: FiBookOpen,
        path: '/student/classes'
    },
    studentGrades: {
        label: 'Bảng điểm',
        description: 'Kết quả bài tập, kiểm tra, thi và điểm tổng kết từng môn.',
        icon: FiAward,
        path: '/student/grades'
    },
    lecturerDashboard: {
        label: 'Tổng quan',
        description: 'Lịch dạy, bài chờ chấm, kỳ thi và sinh viên cần chú ý.',
        icon: FiGrid,
        path: '/lecturer'
    },
    lecturerClasses: {
        label: 'Lớp học của tôi',
        description: 'Danh sách lớp được phân công và không gian quản trị từng lớp.',
        icon: FiBookOpen,
        path: '/lecturer/classes'
    },
    lecturerGrading: {
        label: 'Chấm bài',
        description: 'Chấm tự luận, xem bài Code và kết quả chấm tự động.',
        icon: FiClipboard,
        path: '/lecturer/grading'
    },
    lecturerAutoGrading: {
        label: 'Bài chấm tự động',
        description: 'Xem kết quả chấm Code, trắc nghiệm và điều chỉnh điểm khi cần.',
        icon: FiCheckSquare,
        path: '/lecturer/auto-grading'
    },
    lecturerGrades: {
        label: 'Bảng điểm',
        description: 'Điểm thành phần, điểm tổng kết và trạng thái từng sinh viên.',
        icon: FiAward,
        path: '/lecturer/grades'
    },
    users: {
        label: 'Quản lý tài khoản',
        description: 'Tạo, cập nhật, khóa/mở khóa và theo dõi hồ sơ người dùng.',
        icon: FiUsers,
        path: '/users'
    },
    departments: {
        label: 'Phòng ban',
        description: 'Quản lý danh mục phòng ban, bộ môn và trạng thái hoạt động.',
        icon: FiLayers,
        path: '/departments'
    },
    subjects: {
        label: 'Môn học',
        description: 'Đề xuất, phê duyệt và quản lý danh mục môn học.',
        icon: FiBookOpen,
        path: '/subjects'
    },
    classes: {
        label: 'Lớp học',
        description: 'Mở lớp, lịch học, sức chứa, phân công quản lý và giảng viên.',
        icon: FiBriefcase,
        path: '/classes'
    },
    enrollments: {
        label: 'Đăng ký lớp',
        description: 'Sinh viên đăng ký/hủy đăng ký, kiểm tra trùng lịch và chỗ trống.',
        icon: FiUserCheck,
        path: '/enrollments'
    },
    lessons: {
        label: 'Chương & bài học',
        description: 'Quản lý chương, nội dung Text, Video, PDF và tiến độ học tập.',
        icon: FiLayers,
        path: '/lessons'
    },
    media: {
        label: 'Media',
        description: 'Tải lên, lấy liên kết và quản lý media ảnh/PDF dùng trong nội dung học tập.',
        icon: FiImage,
        path: '/media'
    },
    assignments: {
        label: 'Bài tập',
        description: 'Code, trắc nghiệm, tự luận, submission và chấm điểm.',
        icon: FiCode,
        path: '/assignments'
    },
    assessments: {
        label: 'Kiểm tra & thi',
        description: 'Cấu hình bài kiểm tra, bài thi, lượt làm và giám sát chuyển tab.',
        icon: FiClipboard,
        path: '/assessments'
    },
    grades: {
        label: 'Bảng điểm',
        description: 'Cấu hình tỷ lệ, tính tổng kết, duyệt điểm và khóa điểm.',
        icon: FiAward,
        path: '/grades'
    },
    reports: {
        label: 'Báo cáo',
        description: 'Thống kê lớp, tiến độ, pass/fail, điểm trung bình và xuất báo cáo.',
        icon: FiBarChart2,
        path: '/reports'
    },
    announcements: {
        label: 'Thông báo chung',
        description: 'Announcement toàn trường, theo vai trò hoặc phòng ban.',
        icon: FiBell,
        path: '/announcements'
    },
    notifications: {
        label: 'Thông báo cá nhân',
        description: 'Notification nghiệp vụ và trạng thái đã đọc của người dùng.',
        icon: FiBell,
        path: '/notifications'
    },
    announcementManagement: {
        label: 'Quản lý announcement',
        description: 'Tạo, lên lịch, publish và quản lý announcement.',
        icon: FiBell,
        path: '/announcements/manage'
    },
    auditLog: {
        label: 'Audit log',
        description: 'Tra cứu thao tác quan trọng, dữ liệu trước/sau và nguồn truy cập.',
        icon: FiActivity,
        path: '/audit-log'
    },
    settings: {
        label: 'Cấu hình hệ thống',
        description: 'Thiết lập token, upload, email, Redis, thang điểm và bảo trì.',
        icon: FiSettings,
        path: '/settings'
    },
    profile: {
        label: 'Hồ sơ cá nhân',
        description: 'Thông tin cá nhân, đổi mật khẩu, lịch sử đăng nhập và đăng xuất thiết bị.',
        icon: FiFileText,
        path: '/profile'
    },
    security: {
        label: 'Bảo mật',
        description: 'Trạng thái phiên, khóa tài khoản và cảnh báo truy cập.',
        icon: FiLock,
        path: '/settings'
    },
    approvals: {
        label: 'Phê duyệt',
        description: 'Xử lý đề xuất môn/lớp, trả lại bổ sung và ghi chú quyết định.',
        icon: FiCheckSquare,
        path: '/approvals'
    },
    subjectProposals: {
        label: 'Đề xuất môn',
        description: 'Quản lý đề xuất môn học mới, bản nháp, gửi duyệt, chỉnh sửa và đề xuất lại.',
        icon: FiBookOpen,
        path: '/subject-proposals'
    },
    classProposals: {
        label: 'Đề xuất lớp',
        description: 'Quản lý đề xuất mở lớp, số lượng lớp dự kiến và tự sinh lớp sau khi duyệt.',
        icon: FiBriefcase,
        path: '/class-proposals'
    }
};

export const roleNavigation = {
    [userRoles.ADMIN]: [
        'dashboard',
        'users',
        'departments',
        'subjects',
        'classes',
        'media',
        'assignments',
        'assessments',
        'approvals',
        'announcements',
        'reports',
        'auditLog',
        'settings'
    ],
    [userRoles.HR]: ['dashboard', 'users', 'departments', 'profile'],
    [userRoles.PRINCIPAL]: [
        'dashboard',
        'users',
        'departments',
        'subjects',
        'classes',
        'media',
        'assignments',
        'assessments',
        'approvals',
        'announcements',
        'reports',
        'settings'
    ],
    [userRoles.TRAINING_OFFICER]: ['dashboard', 'departments', 'subjects', 'classes', 'approvals', 'grades', 'reports'],
    [userRoles.DEPARTMENT_HEAD]: ['dashboard', 'subjects', 'classes', 'approvals', 'media', 'grades', 'reports'],
    [userRoles.LECTURER]: ['lecturerDashboard', 'lecturerClasses', 'lecturerGrading', 'lecturerAutoGrading', 'lecturerGrades'],
    [userRoles.STUDENT]: ['studentDashboard', 'studentEnrollments', 'studentClasses', 'studentGrades']
};
