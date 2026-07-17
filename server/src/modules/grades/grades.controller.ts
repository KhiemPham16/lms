import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Roles } from '~/common/decorators/roles.decorator';
import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import { TranscriptQueryDto } from './dto/transcript-query.dto';
import { GradesService } from './grades.service';

@Controller('grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradesController {
    constructor(private readonly grades: GradesService) {}

    @Get('classes/:publicId/gradebook')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD, UserRole.TRAINING_OFFICER)
    classGradebook(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.grades.classGradebook(publicId, user.sub);
    }

    @Post('classes/:publicId/finalize')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD, UserRole.TRAINING_OFFICER)
    finalizeClass(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.grades.finalizeClass(publicId, user.sub);
    }

    @Get('me/courses')
    @Roles(UserRole.STUDENT)
    myCourseGrades(@CurrentUser() user: JwtPayload) {
        return this.grades.myCourseGrades(user.sub);
    }

    @Get('me/transcript')
    @Roles(UserRole.STUDENT)
    myTranscript(@Query() query: TranscriptQueryDto, @CurrentUser() user: JwtPayload) {
        return this.grades.myTranscript(user.sub, query);
    }
}
