import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditLogsModule } from '~/modules/audit-logs/audit-logs.module';
import { LessonSectionsController } from './lesson-sections.controller';
import { LessonSectionsService } from './lesson-sections.service';

@Module({
    imports: [JwtModule.register({}), AuditLogsModule],
    controllers: [LessonSectionsController],
    providers: [LessonSectionsService]
})
export class LessonSectionsModule {}
