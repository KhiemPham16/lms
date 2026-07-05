import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditLogsModule } from '~/modules/audit-logs/audit-logs.module';
import { NotificationsModule } from '~/modules/notifications/notifications.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
    imports: [JwtModule.register({}), AuditLogsModule, NotificationsModule],
    controllers: [EnrollmentsController],
    providers: [EnrollmentsService]
})
export class EnrollmentsModule {}
