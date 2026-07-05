import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { GradebookService } from './gradebook.service';

@ApiTags('Gradebook')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class GradebookController {
    constructor(private readonly gradebookService: GradebookService) {}

    @Get('classes/:classPublicId/gradebook')
    @Permissions('grades.read')
    @ApiOperation({ summary: 'Bang diem cua lop' })
    classGradebook(@Param('classPublicId') classPublicId: string, @CurrentUser() user: JwtPayload) {
        return this.gradebookService.classGradebook(classPublicId, user.sub);
    }

    @Get('classes/:classPublicId/students/:studentPublicId/grades')
    @Permissions('grades.read')
    @ApiOperation({ summary: 'Diem cua sinh vien trong lop' })
    studentClassGrades(
        @Param('classPublicId') classPublicId: string,
        @Param('studentPublicId') studentPublicId: string,
        @CurrentUser() user: JwtPayload
    ) {
        return this.gradebookService.studentClassGrades(classPublicId, studentPublicId, user.sub);
    }

    @Get('students/me/grades')
    @Permissions('grades.read')
    @ApiOperation({ summary: 'Bang diem ca nhan cua sinh vien' })
    myGrades(@CurrentUser() user: JwtPayload) {
        return this.gradebookService.myGrades(user.sub);
    }

    @Post('classes/:classPublicId/grades/recalculate')
    @Permissions('grades.calculate')
    @ApiOperation({ summary: 'Tinh lai bang diem lop' })
    recalculateClass(@Param('classPublicId') classPublicId: string, @CurrentUser() user: JwtPayload) {
        return this.gradebookService.recalculateClass(classPublicId, user.sub);
    }
}
