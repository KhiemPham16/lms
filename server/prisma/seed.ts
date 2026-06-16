import 'dotenv/config';

import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcrypt';

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);

const prisma = new PrismaClient({
    adapter
});

async function main() {
    const password = await bcrypt.hash('123456', 10);

    const users = [
        {
            code: 'ADMIN001',
            fullName: 'System Administrator',
            email: 'admin@lms.com',
            password,
            role: UserRole.ADMIN
        },
        {
            code: 'P001',
            fullName: 'Hiệu Trưởng',
            email: 'ht@lms.com',
            password,
            role: UserRole.PRINCIPAL
        },
        {
            code: 'PDT001',
            fullName: 'Phòng Đào Tạo',
            email: 'pdt@lms.com',
            password,
            role: UserRole.TRAINING_OFFICER
        },
        {
            code: 'TK001',
            fullName: 'Trưởng Khoa CNTT',
            email: 'cntt@lms.com',
            password,
            role: UserRole.DEPARTMENT_HEAD
        },
        {
            code: 'GV001',
            fullName: 'Nguyễn Văn A',
            email: 'gv1@lms.com',
            password,
            role: UserRole.LECTURER
        },
        {
            code: 'GV002',
            fullName: 'Trần Văn B',
            email: 'gv2@lms.com',
            password,
            role: UserRole.LECTURER
        }
    ];

    for (const user of users) {
        await prisma.user.upsert({
            where: {
                email: user.email
            },
            update: {},
            create: {
                ...user,
                status: UserStatus.ACTIVE
            }
        });
    }

    console.log('✅ Users seeded');

    await prisma.department.upsert({
        where: {
            code: 'CNTT'
        },
        update: {},
        create: {
            code: 'CNTT',
            name: 'Khoa Công Nghệ Thông Tin'
        }
    });

    await prisma.department.upsert({
        where: {
            code: 'PDT'
        },
        update: {},
        create: {
            code: 'PDT',
            name: 'Phòng Đào Tạo'
        }
    });

    await prisma.department.upsert({
        where: {
            code: 'BGH'
        },
        update: {},
        create: {
            code: 'BGH',
            name: 'Ban Giám Hiệu'
        }
    });

    console.log('✅ Departments seeded');

    console.log('✅ Seeding completed');
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
