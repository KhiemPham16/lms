import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { ApproveCourseDto } from './dto/approve-course.dto';
import { CreateCourseProposalDto } from './dto/create-course-proposal.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CoursesService } from './courses.service';

@ApiTags('Courses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('courses')
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) {}

    @Post('proposals')
    @Permissions('course_proposals.create')
    @ApiOperation({ summary: 'Trưởng bộ môn đề xuất môn học mới' })
    createProposal(@Body() dto: CreateCourseProposalDto, @CurrentUser() user: JwtPayload) {
        return this.coursesService.createProposal(dto, user.sub);
    }

    @Get()
    @Permissions('courses.read')
    @ApiOperation({ summary: 'Danh sách môn học' })
    findAll(@Query() query: QueryCourseDto) {
        return this.coursesService.findAll(query);
    }

    @Get(':publicId')
    @Permissions('courses.read')
    @ApiOperation({ summary: 'Chi tiết môn học' })
    findOne(@Param('publicId') publicId: string) {
        return this.coursesService.findByPublicIdOrThrow(publicId);
    }

    @Patch(':publicId')
    @Permissions('courses.update')
    @ApiOperation({ summary: 'Cập nhật môn học đang đề xuất' })
    update(@Param('publicId') publicId: string, @Body() dto: UpdateCourseDto, @CurrentUser() user: JwtPayload) {
        return this.coursesService.update(publicId, dto, user.sub);
    }

    @Patch(':publicId/pdt-decision')
    @Permissions('course_proposals.approve')
    @ApiOperation({ summary: 'Phòng đào tạo duyệt đề xuất môn học' })
    decideByTrainingOffice(
        @Param('publicId') publicId: string,
        @Body() dto: ApproveCourseDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.coursesService.decideByTrainingOffice(publicId, dto, user.sub);
    }

    @Patch(':publicId/principal-decision')
    @Permissions('course_proposals.approve')
    @ApiOperation({ summary: 'Hiệu trưởng duyệt đề xuất môn học' })
    decideByPrincipal(
        @Param('publicId') publicId: string,
        @Body() dto: ApproveCourseDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.coursesService.decideByPrincipal(publicId, dto, user.sub);
    }
}
