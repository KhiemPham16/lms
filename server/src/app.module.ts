import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from '~/app.controller';
import { PrismaModule } from '~/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import configuration from '~/config/env.config';

import { AuthModule } from './modules/auth/auth.module';
import { AppHealthService } from './app-health.service';
import { QueueModule } from './queue/queue.module';
import { AuditModule } from './modules/audit/audit.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { UsersModule } from './modules/users/users.module';
import { AcademicsModule } from './modules/academics/academics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { LearningModule } from './modules/learning/learning.module';
import { GradesModule } from './modules/grades/grades.module';
import { MediaModule } from './modules/media/media.module';
import { MaintenanceMiddleware } from './modules/system-settings/maintenance.middleware';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration]
        }),

        PrismaModule,
        QueueModule,
        AuditModule,
        SystemSettingsModule,
        DashboardModule,
        AuthModule,
        DepartmentsModule,
        UsersModule,
        NotificationsModule,
        EnrollmentsModule,
        LearningModule,
        GradesModule,
        MediaModule,
        AcademicsModule
    ],
    controllers: [AppController],
    providers: [AppHealthService]
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(MaintenanceMiddleware).forRoutes('*');
    }
}
