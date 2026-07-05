import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateExamQuestionDto } from './dto/create-exam-question.dto';
import { PublishExamDto } from './dto/publish-exam.dto';
import { QueryExamDto } from './dto/query-exam.dto';
import { SaveAttemptAnswersDto } from './dto/save-attempt-answers.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { UpdateExamQuestionDto } from './dto/update-exam-question.dto';
import { ExamsService } from './exams.service';

@ApiTags('Exams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ExamsController {
    constructor(private readonly examsService: ExamsService) {}

    @Post('classes/:classPublicId/exams')
    @Permissions('exams.create')
    @ApiOperation({ summary: 'Tạo bài kiểm tra cho lớp' })
    create(@Param('classPublicId') classPublicId: string, @Body() dto: CreateExamDto, @CurrentUser() user: JwtPayload) {
        return this.examsService.create(classPublicId, dto, user.sub);
    }

    @Get('classes/:classPublicId/exams')
    @Permissions('exams.read')
    @ApiOperation({ summary: 'Danh sách bài kiểm tra của lớp' })
    findByClass(
        @Param('classPublicId') classPublicId: string,
        @Query() query: QueryExamDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.examsService.findByClass(classPublicId, query, user.sub);
    }

    @Get('exams/:publicId')
    @Permissions('exams.read')
    @ApiOperation({ summary: 'Chi tiết bài kiểm tra' })
    findOne(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.examsService.findOne(publicId, user.sub);
    }

    @Patch('exams/:publicId')
    @Permissions('exams.create')
    @ApiOperation({ summary: 'Cập nhật bài kiểm tra' })
    update(@Param('publicId') publicId: string, @Body() dto: UpdateExamDto, @CurrentUser() user: JwtPayload) {
        return this.examsService.update(publicId, dto, user.sub);
    }

    @Delete('exams/:publicId')
    @Permissions('exams.create')
    @ApiOperation({ summary: 'Xóa bài kiểm tra chưa có lượt làm' })
    remove(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.examsService.remove(publicId, user.sub);
    }

    @Patch('exams/:publicId/publish')
    @Permissions('exams.create')
    @ApiOperation({ summary: 'Công bố hoặc ẩn bài kiểm tra' })
    publish(@Param('publicId') publicId: string, @Body() dto: PublishExamDto, @CurrentUser() user: JwtPayload) {
        return this.examsService.publish(publicId, dto.isPublished, user.sub);
    }

    @Post('exams/:publicId/questions')
    @Permissions('exams.create')
    @ApiOperation({ summary: 'Thêm câu hỏi vào bài kiểm tra' })
    createQuestion(
        @Param('publicId') publicId: string,
        @Body() dto: CreateExamQuestionDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.examsService.createQuestion(publicId, dto, user.sub);
    }

    @Patch('exam-questions/:publicId')
    @Permissions('exams.create')
    @ApiOperation({ summary: 'Cập nhật câu hỏi bài kiểm tra' })
    updateQuestion(
        @Param('publicId') publicId: string,
        @Body() dto: UpdateExamQuestionDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.examsService.updateQuestion(publicId, dto, user.sub);
    }

    @Delete('exam-questions/:publicId')
    @Permissions('exams.create')
    @ApiOperation({ summary: 'Xóa câu hỏi bài kiểm tra' })
    removeQuestion(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.examsService.removeQuestion(publicId, user.sub);
    }

    @Post('exams/:publicId/attempts/start')
    @Permissions('exams.submit')
    @ApiOperation({ summary: 'Sinh viên bắt đầu làm bài' })
    startAttempt(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.examsService.startAttempt(publicId, user.sub);
    }

    @Get('exam-attempts/:publicId')
    @Permissions('exams.read')
    @ApiOperation({ summary: 'Chi tiết lượt làm bài' })
    findAttempt(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.examsService.findAttempt(publicId, user.sub);
    }

    @Patch('exam-attempts/:publicId/answers')
    @Permissions('exams.submit')
    @ApiOperation({ summary: 'Lưu đáp án lượt làm bài' })
    saveAnswers(
        @Param('publicId') publicId: string,
        @Body() dto: SaveAttemptAnswersDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.examsService.saveAnswers(publicId, dto, user.sub);
    }

    @Post('exam-attempts/:publicId/submit')
    @Permissions('exams.submit')
    @ApiOperation({ summary: 'Nộp bài và tự chấm điểm trắc nghiệm' })
    submitAttempt(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.examsService.submitAttempt(publicId, user.sub);
    }
}
