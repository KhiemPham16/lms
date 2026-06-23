import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';

@Module({
    imports: [JwtModule.register({}), AuditLogsModule],
    providers: [CoursesService],
    controllers: [CoursesController]
})
export class CoursesModule {}
