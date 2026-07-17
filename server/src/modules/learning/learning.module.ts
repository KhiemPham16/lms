import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CodeGradingProcessor } from './code-grading.processor';
import { Judge0Service } from './judge0.service';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { MediaModule } from '../media/media.module';

@Module({
    imports: [BullModule.registerQueue({ name: 'code-grading' }), MediaModule],
    controllers: [LearningController],
    providers: [LearningService, Judge0Service, CodeGradingProcessor],
    exports: [LearningService]
})
export class LearningModule {}
