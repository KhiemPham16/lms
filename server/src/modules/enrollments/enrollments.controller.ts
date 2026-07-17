import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Roles } from '~/common/decorators/roles.decorator';
import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { EnrollmentsService } from './enrollments.service';

@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class EnrollmentsController {
    constructor(private readonly enrollments: EnrollmentsService) {}
    @Get('available-classes') availableClasses(@CurrentUser() user: JwtPayload) { return this.enrollments.availableClasses(user.sub); }
    @Get('me') myEnrollments(@CurrentUser() user: JwtPayload) { return this.enrollments.myEnrollments(user.sub); }
    @Post() enroll(@Body() dto: CreateEnrollmentDto, @CurrentUser() user: JwtPayload) { return this.enrollments.enroll(dto, user.sub); }
    @Delete(':publicId') drop(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) { return this.enrollments.drop(publicId, user.sub); }
}
