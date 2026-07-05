import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { CourseProgressService } from './course-progress.service';

@ApiTags('Course Progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CourseProgressController {
    constructor(private readonly courseProgressService: CourseProgressService) {}

    @Get('students/me/course-progress')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Tiến độ học tập của sinh viên đang đăng nhập' })
    myProgress(@CurrentUser() user: JwtPayload) {
        return this.courseProgressService.myProgress(user.sub);
    }

    @Get('classes/:classPublicId/course-progress')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Tiến độ học tập của cả lớp' })
    classProgress(@Param('classPublicId') classPublicId: string, @CurrentUser() user: JwtPayload) {
        return this.courseProgressService.classProgress(classPublicId, user.sub);
    }

    @Get('classes/:classPublicId/students/:studentPublicId/course-progress')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Tiến độ học tập của một sinh viên trong lớp' })
    studentProgress(
        @Param('classPublicId') classPublicId: string,
        @Param('studentPublicId') studentPublicId: string,
        @CurrentUser() user: JwtPayload
    ) {
        return this.courseProgressService.studentProgress(classPublicId, studentPublicId, user.sub);
    }
}
