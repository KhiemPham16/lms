import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';

@Module({
    imports: [LearningModule],
    controllers: [GradesController],
    providers: [GradesService]
})
export class GradesModule {}
