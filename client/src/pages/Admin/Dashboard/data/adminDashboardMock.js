import {
    FiActivity,
    FiAlertTriangle,
    FiBarChart2,
    FiBriefcase,
    FiCheckCircle,
    FiClock,
    FiDatabase,
    FiKey,
    FiLock,
    FiMail,
    FiShield,
    FiTrendingUp,
    FiUserCheck,
    FiUserPlus,
    FiUsers
} from 'react-icons/fi';

export const roleLabels = {
    ADMIN: 'Admin',
    HR: 'HR',
    PRINCIPAL: 'Hiệu trưởng',
    TRAINING_OFFICER: 'Phòng đào tạo',
    DEPARTMENT_HEAD: 'Trưởng bộ môn',
    LECTURER: 'Giảng viên',
    STUDENT: 'Sinh viên'
};

export const statusLabels = {
    ACTIVE: 'Hoạt động',
    INACTIVE: 'Ngừng hoạt động',
    LOCKED: 'Bị khóa',
    PENDING: 'Chờ kích hoạt'
};

export const mockRoleDistribution = [
    { key: 'ADMIN', label: 'Admin', value: 2 },
    { key: 'HR', label: 'HR', value: 5 },
    { key: 'PRINCIPAL', label: 'Hiệu trưởng', value: 2 },
    { key: 'TRAINING_OFFICER', label: 'Phòng đào tạo', value: 8 },
    { key: 'DEPARTMENT_HEAD', label: 'Trưởng bộ môn', value: 15 },
    { key: 'LECTURER', label: 'Giảng viên', value: 120 },
    { key: 'STUDENT', label: 'Sinh viên', value: 1106 }
];

export const mockGrowth = [
    { label: 'T1', value: 28 },
    { label: 'T2', value: 36 },
    { label: 'T3', value: 42 },
    { label: 'T4', value: 51 },
    { label: 'T5', value: 57 },
    { label: 'T6', value: 68 },
    { label: 'T7', value: 74 },
    { label: 'T8', value: 88 },
    { label: 'T9', value: 94 },
    { label: 'T10', value: 102 },
    { label: 'T11', value: 115 },
    { label: 'T12', value: 128 }
];

export const mockStatusDistribution = [
    { key: 'ACTIVE', label: 'Đang hoạt động', value: 1201, color: '#22c55e' },
    { key: 'PENDING', label: 'Chưa kích hoạt', value: 30, color: '#f59e0b' },
    { key: 'LOCKED', label: 'Bị khóa', value: 12, color: '#ef4444' },
    { key: 'INACTIVE', label: 'Ngừng hoạt động', value: 15, color: '#94a3b8' }
];

export const mockRecentUsers = [
    { name: 'Nguyễn Văn An', email: 'an.hr@lms.edu.vn', role: 'HR', creator: 'Admin', createdAt: '2026-06-24', status: 'ACTIVE' },
    { name: 'Trần Thị Bình', email: 'binh.principal@lms.edu.vn', role: 'PRINCIPAL', creator: 'Admin', createdAt: '2026-06-23', status: 'ACTIVE' },
    { name: 'Lê Minh Cường', email: 'cuong.gv@lms.edu.vn', role: 'LECTURER', creator: 'HR01', createdAt: '2026-06-22', status: 'PENDING' },
    { name: 'Phạm Hoài Nam', email: 'nam.sv@lms.edu.vn', role: 'STUDENT', creator: 'HR02', createdAt: '2026-06-21', status: 'ACTIVE' },
    { name: 'Nguyễn Thanh Huyền', email: 'huyen.pdt@lms.edu.vn', role: 'TRAINING_OFFICER', creator: 'HR01', createdAt: '2026-06-20', status: 'LOCKED' }
];

export const mockAlerts = [
    { level: 'critical', icon: FiLock, title: 'Tài khoản bị khóa', message: '3 tài khoản bị khóa do đăng nhập sai nhiều lần.', time: '10 phút trước' },
    { level: 'warning', icon: FiAlertTriangle, title: 'Chưa kích hoạt', message: '12 tài khoản đang chờ kích hoạt.', time: '35 phút trước' },
    { level: 'warning', icon: FiKey, title: 'Thiếu vai trò', message: '5 tài khoản chưa được gán vai trò.', time: '1 giờ trước' },
    { level: 'info', icon: FiShield, title: 'Truy cập bị từ chối', message: '8 lần gọi API không đủ quyền.', time: '2 giờ trước' },
    { level: 'warning', icon: FiMail, title: 'Email phản hồi chậm', message: 'Dịch vụ gửi email đang phản hồi chậm.', time: 'Hôm nay' }
];

export const mockActivities = [
    { actor: 'Admin', action: 'đã tạo tài khoản HR', target: 'Nguyễn Văn An', time: '5 phút trước', success: true },
    { actor: 'HR Trần Thị Bình', action: 'đã tạo 35 tài khoản', target: 'Sinh viên khóa 2026', time: '28 phút trước', success: true },
    { actor: 'Hiệu trưởng', action: 'đã duyệt đề xuất môn', target: 'Cloud Computing', time: '1 giờ trước', success: true },
    { actor: 'Phòng đào tạo', action: 'đã tạo lớp', target: 'JAVA-2026-01', time: '2 giờ trước', success: true },
    { actor: 'Hệ thống', action: 'đã khóa tài khoản', target: 'GV001', time: '3 giờ trước', success: false }
];

export const mockServices = [
    { name: 'Backend API', status: 'Operational', response: '84 ms', icon: FiActivity },
    { name: 'Database', status: 'Operational', response: '42 ms', icon: FiDatabase },
    { name: 'Dịch vụ xác thực', status: 'Operational', response: '66 ms', icon: FiShield },
    { name: 'Dịch vụ gửi email', status: 'Degraded', response: '920 ms', icon: FiMail },
    { name: 'Lưu trữ file', status: 'Operational', response: '110 ms', icon: FiBriefcase },
    { name: 'Sao lưu dữ liệu', status: 'Operational', response: '23/06/2026 23:00', icon: FiClock }
];

export const quickActions = [
    { key: 'create-hr', title: 'Tạo tài khoản HR', description: 'Thêm nhân sự quản lý tài khoản.', icon: FiUserPlus, role: 'HR' },
    { key: 'create-principal', title: 'Tạo tài khoản Hiệu trưởng', description: 'Cấp tài khoản duyệt cấp trường.', icon: FiUserCheck, role: 'PRINCIPAL' },
    { key: 'users', title: 'Quản lý người dùng', description: 'Xem, lọc và cập nhật tài khoản.', icon: FiUsers, path: '/admin/users' },
    { key: 'permissions', title: 'Quản lý phân quyền', description: 'Vai trò, quyền và ma trận truy cập.', icon: FiShield, path: '/admin/permissions' },
    { key: 'audit', title: 'Nhật ký hệ thống', description: 'Theo dõi hoạt động gần đây.', icon: FiBarChart2, path: '/admin/audit-logs' }
];

export const kpiIcons = {
    total: FiUsers,
    active: FiCheckCircle,
    locked: FiLock,
    hr: FiBriefcase,
    principal: FiShield,
    newThisMonth: FiTrendingUp
};
