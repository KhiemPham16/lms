import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
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
    @ApiOperation({ summary: 'Tao lop hoc cho mon da duyet' })
    create(@Body() dto: CreateClassWithCourseDto, @CurrentUser() user: JwtPayload) {
        const { coursePublicId, ...classDto } = dto;

        return this.classesService.create(coursePublicId, classDto, user.sub);
    }

    @Get()
    @Permissions('classes.read')
    @ApiOperation({ summary: 'Danh sach lop hoc' })
    findAll(@Query() query: QueryClassDto) {
        return this.classesService.findAll(query);
    }

    @Get('my-enrollments')
    @Permissions('classes.read')
    @ApiOperation({ summary: 'Danh sach lop hoc sinh vien da dang ky' })
    findMyEnrollments(@CurrentUser() user: JwtPayload) {
        return this.classesService.findMyEnrollments(user.sub);
    }

    @Get(':publicId')
    @Permissions('classes.read')
    @ApiOperation({ summary: 'Chi tiet lop hoc' })
    findOne(@Param('publicId') publicId: string) {
        return this.classesService.findByPublicIdOrThrow(publicId);
    }

    @Patch(':publicId')
    @Permissions('classes.create')
    @ApiOperation({ summary: 'Cap nhat lop hoc' })
    update(@Param('publicId') publicId: string, @Body() dto: UpdateClassDto, @CurrentUser() user: JwtPayload) {
        return this.classesService.update(publicId, dto, user.sub);
    }

    @Patch(':publicId/lecturer')
    @Permissions('classes.assign_lecturer')
    @ApiOperation({ summary: 'Gan giang vien quan ly lop' })
    assignLecturer(
        @Param('publicId') publicId: string,
        @Body() dto: AssignLecturerDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.classesService.assignLecturer(publicId, dto, user.sub);
    }

    @Patch(':publicId/status')
    @Permissions('classes.registration.toggle')
    @ApiOperation({ summary: 'Cap nhat trang thai lop hoc' })
    updateStatus(@Param('publicId') publicId: string, @Body() dto: UpdateClassStatusDto, @CurrentUser() user: JwtPayload) {
        return this.classesService.updateStatus(publicId, dto.status, user.sub);
    }

    @Post(':publicId/enroll')
    @Permissions('enrollments.create')
    @ApiOperation({ summary: 'Sinh vien dang ky vao lop' })
    enroll(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.classesService.enroll(publicId, user.sub);
    }

    @Patch(':publicId/drop')
    @Permissions('enrollments.drop')
    @ApiOperation({ summary: 'Sinh vien huy dang ky lop' })
    drop(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.classesService.drop(publicId, user.sub);
    }
}
