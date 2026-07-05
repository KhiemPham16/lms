import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { CourseProgressController } from './course-progress.controller';
import { CourseProgressService } from './course-progress.service';

@Module({
    imports: [JwtModule.register({})],
    controllers: [CourseProgressController],
    providers: [CourseProgressService]
})
export class CourseProgressModule {}
