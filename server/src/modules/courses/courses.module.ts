import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';

@Module({
    imports: [JwtModule.register({}), AuditLogsModule, NotificationsModule],
    providers: [CoursesService],
    controllers: [CoursesController]
})
export class CoursesModule {}
