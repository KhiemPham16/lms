import 'dotenv/config';

import {
    ApprovalAction,
    ApprovalLevel,
    AuditAction,
    ClassStatus,
    CourseStatus,
    EnrollmentStatus,
    PrismaClient,
    UserStatus
} from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcrypt';

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);

const prisma = new PrismaClient({
    adapter
});

const roles = [
    { code: 'ADMIN', name: 'Administrator', description: 'System administrator' },
    { code: 'HR', name: 'HR', description: 'Human resources' },
    { code: 'PRINCIPAL', name: 'Principal', description: 'Principal' },
    { code: 'TRAINING_OFFICER', name: 'Training Officer', description: 'Training office' },
    { code: 'DEPARTMENT_HEAD', name: 'Department Head', description: 'Department head' },
    { code: 'LECTURER', name: 'Lecturer', description: 'Lecturer' },
    { code: 'STUDENT', name: 'Student', description: 'Student' }
];

const permissions = [
    { code: 'users.read', name: 'Xem danh sách', module: 'users' },
    { code: 'users.create', name: 'Tạo mới', module: 'users' },
    { code: 'users.update', name: 'Chỉnh sửa', module: 'users' },
    { code: 'users.status', name: 'Khóa/Mở khóa', module: 'users' },
    { code: 'departments.read', name: 'Xem khoa/phòng ban', module: 'departments' },
    { code: 'departments.create', name: 'Tạo khoa/phòng ban', module: 'departments' },
    { code: 'departments.update', name: 'Cập nhật khoa/phòng ban', module: 'departments' },
    { code: 'departments.delete', name: 'Xóa khoa/phòng ban', module: 'departments' },
    { code: 'system.permissions.manage', name: 'Quản lý phân quyền', module: 'system' },
    { code: 'system.audit.read', name: 'Xem Audit Log', module: 'system' },
    { code: 'courses.read', name: 'Xem môn học', module: 'courses' },
    { code: 'courses.update', name: 'Cập nhật môn học', module: 'courses' },
    { code: 'course_proposals.create', name: 'Tạo đề xuất', module: 'course_proposals' },
    { code: 'course_proposals.approve', name: 'Duyệt đề xuất', module: 'course_proposals' },
    { code: 'course_proposals.history.read', name: 'Xem lịch sử xử lý', module: 'course_proposals' },
    { code: 'classes.read', name: 'Xem lớp học', module: 'classes' },
    { code: 'classes.create', name: 'Tạo lớp', module: 'classes' },
    { code: 'classes.delete', name: 'Xóa lớp', module: 'classes' },
    { code: 'classes.assign_lecturer', name: 'Gán giảng viên', module: 'classes' },
    { code: 'classes.registration.toggle', name: 'Mở/Đóng đăng ký', module: 'classes' },
    { code: 'enrollments.read', name: 'Xem đăng ký lớp', module: 'enrollments' },
    { code: 'enrollments.create', name: 'Đăng ký lớp', module: 'enrollments' },
    { code: 'enrollments.drop', name: 'Hủy đăng ký lớp', module: 'enrollments' },
    { code: 'lessons.read', name: 'Xem bài học', module: 'lessons' },
    { code: 'lessons.create', name: 'Tạo bài học', module: 'lessons' },
    { code: 'media.read', name: 'Xem media', module: 'media' },
    { code: 'media.create', name: 'Quản lý media', module: 'media' },
    { code: 'exams.read', name: 'Xem bài thi', module: 'exams' },
    { code: 'exams.create', name: 'Tạo bài thi', module: 'exams' },
    { code: 'exams.submit', name: 'Làm bài thi', module: 'exams' },
    { code: 'exams.grade', name: 'Chấm điểm', module: 'exams' },
    { code: 'grades.read', name: 'Xem điểm', module: 'grades' },
    { code: 'grades.calculate', name: 'Tính điểm', module: 'grades' },
    { code: 'grades.export', name: 'Xuất bảng điểm', module: 'grades' },
    { code: 'notifications.read', name: 'Xem thong bao', module: 'notifications' }
];

const commonUserPermissions = ['notifications.read'];

