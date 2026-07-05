import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { SubmitCodeLessonDto } from './dto/code-lesson.dto';
import { PublishLessonDto } from './dto/publish-lesson.dto';
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

    @Post('classes/:classPublicId/lessons')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'tạo bài học cho lớp' })
    create(
        @Param('classPublicId') classPublicId: string,
        @Body() dto: CreateLessonDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.lessonsService.create(classPublicId, dto, user.sub);
    }

    @Post('lesson-sections/:sectionPublicId/lessons')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Tạo bài học trong section' })
    createInSection(
        @Param('sectionPublicId') sectionPublicId: string,
        @Body() dto: CreateLessonDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.lessonsService.createInSection(sectionPublicId, dto, user.sub);
    }

    @Get('classes/:classPublicId/lessons')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Danh sách bài học của lớp' })
    findByClass(
        @Param('classPublicId') classPublicId: string,
        @Query() query: QueryLessonDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.lessonsService.findByClass(classPublicId, query, user.sub);
    }

    @Get('classes/:classPublicId/lessons/my-progress')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Tiến độ bài học của sinh viên trong lớp' })
    myProgress(@Param('classPublicId') classPublicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.myProgress(classPublicId, user.sub);
    }

    @Get('classes/:classPublicId/lessons/progress')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Tiến độ bài học của cả lớp' })
    classProgress(@Param('classPublicId') classPublicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.classProgress(classPublicId, user.sub);
    }

    @Patch('classes/:classPublicId/lessons/reorder')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Sắp xếp lại thứ tự bài học' })
    reorder(
        @Param('classPublicId') classPublicId: string,
        @Body() dto: ReorderLessonsDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.lessonsService.reorder(classPublicId, dto, user.sub);
    }

    @Get('lessons/:publicId')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Chi tiết bài học' })
    findOne(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.findOne(publicId, user.sub);
    }

    @Patch('lessons/:publicId')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Cập nhật bài học' })
    update(@Param('publicId') publicId: string, @Body() dto: UpdateLessonDto, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.update(publicId, dto, user.sub);
    }

    @Delete('lessons/:publicId')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Xóa bài học' })
    remove(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.remove(publicId, user.sub);
    }

    @Patch('lessons/:publicId/publish')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Công bố hoặc ẩn bài học' })
    publish(@Param('publicId') publicId: string, @Body() dto: PublishLessonDto, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.publish(publicId, dto.isPublished, user.sub);
    }

    @Patch('lessons/:publicId/complete')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Đánh dấu đã hoàn thành bài học' })
    complete(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.complete(publicId, user.sub);
    }

    @Patch('lessons/:publicId/uncomplete')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Bỏ đánh dấu hoàn thành bài học' })
    uncomplete(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.uncomplete(publicId, user.sub);
    }

    @Post('lessons/:publicId/code-submissions/check')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Kiểm tra code của bài học CODE' })
    checkCode(@Param('publicId') publicId: string, @Body() dto: SubmitCodeLessonDto, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.checkCode(publicId, dto, user.sub);
    }

    @Post('lessons/:publicId/code-submissions')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Nộp code cho bài học CODE' })
    submitCode(@Param('publicId') publicId: string, @Body() dto: SubmitCodeLessonDto, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.submitCode(publicId, dto, user.sub);
    }

    @Get('lessons/:publicId/code-submissions/me')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Submission code gần nhất của tôi' })
    myCodeSubmissions(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.myCodeSubmissions(publicId, user.sub);
    }

    @Get('lessons/:publicId/code-submissions')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Danh sách submission code của bài học' })
    codeSubmissions(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonsService.codeSubmissions(publicId, user.sub);
    }
}
