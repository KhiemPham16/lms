import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Roles } from '~/common/decorators/roles.decorator';
import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import { AcademicsService } from './academics.service';
import { AddPrerequisiteDto, CreateClassProposalDto, CreateSubjectProposalDto, CreateSubjectRestoreRequestDto, ReviewProposalDto, UpdateClassDto, UpdateSubjectStatusDto } from './dto/academics.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicsController {
    constructor(private readonly academics: AcademicsService) {}
    @Get('subjects') listSubjects(@CurrentUser() actor: JwtPayload) { return this.academics.listSubjects(actor); }
    @Patch('subjects/:publicId/status') @Roles(UserRole.TRAINING_OFFICER)
    updateSubjectStatus(@Param('publicId') id: string, @Body() dto: UpdateSubjectStatusDto, @CurrentUser() actor: JwtPayload) { return this.academics.updateSubjectStatus(id, dto.status, actor.sub); }
    @Delete('subjects/:publicId') @Roles(UserRole.TRAINING_OFFICER)
    removeSubject(@Param('publicId') id: string, @CurrentUser() actor: JwtPayload) { return this.academics.removeSubject(id, actor.sub); }
    @Get('subject-restore-requests') @Roles(UserRole.TRAINING_OFFICER, UserRole.PRINCIPAL)
    listSubjectRestoreRequests() { return this.academics.listSubjectRestoreRequests(); }
    @Post('subjects/:publicId/restore-requests') @Roles(UserRole.TRAINING_OFFICER)
    createSubjectRestoreRequest(@Param('publicId') id: string, @Body() dto: CreateSubjectRestoreRequestDto, @CurrentUser() actor: JwtPayload) { return this.academics.createSubjectRestoreRequest(id, dto, actor.sub); }
    @Post('subject-restore-requests/:publicId/review') @Roles(UserRole.PRINCIPAL)
    reviewSubjectRestoreRequest(@Param('publicId') id: string, @Body() dto: ReviewProposalDto, @CurrentUser() actor: JwtPayload) { return this.academics.reviewSubjectRestoreRequest(id, dto, actor.sub); }
    @Get('subject-proposals') @Roles(UserRole.ADMIN, UserRole.DEPARTMENT_HEAD, UserRole.TRAINING_OFFICER, UserRole.PRINCIPAL)
    listSubjectProposals() { return this.academics.listSubjectProposals(); }
    @Post('subject-proposals') @Roles(UserRole.DEPARTMENT_HEAD)
    createSubjectProposal(@Body() dto: CreateSubjectProposalDto, @CurrentUser() actor: JwtPayload) { return this.academics.createSubjectProposal(dto, actor.sub); }
    @Patch('subject-proposals/:publicId') @Roles(UserRole.DEPARTMENT_HEAD)
    updateSubjectProposal(@Param('publicId') id: string, @Body() dto: CreateSubjectProposalDto, @CurrentUser() actor: JwtPayload) { return this.academics.updateSubjectProposal(id, dto, actor.sub); }
    @Delete('subject-proposals/:publicId') @Roles(UserRole.DEPARTMENT_HEAD)
    removeSubjectProposal(@Param('publicId') id: string, @CurrentUser() actor: JwtPayload) { return this.academics.removeSubjectProposal(id, actor.sub); }
    @Post('subject-proposals/:publicId/resubmit') @Roles(UserRole.DEPARTMENT_HEAD)
    resubmitSubjectProposal(@Param('publicId') id: string, @CurrentUser() actor: JwtPayload) { return this.academics.resubmitSubjectProposal(id, actor.sub); }
    @Post('subject-proposals/:publicId/submit') @Roles(UserRole.DEPARTMENT_HEAD)
    submitSubjectProposal(@Param('publicId') id: string, @CurrentUser() actor: JwtPayload) { return this.academics.submitSubjectProposal(id, actor.sub); }
    @Post('subject-proposals/:publicId/training-review') @Roles(UserRole.TRAINING_OFFICER)
    trainingReviewSubject(@Param('publicId') id: string, @Body() dto: ReviewProposalDto, @CurrentUser() actor: JwtPayload) { return this.academics.trainingReviewSubject(id, dto, actor.sub); }
    @Post('subject-proposals/:publicId/principal-review') @Roles(UserRole.PRINCIPAL)
    principalReviewSubject(@Param('publicId') id: string, @Body() dto: ReviewProposalDto, @CurrentUser() actor: JwtPayload) { return this.academics.principalReviewSubject(id, dto, actor.sub); }
    @Post('subjects/:publicId/prerequisites') @Roles(UserRole.TRAINING_OFFICER)
    addPrerequisite(@Param('publicId') id: string, @Body() dto: AddPrerequisiteDto, @CurrentUser() actor: JwtPayload) { return this.academics.addPrerequisite(id, dto, actor.sub); }
    @Get('class-proposals') @Roles(UserRole.DEPARTMENT_HEAD, UserRole.TRAINING_OFFICER)
    listClassProposals(@CurrentUser() actor: JwtPayload) { return this.academics.listClassProposals(actor); }
    @Post('class-proposals') @Roles(UserRole.DEPARTMENT_HEAD)
    createClassProposal(@Body() dto: CreateClassProposalDto, @CurrentUser() actor: JwtPayload) { return this.academics.createClassProposal(dto, actor.sub); }
    @Post('class-proposals/:publicId/review') @Roles(UserRole.TRAINING_OFFICER)
    reviewClassProposal(@Param('publicId') id: string, @Body() dto: ReviewProposalDto, @CurrentUser() actor: JwtPayload) { return this.academics.reviewClassProposal(id, dto, actor.sub); }
    @Get('classes') listClasses(@CurrentUser() actor: JwtPayload) { return this.academics.listClasses(actor); }
    @Patch('classes/:publicId') @Roles(UserRole.TRAINING_OFFICER, UserRole.DEPARTMENT_HEAD)
    updateClass(@Param('publicId') id: string, @Body() dto: UpdateClassDto, @CurrentUser() actor: JwtPayload) { return this.academics.updateClass(id, dto, actor); }
}