const rolePermissionDefaults: Record<string, string[]> = {
    ADMIN: permissions.map((permission) => permission.code),
    HR: ['users.read', 'users.create', 'users.update', 'users.status', 'departments.read'],
    PRINCIPAL: [
        'departments.read',
        'courses.read',
        'course_proposals.approve',
        'course_proposals.history.read',
        'classes.read',
        'classes.delete',
        'grades.read',
        'grades.export',
        'enrollments.read'
    ],
    TRAINING_OFFICER: [
        'users.read',
        'departments.read',
        'courses.read',
        'courses.update',
        'course_proposals.create',
        'course_proposals.approve',
        'course_proposals.history.read',
        'classes.read',
        'classes.create',
        'classes.delete',
        'classes.assign_lecturer',
        'classes.registration.toggle',
        'enrollments.read',
        'media.read',
        'media.create',
        'grades.read',
        'grades.calculate',
        'grades.export'
    ],
    DEPARTMENT_HEAD: [
        'departments.read',
        'courses.read',
        'courses.update',
        'course_proposals.create',
        'course_proposals.history.read',
        'classes.read',
        'classes.assign_lecturer',
        'classes.registration.toggle',
        'enrollments.read',
        'lessons.read',
        'media.read',
        'media.create',
        'exams.read',
        'grades.read'
    ],
    LECTURER: [
        'courses.read',
        'classes.read',
        'enrollments.read',
        'lessons.read',
        'lessons.create',
        'media.read',
        'media.create',
        'exams.read',
        'exams.create',
        'exams.grade',
        'grades.read',
        'grades.calculate'
    ],
    STUDENT: [
        'courses.read',
        'classes.read',
        'enrollments.read',
        'enrollments.create',
        'enrollments.drop',
        'lessons.read',
        'exams.read',
        'exams.submit',
        'grades.read'
    ]
};

