import { Module } from '@nestjs/common';
import { AppController } from '~/app.controller';
import { PrismaModule } from '~/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import configuration from '~/config/env.config';

import { QueueModule } from './queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { RolesModule } from './modules/roles/roles.module';
import { CoursesModule } from './modules/courses/courses.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { ClassesModule } from './modules/classes/classes.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { AppHealthService } from './app-health.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration]
        }),

        PrismaModule,
        QueueModule,
        AuthModule,
        UsersModule,
        DepartmentsModule,
        RolesModule,
        AuditLogsModule,
        CoursesModule,
        ClassesModule,
        EnrollmentsModule,
        LessonsModule
    ],
    controllers: [AppController],
    providers: [AppHealthService]
})
export class AppModule {}
