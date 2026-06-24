import { Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('Enrollments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('enrollments')
export class EnrollmentsController {
    constructor(private readonly enrollmentsService: EnrollmentsService) {}

    @Get('my')
    @Permissions('enrollments.read')
    @ApiOperation({ summary: 'Danh sách lớp học sinh viên đã đăng ký' })
    findMyEnrollments(@CurrentUser() user: JwtPayload) {
        return this.enrollmentsService.findMyEnrollments(user.sub);
    }

    @Post('classes/:classPublicId')
    @Permissions('enrollments.create')
    @ApiOperation({ summary: 'Sinh viên đăng ký vào lớp' })
    enroll(@Param('classPublicId') classPublicId: string, @CurrentUser() user: JwtPayload) {
        return this.enrollmentsService.enroll(classPublicId, user.sub);
    }

    @Patch('classes/:classPublicId/drop')
    @Permissions('enrollments.drop')
    @ApiOperation({ summary: 'Sinh viên hủy đăng ký lớp' })
    drop(@Param('classPublicId') classPublicId: string, @CurrentUser() user: JwtPayload) {
        return this.enrollmentsService.drop(classPublicId, user.sub);
    }
}
