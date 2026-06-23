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
    { code: 'users.read', name: 'Xem danh sach', module: 'users' },
    { code: 'users.create', name: 'Tao moi', module: 'users' },
    { code: 'users.update', name: 'Chinh sua', module: 'users' },
    { code: 'users.status', name: 'Khoa/Mo khoa', module: 'users' },
    { code: 'departments.read', name: 'Xem khoa/phong ban', module: 'departments' },
    { code: 'departments.create', name: 'Tao khoa/phong ban', module: 'departments' },
    { code: 'departments.update', name: 'Cap nhat khoa/phong ban', module: 'departments' },
    { code: 'departments.delete', name: 'Xoa khoa/phong ban', module: 'departments' },
    { code: 'system.permissions.manage', name: 'Quan ly phan quyen', module: 'system' },
    { code: 'system.audit.read', name: 'Xem Audit Log', module: 'system' },
    { code: 'curriculum.read', name: 'Xem chuong trinh', module: 'curriculum' },
    { code: 'curriculum.create', name: 'Tao chuong trinh', module: 'curriculum' },
    { code: 'courses.read', name: 'Xem mon hoc', module: 'courses' },
    { code: 'courses.update', name: 'Cap nhat mon hoc', module: 'courses' },
    { code: 'course_proposals.create', name: 'Tao de xuat', module: 'course_proposals' },
    { code: 'course_proposals.approve', name: 'Duyet de xuat', module: 'course_proposals' },
    { code: 'course_proposals.history.read', name: 'Xem lich su xu ly', module: 'course_proposals' },
    { code: 'classes.read', name: 'Xem lop hoc', module: 'classes' },
    { code: 'classes.create', name: 'Tao lop', module: 'classes' },
    { code: 'classes.assign_lecturer', name: 'Gan giang vien', module: 'classes' },
    { code: 'classes.registration.toggle', name: 'Mo/Dong dang ky', module: 'classes' },
    { code: 'enrollments.read', name: 'Xem dang ky lop', module: 'enrollments' },
    { code: 'enrollments.create', name: 'Dang ky lop', module: 'enrollments' },
    { code: 'enrollments.drop', name: 'Huy dang ky lop', module: 'enrollments' },
    { code: 'lessons.read', name: 'Xem bai hoc', module: 'lessons' },
    { code: 'lessons.create', name: 'Tao bai hoc', module: 'lessons' },
    { code: 'exams.read', name: 'Xem bai thi', module: 'exams' },
    { code: 'exams.create', name: 'Tao bai thi', module: 'exams' },
    { code: 'exams.submit', name: 'Lam bai thi', module: 'exams' },
    { code: 'exams.grade', name: 'Cham diem', module: 'exams' },
    { code: 'grades.read', name: 'Xem diem', module: 'grades' },
    { code: 'grades.calculate', name: 'Tinh diem', module: 'grades' },
    { code: 'grades.export', name: 'Xuat bang diem', module: 'grades' }
];

const rolePermissionDefaults: Record<string, string[]> = {
    ADMIN: permissions.map((permission) => permission.code),
    HR: [
        'users.read',
        'users.create',
        'users.update',
        'users.status',
        'departments.read',
        'system.audit.read'
    ],
    PRINCIPAL: [
        'departments.read',
        'system.audit.read',
        'curriculum.read',
        'courses.read',
        'course_proposals.approve',
        'course_proposals.history.read',
        'classes.read',
        'grades.read',
        'grades.export',
        'enrollments.read'
    ],
    TRAINING_OFFICER: [
        'departments.read',
        'curriculum.read',
        'curriculum.create',
        'courses.read',
        'courses.update',
        'course_proposals.approve',
        'course_proposals.history.read',
        'classes.read',
        'classes.create',
        'classes.assign_lecturer',
        'classes.registration.toggle',
        'enrollments.read',
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
        'enrollments.read',
        'lessons.read',
        'exams.read',
        'grades.read'
    ],
    LECTURER: [
        'courses.read',
        'classes.read',
        'enrollments.read',
        'lessons.read',
        'lessons.create',
        'exams.read',
        'exams.create',
        'exams.grade',
        'grades.read',
        'grades.calculate'
    ],
    STUDENT: [
        'courses.read',
        'classes.read',
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

        return permissionCodes
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
            name: 'Khoa Cong Nghe Thong Tin'
        },
        {
            code: 'PDT',
            name: 'Phong Dao Tao'
        },
        {
            code: 'BGH',
            name: 'Ban Giam Hieu'
        },
        {
            code: 'HR',
            name: 'Phong Nhan Su'
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

    const password = await bcrypt.hash('123456', 10);

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
            name: 'Lap trinh Java co ban',
            description: 'Mon hoc mau da duoc duyet trong seed',
            credits: 3,
            requestedClassCount: 2,
            departmentId: departmentMap.get('CNTT')!,
            proposedById: seededUsers.get('cntt@lms.com')!,
            status: CourseStatus.ACTIVE
        },
        create: {
            code: 'JAVA101',
            name: 'Lap trinh Java co ban',
            description: 'Mon hoc mau da duoc duyet trong seed',
            credits: 3,
            requestedClassCount: 2,
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
            name: 'Mang may tinh can ban',
            description: 'Mon hoc mau dang cho phong dao tao duyet',
            credits: 3,
            requestedClassCount: 1,
            departmentId: departmentMap.get('CNTT')!,
            proposedById: seededUsers.get('cntt@lms.com')!,
            status: CourseStatus.PENDING_PDT
        },
        create: {
            code: 'CNET101',
            name: 'Mang may tinh can ban',
            description: 'Mon hoc mau dang cho phong dao tao duyet',
            credits: 3,
            requestedClassCount: 1,
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
            name: 'Lop Java 01',
            courseId: javaCourse.id,
            lecturerId: seededUsers.get('gv1@lms.com')!,
            maxStudents: 40,
            startDate: new Date('2026-08-01'),
            endDate: new Date('2026-12-15'),
            status: ClassStatus.OPEN
        },
        create: {
            code: 'JAVA101-01',
            name: 'Lop Java 01',
            courseId: javaCourse.id,
            lecturerId: seededUsers.get('gv1@lms.com')!,
            maxStudents: 40,
            startDate: new Date('2026-08-01'),
            endDate: new Date('2026-12-15'),
            status: ClassStatus.OPEN
        }
    });

    await prisma.class.upsert({
        where: {
            code: 'JAVA101-02'
        },
        update: {
            name: 'Lop Java 02',
            courseId: javaCourse.id,
            lecturerId: seededUsers.get('gv2@lms.com')!,
            maxStudents: 35,
            startDate: new Date('2026-08-01'),
            endDate: new Date('2026-12-15'),
            status: ClassStatus.UPCOMING
        },
        create: {
            code: 'JAVA101-02',
            name: 'Lop Java 02',
            courseId: javaCourse.id,
            lecturerId: seededUsers.get('gv2@lms.com')!,
            maxStudents: 35,
            startDate: new Date('2026-08-01'),
            endDate: new Date('2026-12-15'),
            status: ClassStatus.UPCOMING
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
