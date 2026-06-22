import 'dotenv/config';

import { PrismaClient, UserStatus } from '@prisma/client';
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
        'grades.export'
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
        'lessons.read',
        'exams.read',
        'grades.read'
    ],
    LECTURER: [
        'courses.read',
        'classes.read',
        'lessons.read',
        'lessons.create',
        'exams.read',
        'exams.create',
        'exams.grade',
        'grades.read',
        'grades.calculate'
    ],
    STUDENT: ['courses.read', 'classes.read', 'lessons.read', 'exams.read', 'exams.submit', 'grades.read']
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

    const password = await bcrypt.hash('123456', 10);

    const users = [
        { code: 'ADMIN001', fullName: 'System Administrator', email: 'admin@lms.com', role: 'ADMIN' },
        { code: 'HR001', fullName: 'Human Resources', email: 'hr@lms.com', role: 'HR' },
        { code: 'P001', fullName: 'Principal', email: 'ht@lms.com', role: 'PRINCIPAL' },
        { code: 'PDT001', fullName: 'Training Office', email: 'pdt@lms.com', role: 'TRAINING_OFFICER' },
        { code: 'TK001', fullName: 'Department Head', email: 'cntt@lms.com', role: 'DEPARTMENT_HEAD' },
        { code: 'GV001', fullName: 'Lecturer One', email: 'gv1@lms.com', role: 'LECTURER' },
        { code: 'GV002', fullName: 'Lecturer Two', email: 'gv2@lms.com', role: 'LECTURER' }
    ];

    for (const user of users) {
        await prisma.user.upsert({
            where: {
                email: user.email
            },
            update: {
                roleId: roleMap.get(user.role) ?? roleMap.get('STUDENT')!
            },
            create: {
                code: user.code,
                fullName: user.fullName,
                email: user.email,
                password,
                roleId: roleMap.get(user.role) ?? roleMap.get('STUDENT')!,
                status: UserStatus.ACTIVE
            }
        });
    }

    console.log('Dynamic roles, permissions and users seeded');

    await prisma.department.upsert({
        where: {
            code: 'CNTT'
        },
        update: {},
        create: {
            code: 'CNTT',
            name: 'Khoa Cong Nghe Thong Tin'
        }
    });

    await prisma.department.upsert({
        where: {
            code: 'PDT'
        },
        update: {},
        create: {
            code: 'PDT',
            name: 'Phong Dao Tao'
        }
    });

    await prisma.department.upsert({
        where: {
            code: 'BGH'
        },
        update: {},
        create: {
            code: 'BGH',
            name: 'Ban Giam Hieu'
        }
    });

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