async function main() {
    for (const role of roles) {
        await prisma.role.upsert({
            where: { code: role.code },
            update: {
                name: role.name,
                description: role.description,
                isSystem: true
            },
            create: {
                ...role,
                isSystem: true
            }
        });
    }

    for (const permission of permissions) {
        await prisma.permission.upsert({
            where: { code: permission.code },
            update: {
                name: permission.name,
                module: permission.module
            },
            create: permission
        });
    }

    const roleMap = new Map(
        (
            await prisma.role.findMany({
                select: {
                    id: true,
                    code: true
                }
            })
        ).map((role) => [role.code, role.id])
    );

    const permissionMap = new Map(
        (
            await prisma.permission.findMany({
                select: {
                    id: true,
                    code: true
                }
            })
        ).map((permission) => [permission.code, permission.id])
    );

    const rolePermissionRows = Object.entries(rolePermissionDefaults).flatMap(([roleCode, permissionCodes]) => {
        const roleId = roleMap.get(roleCode);

        if (!roleId) {
            return [];
        }

        const effectivePermissionCodes =
            roleCode === 'ADMIN' ? permissionCodes : Array.from(new Set([...permissionCodes, ...commonUserPermissions]));

        return effectivePermissionCodes
            .map((permissionCode) => {
                const permissionId = permissionMap.get(permissionCode);

                if (!permissionId) {
                    return null;
                }

                return {
                    roleId,
                    permissionId
                };
            })
            .filter((item): item is { roleId: number; permissionId: number } => Boolean(item));
    });

    await prisma.rolePermission.createMany({
        data: rolePermissionRows,
        skipDuplicates: true
    });

    await prisma.rolePermission.deleteMany({
        where: {
            permission: {
                code: 'system.permissions.manage'
            },
            role: {
                code: {
                    not: 'ADMIN'
                }
            }
        }
    });

    const departments = [
        {
            code: 'CNTT',
            name: 'Khoa Công Nghệ Thông Tin'
        },
        {
            code: 'PDT',
            name: 'Phòng Đào Tạo'
        },
        {
            code: 'BGH',
            name: 'Ban Giám Hiệu'
        },
        {
            code: 'HR',
            name: 'Phòng Nhân Sự'
        }
    ];

    for (const department of departments) {
        await prisma.department.upsert({
            where: {
                code: department.code
            },
            update: {
                name: department.name
            },
            create: department
        });
    }

    const departmentMap = new Map(
        (
            await prisma.department.findMany({
                select: {
                    id: true,
                    code: true
                }
            })
        ).map((department) => [department.code, department.id])
    );

    const password = await bcrypt.hash('Lms@123', 10);

    const users = [
        {
            code: '982610001',
            fullName: 'System Administrator',
            email: 'admin@lms.com',
            role: 'ADMIN',
            department: 'BGH'
        },
        {
            code: '962610001',
            fullName: 'Human Resources',
            email: 'hr@lms.com',
            role: 'HR',
            department: 'HR'
        },
        {
            code: '972610001',
            fullName: 'Principal',
            email: 'ht@lms.com',
            role: 'PRINCIPAL',
            department: 'BGH'
        },
        {
            code: '952610001',
            fullName: 'Training Office',
            email: 'pdt@lms.com',
            role: 'TRAINING_OFFICER',
            department: 'PDT'
        },
        {
            code: '942610001',
            fullName: 'Department Head',
            email: 'cntt@lms.com',
            role: 'DEPARTMENT_HEAD',
            department: 'CNTT'
        },
        {
            code: '932610001',
            fullName: 'Lecturer One',
            email: 'gv1@lms.com',
            role: 'LECTURER',
            department: 'CNTT'
        },
        {
            code: '932610002',
            fullName: 'Lecturer Two',
            email: 'gv2@lms.com',
            role: 'LECTURER',
            department: 'CNTT'
        },
        {
            code: '922210001',
            fullName: 'Student One',
            email: 'student1@lms.com',
            role: 'STUDENT',
            department: 'CNTT'
        }
    ];

    for (const user of users) {
        await prisma.user.upsert({
            where: {
                email: user.email
            },
            update: {
                code: user.code,
                roleId: roleMap.get(user.role) ?? roleMap.get('STUDENT')!,
                departmentId: departmentMap.get(user.department)
            },
            create: {
                code: user.code,
                fullName: user.fullName,
                email: user.email,
                password,
                roleId: roleMap.get(user.role) ?? roleMap.get('STUDENT')!,
                departmentId: departmentMap.get(user.department),
                status: UserStatus.ACTIVE
            }
        });
    }

    console.log('Dynamic roles, permissions and users seeded');

    const seededUsers = new Map(
        (
            await prisma.user.findMany({
                where: {
                    email: {
                        in: users.map((user) => user.email)
                    }
                },
                select: {
                    id: true,
                    email: true
                }
            })
        ).map((user) => [user.email, user.id])
    );

    const javaCourse = await prisma.course.upsert({
        where: {
            code: 'JAVA101'
        },
        update: {
            name: 'Lập trình Java cơ bản',
            description: 'Môn học mẫu đã được duyệt trong seed',
            credits: 3,
            requestedClassCount: 2,
            requiresPrincipalApproval: true,
            departmentId: departmentMap.get('CNTT')!,
            proposedById: seededUsers.get('cntt@lms.com')!,
            status: CourseStatus.ACTIVE
        },
        create: {
            code: 'JAVA101',
            name: 'Lập trình Java cơ bản',
            description: 'Môn học mẫu đã được duyệt trong seed',
            credits: 3,
            requestedClassCount: 2,
            requiresPrincipalApproval: true,
            departmentId: departmentMap.get('CNTT')!,
            proposedById: seededUsers.get('cntt@lms.com')!,
            status: CourseStatus.ACTIVE
        }
    });

    await prisma.courseApproval.deleteMany({
        where: {
            courseId: javaCourse.id
        }
    });

    await prisma.courseApproval.createMany({
        data: [
            {
                courseId: javaCourse.id,
                approverId: seededUsers.get('pdt@lms.com')!,
                level: ApprovalLevel.PDT,
                action: ApprovalAction.APPROVED,
                note: 'Seed approval by training office'
            },
            {
                courseId: javaCourse.id,
                approverId: seededUsers.get('ht@lms.com')!,
                level: ApprovalLevel.PRINCIPAL,
                action: ApprovalAction.APPROVED,
                note: 'Seed approval by principal'
            }
        ],
        skipDuplicates: true
    });

    await prisma.course.upsert({
        where: {
            code: 'CNET101'
        },
        update: {
            name: 'Mạng máy tính cơ bản',
            description: 'Môn học mẫu đang chờ phòng đào tạo duyệt',
            credits: 3,
            requestedClassCount: 1,
            requiresPrincipalApproval: true,
            departmentId: departmentMap.get('CNTT')!,
            proposedById: seededUsers.get('cntt@lms.com')!,
            status: CourseStatus.PENDING_PDT
        },
        create: {
            code: 'CNET101',
            name: 'Mạng máy tính cơ bản',
            description: 'Môn học mẫu đang chờ phòng đào tạo duyệt',
            credits: 3,
            requestedClassCount: 1,
            requiresPrincipalApproval: true,
            departmentId: departmentMap.get('CNTT')!,
            proposedById: seededUsers.get('cntt@lms.com')!,
            status: CourseStatus.PENDING_PDT
        }
    });

    const javaClass = await prisma.class.upsert({
        where: {
            code: 'JAVA101-01'
        },
        update: {
            name: 'Lớp Java 01',
            courseId: javaCourse.id,
            lecturerId: seededUsers.get('gv1@lms.com')!,
            departmentHeadId: seededUsers.get('cntt@lms.com')!,
            maxStudents: 40,
            startDate: new Date('2026-08-01'),
            endDate: new Date('2026-12-15'),
            status: ClassStatus.OPEN_REGISTRATION
        },
        create: {
            code: 'JAVA101-01',
            name: 'Lớp Java 01',
            courseId: javaCourse.id,
            lecturerId: seededUsers.get('gv1@lms.com')!,
            departmentHeadId: seededUsers.get('cntt@lms.com')!,
            maxStudents: 40,
            startDate: new Date('2026-08-01'),
            endDate: new Date('2026-12-15'),
            status: ClassStatus.OPEN_REGISTRATION
        }
    });

    await prisma.class.upsert({
        where: {
            code: 'JAVA101-02'
        },
        update: {
            name: 'Lớp Java 02',
            courseId: javaCourse.id,
            lecturerId: seededUsers.get('gv2@lms.com')!,
            departmentHeadId: seededUsers.get('cntt@lms.com')!,
            maxStudents: 35,
            startDate: new Date('2026-08-01'),
            endDate: new Date('2026-12-15'),
            status: ClassStatus.DRAFT
        },
        create: {
            code: 'JAVA101-02',
            name: 'Lớp Java 02',
            courseId: javaCourse.id,
            lecturerId: seededUsers.get('gv2@lms.com')!,
            departmentHeadId: seededUsers.get('cntt@lms.com')!,
            maxStudents: 35,
            startDate: new Date('2026-08-01'),
            endDate: new Date('2026-12-15'),
            status: ClassStatus.DRAFT
        }
    });

    await prisma.enrollment.upsert({
        where: {
            studentId_classId: {
                studentId: seededUsers.get('student1@lms.com')!,
                classId: javaClass.id
            }
        },
        update: {
            status: EnrollmentStatus.APPROVED,
            enrolledAt: new Date()
        },
        create: {
            studentId: seededUsers.get('student1@lms.com')!,
            classId: javaClass.id,
            status: EnrollmentStatus.APPROVED
        }
    });

    await prisma.auditLog.deleteMany({
        where: {
            OR: [
                {
                    targetPublicId: javaCourse.publicId
                },
                {
                    targetPublicId: javaClass.publicId
                },
                {
                    module: 'enrollments',
                    actorId: seededUsers.get('student1@lms.com')!
                }
            ]
        }
    });

    await prisma.auditLog.createMany({
        data: [
            {
                actorId: seededUsers.get('cntt@lms.com')!,
                action: AuditAction.CREATE,
                module: 'courses',
                targetType: 'Course',
                targetId: javaCourse.id,
                targetPublicId: javaCourse.publicId,
                newValue: {
                    code: javaCourse.code,
                    status: javaCourse.status
                }
            },
            {
                actorId: seededUsers.get('pdt@lms.com')!,
                action: AuditAction.APPROVE,
                module: 'course_proposals',
                targetType: 'Course',
                targetId: javaCourse.id,
                targetPublicId: javaCourse.publicId,
                newValue: {
                    level: ApprovalLevel.PDT,
                    action: ApprovalAction.APPROVED
                }
            },
            {
                actorId: seededUsers.get('pdt@lms.com')!,
                action: AuditAction.CREATE,
                module: 'classes',
                targetType: 'Class',
                targetId: javaClass.id,
                targetPublicId: javaClass.publicId,
                newValue: {
                    code: javaClass.code,
                    status: javaClass.status
                }
            },
            {
                actorId: seededUsers.get('student1@lms.com')!,
                action: AuditAction.ENROLL,
                module: 'enrollments',
                targetType: 'Enrollment',
                newValue: {
                    classId: javaClass.id,
                    classPublicId: javaClass.publicId,
                    status: EnrollmentStatus.APPROVED
                }
            }
        ],
        skipDuplicates: true
    });

    console.log('Courses, classes, enrollments and audit logs seeded');

    console.log('Seeding completed');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (error) => {
        console.error(error);
        await prisma.$disconnect();
        process.exit(1);
    });
