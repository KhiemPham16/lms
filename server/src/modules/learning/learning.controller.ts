import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Roles } from '~/common/decorators/roles.decorator';
import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import {
    CreateAssessmentDto,
    CreateLessonDto,
    CreateQuestionDto,
    CreateSectionDto,
    GradeAnswerDto,
    PublishContentDto,
    ReplaceAssessmentQuestionsDto,
    RecordViolationDto,
    ReorderContentDto,
    SaveAnswerDto,
    UpdateLessonDto,
    UpdateSectionDto,
    UpdateAssessmentDto
} from './dto/learning.dto';
import { LearningService } from './learning.service';

@Controller('learning')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LearningController {
    constructor(private readonly learning: LearningService) {}
    @Get('judge0/languages') supportedLanguages() {
        return this.learning.supportedLanguages();
    }
    @Get('classes/:publicId/assessments') classAssessments(
        @Param('publicId') id: string,
        @CurrentUser() user: JwtPayload
    ) {
        return this.learning.classAssessments(id, user);
    }
    @Get('assessments/:publicId/attempts')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    assessmentAttempts(@Param('publicId') id: string, @CurrentUser() user: JwtPayload) {
        return this.learning.assessmentAttempts(id, user.sub);
    }
    @Get('assessments/:publicId')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    assessmentDetail(@Param('publicId') id: string, @CurrentUser() user: JwtPayload) {
        return this.learning.assessmentDetail(id, user.sub);
    }
    @Get('attempts/:publicId/result')
    @Roles(UserRole.STUDENT)
    attemptResult(@Param('publicId') id: string, @CurrentUser() user: JwtPayload) {
        return this.learning.attemptResult(id, user.sub);
    }
    @Get('classes/:publicId/content') classContent(@Param('publicId') id: string, @CurrentUser() user: JwtPayload) {
        return this.learning.classContent(id, user);
    }
    @Post('sections')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    createSection(@Body() dto: CreateSectionDto, @CurrentUser() user: JwtPayload) {
        return this.learning.createSection(dto, user.sub);
    }
    @Patch('sections/:publicId')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    updateSection(@Param('publicId') id: string, @Body() dto: UpdateSectionDto, @CurrentUser() user: JwtPayload) {
        return this.learning.updateSection(id, dto, user.sub);
    }
    @Patch('sections/:publicId/publish')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    publishSection(@Param('publicId') id: string, @Body() dto: PublishContentDto, @CurrentUser() user: JwtPayload) {
        return this.learning.updateSection(id, dto, user.sub);
    }
    @Delete('sections/:publicId')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    deleteSection(@Param('publicId') id: string, @CurrentUser() user: JwtPayload) {
        return this.learning.deleteSection(id, user.sub);
    }
    @Post('lessons')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    createLesson(@Body() dto: CreateLessonDto, @CurrentUser() user: JwtPayload) {
        return this.learning.createLesson(dto, user.sub);
    }
    @Patch('lessons/:publicId')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    updateLesson(@Param('publicId') id: string, @Body() dto: UpdateLessonDto, @CurrentUser() user: JwtPayload) {
        return this.learning.updateLesson(id, dto, user.sub);
    }
    @Patch('lessons/:publicId/publish')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    publishLesson(@Param('publicId') id: string, @Body() dto: PublishContentDto, @CurrentUser() user: JwtPayload) {
        return this.learning.updateLesson(id, dto, user.sub);
    }
    @Delete('lessons/:publicId')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    deleteLesson(@Param('publicId') id: string, @CurrentUser() user: JwtPayload) {
        return this.learning.deleteLesson(id, user.sub);
    }
    @Patch('classes/:publicId/content/reorder')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    reorderContent(@Param('publicId') id: string, @Body() dto: ReorderContentDto, @CurrentUser() user: JwtPayload) {
        return this.learning.reorderContent(id, dto, user.sub);
    }
    @Patch('lessons/:publicId/complete')
    @Roles(UserRole.STUDENT)
    completeLesson(@Param('publicId') id: string, @CurrentUser() user: JwtPayload) {
        return this.learning.completeLesson(id, user.sub);
    }
    @Post('assessments')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    createAssessment(@Body() dto: CreateAssessmentDto, @CurrentUser() user: JwtPayload) {
        return this.learning.createAssessment(dto, user.sub);
    }
    @Patch('assessments/:publicId')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    updateAssessment(
        @Param('publicId') id: string,
        @Body() dto: UpdateAssessmentDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.learning.updateAssessment(id, dto, user.sub);
    }
    @Put('assessments/:publicId/questions')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    replaceAssessmentQuestions(
        @Param('publicId') id: string,
        @Body() dto: ReplaceAssessmentQuestionsDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.learning.replaceAssessmentQuestions(id, dto, user.sub);
    }
    @Patch('assessments/:publicId/publish')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    publishAssessment(@Param('publicId') id: string, @Body() dto: PublishContentDto, @CurrentUser() user: JwtPayload) {
        return this.learning.publishAssessment(id, dto.isPublished, user.sub);
    }
    @Delete('assessments/:publicId')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    deleteAssessment(@Param('publicId') id: string, @CurrentUser() user: JwtPayload) {
        return this.learning.deleteAssessment(id, user.sub);
    }
    @Post('questions')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    createQuestion(@Body() dto: CreateQuestionDto, @CurrentUser() user: JwtPayload) {
        return this.learning.createQuestion(dto, user.sub);
    }
    @Post('assessments/:publicId/start')
    @Roles(UserRole.STUDENT)
    startAttempt(@Param('publicId') id: string, @CurrentUser() user: JwtPayload) {
        return this.learning.startAttempt(id, user.sub);
    }
    @Post('attempts/:publicId/answers')
    @Roles(UserRole.STUDENT)
    saveAnswer(@Param('publicId') id: string, @Body() dto: SaveAnswerDto, @CurrentUser() user: JwtPayload) {
        return this.learning.saveAnswer(id, dto, user.sub);
    }
    @Post('attempts/:publicId/submit')
    @Roles(UserRole.STUDENT)
    submitAttempt(@Param('publicId') id: string, @CurrentUser() user: JwtPayload) {
        return this.learning.submitAttempt(id, user.sub);
    }
    @Post('attempts/:publicId/violations')
    @Roles(UserRole.STUDENT)
    recordViolation(@Param('publicId') id: string, @Body() dto: RecordViolationDto, @CurrentUser() user: JwtPayload) {
        return this.learning.recordViolation(id, dto, user.sub);
    }
    @Patch('answers/:answerId/grade')
    @Roles(UserRole.LECTURER, UserRole.DEPARTMENT_HEAD)
    gradeAnswer(@Param('answerId') answerId: string, @Body() dto: GradeAnswerDto, @CurrentUser() user: JwtPayload) {
        return this.learning.gradeAnswer(Number(answerId), dto, user.sub);
    }
}
