import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { HideLessonDto } from './dto/hide-lesson.dto';
import { QueryLessonDto } from './dto/query-lesson.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonsService } from './lessons.service';

@ApiTags('Lessons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class LessonsController {
    constructor(private readonly lessonsService: LessonsService) {}

    @Get('lessons/summary')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Thong ke bai hoc' })
    summary(@Query() query: QueryLessonDto, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.summary(query, user.sub);
    }

    @Get('lessons')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Danh sach bai hoc' })
    findAll(@Query() query: QueryLessonDto, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.findAll(query, user.sub);
    }

    @Post('lessons')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Tao bai hoc' })
    create(@Body() dto: CreateLessonDto, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.create(dto, user.sub);
    }

    @Post('lessons/reorder')
    @Permissions('lessons.update')
    @ApiOperation({ summary: 'Sap xep bai hoc trong lop' })
    reorder(@Body() dto: ReorderLessonsDto, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.reorder(dto, user.sub);
    }

    @Get('lessons/:publicId')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Chi tiet bai hoc' })
    findOne(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.findOne(publicId, user.sub);
    }

    @Patch('lessons/:publicId')
    @Permissions('lessons.update')
    @ApiOperation({ summary: 'Cap nhat bai hoc' })
    update(@Param('publicId') publicId: string, @Body() dto: UpdateLessonDto, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.update(publicId, dto, user.sub);
    }

    @Post('lessons/:publicId/duplicate')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Sao chep bai hoc' })
    duplicate(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.duplicate(publicId, user.sub);
    }

    @Patch('lessons/:publicId/publish')
    @Permissions('lessons.publish')
    @ApiOperation({ summary: 'Xuat ban bai hoc' })
    publish(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.publish(publicId, user.sub);
    }

    @Patch('lessons/:publicId/hide')
    @Permissions('lessons.publish')
    @ApiOperation({ summary: 'An bai hoc' })
    hide(@Param('publicId') publicId: string, @Body() dto: HideLessonDto, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.hide(publicId, dto, user.sub);
    }

    @Patch('lessons/:publicId/archive')
    @Permissions('lessons.update')
    @ApiOperation({ summary: 'Luu tru bai hoc' })
    archive(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.archive(publicId, user.sub);
    }

    @Delete('lessons/:publicId')
    @Permissions('lessons.delete')
    @ApiOperation({ summary: 'Xoa bai hoc' })
    remove(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.remove(publicId, user.sub);
    }

    @Get('student/classes/:classId/lessons')
    @Permissions('lessons.read')
    findStudentClassLessons(@Param('classId') classId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.findStudentClassLessons(classId, user.sub);
    }

    @Get('student/lessons/:publicId')
    @Permissions('lessons.read')
    findStudentLesson(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.findStudentLesson(publicId, user.sub);
    }

    @Post('student/lessons/:publicId/start')
    @Permissions('lessons.read')
    startStudentLesson(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.startStudentLesson(publicId, user.sub);
    }

    @Post('student/lessons/:publicId/complete')
    @Permissions('lessons.read')
    completeStudentLesson(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.completeStudentLesson(publicId, user.sub);
    }
}
