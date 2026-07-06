import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { AssignClassHeadDto } from './dto/assign-class-head.dto';
import { AssignLecturerDto } from './dto/assign-lecturer.dto';
import { QueryClassDto } from './dto/query-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateClassStatusDto } from './dto/update-class-status.dto';
import { ClassesService } from './classes.service';
import { CreateClassWithCourseDto } from './dto/create-class-with-course.dto';

@ApiTags('Classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('classes')
export class ClassesController {
    constructor(private readonly classesService: ClassesService) {}

    @Post()
    @Permissions('classes.create')
    @ApiOperation({ summary: 'Tạo lớp học cho môn đã duyệt' })
    create(@Body() dto: CreateClassWithCourseDto, @CurrentUser() user: JwtPayload) {
        const { coursePublicId, ...classDto } = dto;

        return this.classesService.create(coursePublicId, classDto, user.sub);
    }

    @Get()
    @Permissions('classes.read')
    @ApiOperation({ summary: 'Danh sách lớp học' })
    findAll(@Query() query: QueryClassDto, @CurrentUser() user: JwtPayload) {
        return this.classesService.findAll(query, user.sub);
    }

    @Get('summary')
    @Permissions('classes.read')
    @ApiOperation({ summary: 'Thong ke lop hoc' })
    summary(@Query() query: QueryClassDto, @CurrentUser() user: JwtPayload) {
        return this.classesService.summary(query, user.sub);
    }

    @Get(':publicId')
    @Permissions('classes.read')
    @ApiOperation({ summary: 'Chi tiết lớp học' })
    findOne(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.classesService.findByPublicIdOrThrow(publicId, user.sub);
    }

    @Patch(':publicId')
    @Permissions('classes.create')
    @ApiOperation({ summary: 'Cập nhật lớp học' })
    update(@Param('publicId') publicId: string, @Body() dto: UpdateClassDto, @CurrentUser() user: JwtPayload) {
        return this.classesService.update(publicId, dto, user.sub);
    }

    @Delete(':publicId')
    @Permissions('classes.create')
    @ApiOperation({ summary: 'Xoa lop hoc chua phat sinh du lieu' })
    remove(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.classesService.remove(publicId, user.sub);
    }

    @Patch(':publicId/department-head')
    @Permissions('classes.create')
    @ApiOperation({ summary: 'Gan truong bo mon quan ly lop' })
    assignDepartmentHead(
        @Param('publicId') publicId: string,
        @Body() dto: AssignClassHeadDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.classesService.assignDepartmentHead(publicId, dto, user.sub);
    }

    @Patch(':publicId/lecturer')
    @Permissions('classes.assign_lecturer')
    @ApiOperation({ summary: 'Gán giảng viên quản lý lớp' })
    assignLecturer(
        @Param('publicId') publicId: string,
        @Body() dto: AssignLecturerDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.classesService.assignLecturer(publicId, dto, user.sub);
    }

    @Patch(':publicId/status')
    @Permissions('classes.registration.toggle')
    @ApiOperation({ summary: 'Cập nhật trạng thái lớp học' })
    updateStatus(
        @Param('publicId') publicId: string,
        @Body() dto: UpdateClassStatusDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.classesService.updateStatus(publicId, dto.status, user.sub);
    }
}
