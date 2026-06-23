import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

@Module({
    imports: [JwtModule.register({})],
    controllers: [AuditLogsController],
    providers: [AuditLogsService],
    exports: [AuditLogsService]
})
export class AuditLogsModule {}
