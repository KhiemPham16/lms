import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { ApproveCourseDto } from './dto/approve-course.dto';
import { AssignCourseDepartmentHeadDto } from './dto/assign-course-department-head.dto';
import { AssignCourseLecturersDto } from './dto/assign-course-lecturers.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateCourseProposalDto } from './dto/create-course-proposal.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { UpdateCourseStatusDto } from './dto/update-course-status.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CoursesService } from './courses.service';

@ApiTags('Courses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('courses')
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) {}

    @Post()
    @Permissions('courses.update')
    @ApiOperation({ summary: 'Phong dao tao tao mon hoc da co trong giao trinh' })
    create(@Body() dto: CreateCourseDto, @CurrentUser() user: JwtPayload) {
        return this.coursesService.createOfficialCourse(dto, user.sub);
    }

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

    @Delete(':publicId')
    @Permissions('courses.update')
    @ApiOperation({ summary: 'Xóa đề xuất môn học đã bị từ chối' })
    removeRejected(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.coursesService.removeRejected(publicId, user.sub);
    }

    @Patch(':publicId/department-head')
    @Permissions('courses.update')
    @ApiOperation({ summary: 'Gán trưởng bộ môn phụ trách môn học' })
    assignDepartmentHead(
        @Param('publicId') publicId: string,
        @Body() dto: AssignCourseDepartmentHeadDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.coursesService.assignDepartmentHead(publicId, dto, user.sub);
    }

    @Patch(':publicId/lecturers')
    @Permissions('classes.assign_lecturer')
    @ApiOperation({ summary: 'Gán giảng viên vào môn học' })
    assignLecturers(
        @Param('publicId') publicId: string,
        @Body() dto: AssignCourseLecturersDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.coursesService.assignLecturers(publicId, dto, user.sub);
    }

    @Patch(':publicId/status')
    @Permissions('courses.update')
    @ApiOperation({ summary: 'Kích hoạt hoặc vô hiệu hóa môn học' })
    updateStatus(
        @Param('publicId') publicId: string,
        @Body() dto: UpdateCourseStatusDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.coursesService.updateStatus(publicId, dto.status, user.sub);
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
