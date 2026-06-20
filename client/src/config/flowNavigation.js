import {
    FaBell,
    FaBookOpen,
    FaChalkboardTeacher,
    FaClipboardCheck,
    FaClipboardList,
    FaFileAlt,
    FaGraduationCap,
    FaLayerGroup,
    FaListAlt,
    FaRegChartBar,
    FaShieldAlt,
    FaTasks,
    FaUserCheck,
    FaUserCog,
    FaUserFriends,
    FaUsers
} from 'react-icons/fa';

export const sharedRoutes = [
    {
        path: '/profile',
        title: 'Thông tin cá nhân',
        description: 'Xem hồ sơ, thông tin liên hệ và đổi mật khẩu.',
        icon: FaUserCheck,
        actions: ['Xem thông tin cá nhân', 'Đổi mật khẩu', 'Kiểm tra phiên đăng nhập']
    },
    {
        path: '/notifications',
        title: 'Thông báo',
        description: 'Theo dõi thông báo hệ thống, kết quả duyệt, lớp học và bài kiểm tra.',
        icon: FaBell,
        actions: ['Nhận thông báo', 'Đọc thông báo', 'Lọc theo loại thông báo']
    }
];

export const flowWorkspaces = {
    admin: {
        role: 'ADMIN',
        basePath: '/admin',
        title: 'Admin',
        subtitle: 'Quản trị hệ thống, tài khoản, vai trò và nhật ký hoạt động.',
        dashboardPath: '/admin',
        modules: [
            {
                key: 'users',
                path: '/admin/users',
                roles: ['ADMIN'],
                permission: 'users.view',
                title: 'Quản lý người dùng',
                description: 'Tạo HR, Hiệu trưởng, cập nhật và khóa/mở tài khoản.',
                icon: FaUserFriends,
                status: 'Có API user',
                actions: ['Tạo tài khoản HR', 'Tạo tài khoản Hiệu trưởng', 'Cập nhật tài khoản', 'Khóa/Mở tài khoản']
            },
            {
                key: 'permissions',
                path: '/admin/permissions',
                roles: ['ADMIN'],
                permission: 'permissions.manage',
                title: 'Quản lý vai trò và quyền',
                description: 'Quản lý quyền, gán quyền cho vai trò và lưu lịch sử thay đổi.',
                icon: FaShieldAlt,
                status: 'FE đã dựng',
                actions: ['Quản lý vai trò', 'Quản lý quyền', 'Gán quyền cho vai trò']
            },
            {
                key: 'audit',
                path: '/admin/audit-logs',
                roles: ['ADMIN'],
                permission: 'audit.view',
                title: 'Audit Log hệ thống',
                description: 'Lọc nhật ký theo actor, action, entity, ngày và xem chi tiết thay đổi.',
                icon: FaListAlt,
                status: 'Chờ BE',
                actions: ['Lọc audit log', 'Xem chi tiết audit log', 'Ghi nhận oldValue/newValue']
            },
            {
                key: 'curriculums',
                path: '/admin/curriculums',
                roles: ['ADMIN'],
                permission: 'programs.view',
                title: 'Chương trình học',
                description: 'Theo dõi và điều phối dữ liệu chương trình giảng dạy toàn hệ thống.',
                icon: FaBookOpen,
                status: 'Chờ BE',
                actions: ['Xem chương trình', 'Kiểm tra môn đã duyệt', 'Theo dõi thay đổi']
            },
            {
                key: 'subjects',
                path: '/admin/subjects',
                roles: ['ADMIN'],
                permission: 'subjects.view',
                title: 'Môn học',
                description: 'Theo dõi danh mục môn học, đề xuất và trạng thái phê duyệt.',
                icon: FaGraduationCap,
                status: 'Có model Course, cần API workflow',
                actions: ['Xem danh sách môn', 'Lọc trạng thái', 'Xem chi tiết đề xuất']
            },
            {
                key: 'classes',
                path: '/admin/classes',
                roles: ['ADMIN'],
                permission: 'classes.view',
                title: 'Lớp học',
                description: 'Theo dõi lớp học, phân công quản lý và trạng thái đăng ký.',
                icon: FaLayerGroup,
                status: 'Có model Class, cần API',
                actions: ['Xem danh sách lớp', 'Theo dõi đăng ký', 'Kiểm tra phân công']
            },
            {
                key: 'lessons',
                path: '/admin/lessons',
                roles: ['ADMIN'],
                permission: 'lessons.view',
                title: 'Bài học',
                description: 'Theo dõi bài học, tài liệu và trạng thái xuất bản trong hệ thống.',
                icon: FaFileAlt,
                status: 'Chờ BE bài học',
                actions: ['Xem bài học', 'Lọc trạng thái xuất bản', 'Theo dõi tài liệu']
            },
            {
                key: 'exams',
                path: '/admin/exams',
                roles: ['ADMIN'],
                permission: 'exams.view',
                title: 'Bài kiểm tra',
                description: 'Theo dõi bài kiểm tra, cấu hình thời gian và log vi phạm.',
                icon: FaTasks,
                status: 'Chờ BE bài kiểm tra',
                actions: ['Xem bài kiểm tra', 'Xem cấu hình', 'Theo dõi log vi phạm']
            },
            {
                key: 'grades',
                path: '/admin/grades',
                roles: ['ADMIN'],
                permission: 'scores.view',
                title: 'Bảng điểm',
                description: 'Theo dõi bảng điểm, tổng hợp cuối kỳ và kết quả pass/fail toàn hệ thống.',
                icon: FaRegChartBar,
                status: 'Chờ BE điểm',
                actions: ['Xem bảng điểm', 'Tổng hợp cuối kỳ', 'Theo dõi pass/fail']
            }
        ]
    },
    hr: {
        role: 'HR',
        basePath: '/hr',
        title: 'HR',
        subtitle: 'Quản lý nhân sự và cấp tài khoản vận hành học vụ.',
        dashboardPath: '/hr',
        modules: [
            {
                key: 'users',
                path: '/hr/users',
                roles: ['HR'],
                permission: 'users.view',
                title: 'Quản lý tài khoản',
                description: 'Tạo tài khoản Phòng đào tạo, Trưởng bộ môn, Giảng viên và Sinh viên.',
                icon: FaUsers,
                status: 'Có API user cho Admin, cần phân quyền HR',
                actions: ['Tạo tài khoản', 'Cập nhật thông tin', 'Khóa tài khoản', 'Tìm kiếm/Lọc người dùng']
            },
            {
                key: 'permissions',
                path: '/hr/permissions',
                roles: ['HR'],
                permission: 'permissions.manage',
                title: 'Phân quyền nhân sự',
                description: 'Kiểm tra vai trò hợp lệ với quyền HR trước khi cấp tài khoản.',
                icon: FaUserCog,
                status: 'Chờ BE phân quyền',
                actions: ['Chọn vai trò cần tạo', 'Kiểm tra quyền HR', 'Gán role hợp lệ']
            }
        ]
    },
    principal: {
        role: 'PRINCIPAL',
        basePath: '/principal',
        title: 'Hiệu trưởng',
        subtitle: 'Duyệt, từ chối hoặc trả lại đề xuất môn học.',
        dashboardPath: '/principal',
        modules: [
            {
                key: 'users',
                path: '/principal/users',
                roles: ['PRINCIPAL'],
                permission: 'users.view',
                title: 'Quản lý người dùng',
                description: 'Xem danh sách, cập nhật và khóa/mở tài khoản theo quyền được Admin cấp.',
                icon: FaUserFriends,
                status: 'Có API user',
                actions: ['Xem danh sách người dùng', 'Cập nhật tài khoản', 'Khóa/Mở tài khoản']
            },
            {
                key: 'proposals',
                path: '/principal/proposals',
                roles: ['PRINCIPAL'],
                permission: 'proposals.approve',
                title: 'Duyệt đề xuất môn học',
                description: 'Xem danh sách, chi tiết, duyệt, từ chối hoặc trả lại đề xuất.',
                icon: FaClipboardCheck,
                status: 'Chờ BE course approval',
                actions: ['Xem danh sách đề xuất', 'Duyệt đề xuất', 'Từ chối đề xuất', 'Trả lại để chỉnh sửa']
            },
            {
                key: 'history',
                path: '/principal/proposals/history',
                roles: ['PRINCIPAL'],
                permission: 'proposals.history',
                title: 'Lịch sử xử lý',
                description: 'Theo dõi lịch sử duyệt đề xuất và thông báo kết quả.',
                icon: FaListAlt,
                status: 'Chờ BE',
                actions: ['Xem lịch sử', 'Lọc đề xuất', 'Xem ghi chú xử lý']
            }
        ]
    },
    training: {
        role: 'TRAINING_OFFICER',
        basePath: '/training',
        title: 'Phòng đào tạo',
        subtitle: 'Quản lý chương trình giảng dạy, môn học, lớp học và bảng điểm.',
        dashboardPath: '/training',
        modules: [
            {
                key: 'users',
                path: '/training/users',
                roles: ['TRAINING_OFFICER'],
                permission: 'users.view',
                title: 'Quản lý người dùng',
                description: 'Xem danh sách, cập nhật và khóa/mở tài khoản theo quyền được Admin cấp.',
                icon: FaUserFriends,
                status: 'Có API user',
                actions: ['Xem danh sách người dùng', 'Cập nhật tài khoản', 'Khóa/Mở tài khoản']
            },
            {
                key: 'curriculums',
                path: '/training/curriculums',
                roles: ['TRAINING_OFFICER'],
                permission: 'programs.view',
                title: 'Chương trình giảng dạy',
                description: 'Quản lý CTGD và thêm môn đã được duyệt vào chương trình.',
                icon: FaBookOpen,
                status: 'Chờ BE',
                actions: ['Quản lý chương trình', 'Thêm môn học vào CTGD', 'Tìm kiếm/Lọc môn học']
            },
            {
                key: 'subjects',
                path: '/training/subjects',
                roles: ['TRAINING_OFFICER'],
                permission: 'subjects.update',
                title: 'Môn học và đề xuất',
                description: 'Tạo đề xuất, xem danh sách đề xuất, gửi lên Hiệu trưởng hoặc trả lại TBM.',
                icon: FaGraduationCap,
                status: 'Có model Course, cần API workflow',
                actions: ['Tạo đề xuất môn học', 'Submit lên Hiệu trưởng', 'Từ chối đề xuất TBM', 'Trả lại để chỉnh sửa']
            },
            {
                key: 'classes',
                path: '/training/classes',
                roles: ['TRAINING_OFFICER'],
                permission: 'classes.create',
                title: 'Lớp học',
                description: 'Tạo lớp, cập nhật lớp, gán Trưởng bộ môn, mở/đóng đăng ký.',
                icon: FaLayerGroup,
                status: 'Có model Class, cần API',
                actions: ['Tạo lớp học', 'Gán Trưởng bộ môn', 'Mở đăng ký', 'Đóng đăng ký']
            },
            {
                key: 'grades',
                path: '/training/grades',
                roles: ['TRAINING_OFFICER'],
                permission: 'scores.view',
                title: 'Bảng điểm toàn hệ thống',
                description: 'Xem bảng điểm môn học, tổng hợp cuối kỳ và tính GPA.',
                icon: FaRegChartBar,
                status: 'Chờ BE điểm',
                actions: ['Xem bảng điểm', 'Tổng hợp cuối kỳ', 'Tính điểm trung bình học kỳ']
            }
        ]
    },
    department: {
        role: 'DEPARTMENT_HEAD',
        basePath: '/department',
        title: 'Trưởng bộ môn',
        subtitle: 'Đề xuất môn học, quản lý lớp thuộc bộ môn và phân công giảng viên.',
        dashboardPath: '/department',
        modules: [
            {
                key: 'users',
                path: '/department/users',
                roles: ['DEPARTMENT_HEAD'],
                permission: 'users.view',
                title: 'Quản lý người dùng',
                description: 'Xem danh sách, cập nhật và khóa/mở tài khoản theo quyền được Admin cấp.',
                icon: FaUserFriends,
                status: 'Có API user',
                actions: ['Xem danh sách người dùng', 'Cập nhật tài khoản', 'Khóa/Mở tài khoản']
            },
            {
                key: 'proposals',
                path: '/department/proposals',
                roles: ['DEPARTMENT_HEAD'],
                permission: 'proposals.create',
                title: 'Đề xuất môn học',
                description: 'Lưu nháp, gửi đề xuất cho Phòng đào tạo và chỉnh sửa đề xuất bị trả lại.',
                icon: FaClipboardList,
                status: 'Chờ BE workflow',
                actions: ['Đề xuất môn học mới', 'Lưu nháp', 'Gửi đề xuất', 'Xem trạng thái đề xuất']
            },
            {
                key: 'classes',
                path: '/department/classes',
                roles: ['DEPARTMENT_HEAD'],
                permission: 'classes.assignLecturer',
                title: 'Lớp đang quản lý',
                description: 'Xem lớp được phân công quản lý và phân công Giảng viên vào lớp.',
                icon: FaChalkboardTeacher,
                status: 'Có model Class, cần API phân công',
                actions: ['Xem chi tiết lớp', 'Chọn Giảng viên', 'Chọn vai trò trong lớp', 'Gửi thông báo']
            }
        ]
    },
    teacher: {
        role: 'LECTURER',
        basePath: '/teacher',
        title: 'Giảng viên',
        subtitle: 'Quản lý lớp được phân công, bài học, bài kiểm tra và điểm.',
        dashboardPath: '/teacher',
        modules: [
            {
                key: 'users',
                path: '/teacher/users',
                roles: ['LECTURER'],
                permission: 'users.view',
                title: 'Quản lý người dùng',
                description: 'Xem danh sách, cập nhật và khóa/mở tài khoản theo quyền được Admin cấp.',
                icon: FaUserFriends,
                status: 'Có API user',
                actions: ['Xem danh sách người dùng', 'Cập nhật tài khoản', 'Khóa/Mở tài khoản']
            },
            {
                key: 'classes',
                path: '/teacher/classes',
                roles: ['LECTURER'],
                permission: 'classes.view',
                title: 'Lớp được phân công',
                description: 'Xem lớp, sinh viên, bài học, bài kiểm tra và bảng điểm theo lớp.',
                icon: FaLayerGroup,
                status: 'Có model Class, cần API',
                actions: ['Xem danh sách lớp', 'Xem chi tiết lớp', 'Kiểm tra giảng viên thuộc lớp']
            },
            {
                key: 'lessons',
                path: '/teacher/lessons',
                roles: ['LECTURER'],
                permission: 'lessons.create',
                title: 'Quản lý bài học',
                description: 'Tạo, cập nhật, lưu nháp, xuất bản bài học và upload tài liệu.',
                icon: FaFileAlt,
                status: 'Chờ BE bài học',
                actions: ['Tạo bài học', 'Lưu nháp', 'Xuất bản', 'Upload tài liệu']
            },
            {
                key: 'exams',
                path: '/teacher/exams',
                roles: ['LECTURER'],
                permission: 'exams.create',
                title: 'Quản lý bài kiểm tra',
                description: 'Tạo bài kiểm tra, cấu hình thời gian, số lần làm và ngân hàng câu hỏi.',
                icon: FaTasks,
                status: 'Chờ BE bài kiểm tra',
                actions: ['Tạo bài kiểm tra', 'Cấu hình bài', 'Tạo câu hỏi', 'Xem log vi phạm']
            },
            {
                key: 'grades',
                path: '/teacher/grades',
                roles: ['LECTURER'],
                permission: 'scores.calculate',
                title: 'Bảng điểm lớp',
                description: 'Nhập điểm quá trình, điểm cuối kỳ, tính trung bình và xét pass/fail.',
                icon: FaRegChartBar,
                status: 'Chờ BE điểm',
                actions: ['Nhập điểm', 'Tính điểm trung bình', 'Xét Pass/Fail', 'Chấm điểm tự luận']
            }
        ]
    },
    student: {
        role: 'STUDENT',
        basePath: '/student',
        title: 'Sinh viên',
        subtitle: 'Đăng ký lớp, học bài, làm kiểm tra và xem điểm.',
        dashboardPath: '/student',
        modules: [
            {
                key: 'registration',
                path: '/student/registration',
                roles: ['STUDENT'],
                permission: 'classes.registration',
                title: 'Đăng ký lớp học',
                description: 'Xem lớp mở đăng ký, đăng ký hoặc hủy đăng ký lớp học.',
                icon: FaLayerGroup,
                status: 'Chờ BE enrollment',
                actions: ['Xem lớp mở đăng ký', 'Đăng ký lớp', 'Hủy đăng ký', 'Kiểm tra trùng lịch']
            },
            {
                key: 'classes',
                path: '/student/classes',
                roles: ['STUDENT'],
                permission: 'lessons.view',
                title: 'Lớp học của tôi',
                description: 'Xem lớp đã đăng ký, bài học, tài liệu và tiến độ học tập.',
                icon: FaBookOpen,
                status: 'Chờ BE',
                actions: ['Xem bài học', 'Đánh dấu hoàn thành', 'Xem tài liệu', 'Lưu tiến độ']
            },
            {
                key: 'exams',
                path: '/student/exams',
                roles: ['STUDENT'],
                permission: 'exams.take',
                title: 'Bài kiểm tra',
                description: 'Bắt đầu làm bài, tự động lưu, chống chuyển tab và nộp bài.',
                icon: FaClipboardCheck,
                status: 'Chờ BE exam attempt',
                actions: ['Bắt đầu bài kiểm tra', 'Trả lời câu hỏi', 'Tự động lưu', 'Nộp bài']
            },
            {
                key: 'grades',
                path: '/student/grades',
                roles: ['STUDENT'],
                permission: 'scores.view',
                title: 'Bảng điểm cá nhân',
                description: 'Xem điểm sau kiểm tra, điểm cá nhân và bảng điểm cuối kỳ.',
                icon: FaRegChartBar,
                status: 'Chờ BE điểm',
                actions: ['Xem điểm sau kiểm tra', 'Xem bảng điểm cá nhân', 'Xem bảng điểm cuối kỳ']
            }
        ]
    }
};

export const flatFlowModules = Object.values(flowWorkspaces).flatMap((workspace) =>
    workspace.modules.map((module) => ({
        ...module,
        workspaceKey: workspace.basePath.replace('/', ''),
        workspaceTitle: workspace.title,
        role: workspace.role
    }))
);
