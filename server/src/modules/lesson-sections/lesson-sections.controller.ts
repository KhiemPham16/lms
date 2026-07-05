import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { CreateLessonSectionDto } from './dto/create-lesson-section.dto';
import { QueryLessonSectionDto } from './dto/query-lesson-section.dto';
import { ReorderLessonSectionsDto } from './dto/reorder-lesson-sections.dto';
import { UpdateLessonSectionDto } from './dto/update-lesson-section.dto';
import { LessonSectionsService } from './lesson-sections.service';

@ApiTags('Lesson Sections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class LessonSectionsController {
    constructor(private readonly lessonSectionsService: LessonSectionsService) {}

    @Post('classes/:classPublicId/lesson-sections')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Tạo section bài học cho lớp' })
    create(
        @Param('classPublicId') classPublicId: string,
        @Body() dto: CreateLessonSectionDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.lessonSectionsService.create(classPublicId, dto, user.sub);
    }

    @Get('classes/:classPublicId/lesson-sections')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Danh sách section bài học của lớp' })
    findByClass(
        @Param('classPublicId') classPublicId: string,
        @Query() query: QueryLessonSectionDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.lessonSectionsService.findByClass(classPublicId, query, user.sub);
    }

    @Patch('classes/:classPublicId/lesson-sections/reorder')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Sắp xếp section bài học' })
    reorder(
        @Param('classPublicId') classPublicId: string,
        @Body() dto: ReorderLessonSectionsDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.lessonSectionsService.reorder(classPublicId, dto, user.sub);
    }

    @Get('lesson-sections/:publicId')
    @Permissions('lessons.read')
    @ApiOperation({ summary: 'Chi tiết section bài học' })
    findOne(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonSectionsService.findOne(publicId, user.sub);
    }

    @Patch('lesson-sections/:publicId')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Cập nhật section bài học' })
    update(@Param('publicId') publicId: string, @Body() dto: UpdateLessonSectionDto, @CurrentUser() user: JwtPayload) {
        return this.lessonSectionsService.update(publicId, dto, user.sub);
    }

    @Delete('lesson-sections/:publicId')
    @Permissions('lessons.create')
    @ApiOperation({ summary: 'Xóa section bài học' })
    remove(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.lessonSectionsService.remove(publicId, user.sub);
    }
}
