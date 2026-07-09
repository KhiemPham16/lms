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
import { LessonSectionsModule } from './modules/lesson-sections/lesson-sections.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { ExamsModule } from './modules/exams/exams.module';
import { GradebookModule } from './modules/gradebook/gradebook.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CourseProgressModule } from './modules/course-progress/course-progress.module';
import { MediaModule } from './modules/media/media.module';
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
        LessonSectionsModule,
        LessonsModule,
        ExamsModule,
        GradebookModule,
        NotificationsModule,
        CourseProgressModule,
        MediaModule
    ],
    controllers: [AppController],
    providers: [AppHealthService]
})
export class AppModule {}
