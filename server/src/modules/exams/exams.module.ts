import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditLogsModule } from '~/modules/audit-logs/audit-logs.module';
import { NotificationsModule } from '~/modules/notifications/notifications.module';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({
    imports: [JwtModule.register({}), AuditLogsModule, NotificationsModule],
    controllers: [ExamsController],
    providers: [ExamsService]
})
export class ExamsModule {}
