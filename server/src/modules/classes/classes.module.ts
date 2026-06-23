import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditLogsModule } from '~/modules/audit-logs/audit-logs.module';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
    imports: [JwtModule.register({}), AuditLogsModule],
    controllers: [ClassesController],
    providers: [ClassesService]
})
export class ClassesModule {}
