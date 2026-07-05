import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditLogsModule } from '~/modules/audit-logs/audit-logs.module';
import { NotificationsModule } from '~/modules/notifications/notifications.module';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
    imports: [JwtModule.register({}), AuditLogsModule, NotificationsModule],
    controllers: [LessonsController],
    providers: [LessonsService]
})
export class LessonsModule {}
