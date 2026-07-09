import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditLogsModule } from '~/modules/audit-logs/audit-logs.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
    imports: [JwtModule.register({}), AuditLogsModule],
    controllers: [MediaController],
    providers: [MediaService]
})
export class MediaModule {}
