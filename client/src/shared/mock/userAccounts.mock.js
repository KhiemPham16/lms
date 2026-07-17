import { userRoles } from '~/shared/constants/roles.js';

// Mock riêng cho UI quản lý tài khoản, dùng khi cần test giao diện mà chưa phụ thuộc API thật.
export const mockUserAccounts = [
    {
        id: 'usr-admin-001',
        publicId: 'usr-admin-001',
        code: 'AD0001',
        fullName: 'Quản trị hệ thống',
        email: 'admin@lms.local',
        role: userRoles.ADMIN,
        status: 'ACTIVE',
        lastLoginAt: '2026-07-14T08:20:00.000Z'
    },
    {
        id: 'usr-hr-001',
        publicId: 'usr-hr-001',
        code: 'HR0001',
        fullName: 'Nguyễn Nhân Sự',
        email: 'hr@lms.local',
        role: userRoles.HR,
        status: 'ACTIVE',
        lastLoginAt: '2026-07-13T03:12:00.000Z'
    },
    {
        id: 'usr-lecturer-001',
        publicId: 'usr-lecturer-001',
        code: 'GV0001',
        fullName: 'Trần Minh Giảng',
        email: 'lecturer@lms.local',
        role: userRoles.LECTURER,
        status: 'LOCKED',
        lastLoginAt: null
    },
    {
        id: 'usr-student-001',
        publicId: 'usr-student-001',
        code: 'SV0001',
        fullName: 'Lê An Sinh',
        email: 'student@lms.local',
        role: userRoles.STUDENT,
        status: 'ACTIVE',
        lastLoginAt: '2026-07-12T15:45:00.000Z'
    }
];
