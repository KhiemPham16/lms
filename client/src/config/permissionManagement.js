import {
    FaBookOpen,
    FaBoxOpen,
    FaBriefcase,
    FaChartBar,
    FaShieldAlt,
    FaUniversity,
    FaUser,
    FaUserCog,
    FaUsers
} from 'react-icons/fa';

export const permissionRoles = [
    { id: 'HR', label: 'HR', icon: FaUserCog },
    { id: 'PRINCIPAL', label: 'Hiệu trưởng', icon: FaUsers },
    { id: 'TRAINING_OFFICER', label: 'Phòng đào tạo', icon: FaUniversity },
    { id: 'DEPARTMENT_HEAD', label: 'Trưởng bộ môn', icon: FaUsers },
    { id: 'LECTURER', label: 'Giảng viên', icon: FaBoxOpen },
    { id: 'STUDENT', label: 'Sinh viên', icon: FaUser }
];

export const permissionGroups = [
    {
        id: 'users',
        title: 'Người dùng',
        icon: FaUsers,
        defaultOpen: true,
        permissions: [
            { id: 'users.view', label: 'Xem danh sách' },
            { id: 'users.create', label: 'Tạo mới' },
            { id: 'users.update', label: 'Chỉnh sửa' },
            { id: 'users.lock', label: 'Khóa/Mở khóa' }
        ]
    },
    {
        id: 'system',
        title: 'Hệ thống & Nhật ký',
        icon: FaShieldAlt,
        defaultOpen: false,
        permissions: [
            { id: 'permissions.manage', label: 'Quản lý phân quyền' },
            { id: 'audit.view', label: 'Xem Audit Log' }
        ]
    },
    {
        id: 'programs',
        title: 'Môn học',
        icon: FaBookOpen,
        defaultOpen: false,
        permissions: [
            { id: 'subjects.view', label: 'Xem môn học' },
            { id: 'subjects.update', label: 'Cập nhật môn học' }
        ]
    },
    {
        id: 'proposals',
        title: 'Đề xuất môn học',
        icon: FaBookOpen,
        defaultOpen: false,
        permissions: [
            { id: 'proposals.create', label: 'Tạo đề xuất' },
            { id: 'proposals.approve', label: 'Duyệt đề xuất' },
            { id: 'proposals.history', label: 'Xem lịch sử xử lý' }
        ]
    },
    {
        id: 'classes',
        title: 'Lớp học',
        icon: FaBriefcase,
        defaultOpen: true,
        permissions: [
            { id: 'classes.view', label: 'Xem lớp học' },
            { id: 'classes.create', label: 'Tạo lớp' },
            { id: 'classes.assignLecturer', label: 'Gán giảng viên' },
            { id: 'classes.registration', label: 'Mở/Đóng đăng ký' }
        ]
    },
    {
        id: 'lessons',
        title: 'Bài học',
        icon: FaBriefcase,
        defaultOpen: false,
        permissions: [
            { id: 'lessons.view', label: 'Xem bài học' },
            { id: 'lessons.create', label: 'Tạo bài học' }
        ]
    },
    {
        id: 'exams',
        title: 'Bài tập & Bài thi',
        icon: FaBriefcase,
        defaultOpen: false,
        permissions: [
            { id: 'exams.view', label: 'Xem bài thi' },
            { id: 'exams.create', label: 'Tạo bài thi' },
            { id: 'exams.take', label: 'Làm bài thi' },
            { id: 'exams.grade', label: 'Chấm điểm' }
        ]
    },
    {
        id: 'scores',
        title: 'Điểm số',
        icon: FaChartBar,
        defaultOpen: false,
        permissions: [
            { id: 'scores.view', label: 'Xem điểm' },
            { id: 'scores.calculate', label: 'Tính điểm' },
            { id: 'scores.export', label: 'Xuất bảng điểm' }
        ]
    }
];

export const auditPermissionChanges = [
    {
        permission: 'Quản lý người dùng > Tạo mới',
        oldValue: false,
        newValue: true
    },
    {
        permission: 'Lớp học > Mở/Đóng đăng ký',
        oldValue: false,
        newValue: true
    },
    {
        permission: 'Điểm số > Tính điểm',
        oldValue: true,
        newValue: false
    }
];

export const getDefaultOpenPermissionGroups = () =>
    permissionGroups.reduce((acc, group) => ({ ...acc, [group.id]: group.defaultOpen }), {});
