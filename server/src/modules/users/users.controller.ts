import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Roles } from '~/common/decorators/roles.decorator';
import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { ChangeStudentStatusDto } from './dto/change-student-status.dto';
import { ChangeEmploymentStatusDto } from './dto/change-employment-status.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.HR)
export class UsersController {
    constructor(private readonly users: UsersService) {}
    @Get()
    @Roles(UserRole.ADMIN, UserRole.HR, UserRole.DEPARTMENT_HEAD)
    list(@Query() query: QueryUserDto, @CurrentUser() actor: JwtPayload) {
        return this.users.list(query, actor);
    }
    @Get(':publicId') findOne(@Param('publicId') publicId: string, @CurrentUser() actor: JwtPayload) {
        return this.users.findOne(publicId, actor.role);
    }
    @Post() create(@Body() dto: CreateUserDto, @CurrentUser() actor: JwtPayload) {
        return this.users.create(dto, actor);
    }
    @Patch(':publicId') update(
        @Param('publicId') publicId: string,
        @Body() dto: UpdateUserDto,
        @CurrentUser() actor: JwtPayload
    ) {
        return this.users.update(publicId, dto, actor);
    }
    @Patch(':publicId/status') changeStatus(
        @Param('publicId') publicId: string,
        @Body() dto: ChangeUserStatusDto,
        @CurrentUser() actor: JwtPayload
    ) {
        return this.users.changeStatus(publicId, dto.status, actor);
    }
    @Patch(':publicId/student-status')
    changeStudentStatus(
        @Param('publicId') publicId: string,
        @Body() dto: ChangeStudentStatusDto,
        @CurrentUser() actor: JwtPayload
    ) {
        return this.users.changeStudentStatus(publicId, dto.status, actor);
    }
    @Patch(':publicId/employment-status')
    changeEmploymentStatus(
        @Param('publicId') publicId: string,
        @Body() dto: ChangeEmploymentStatusDto,
        @CurrentUser() actor: JwtPayload
    ) {
        return this.users.changeEmploymentStatus(publicId, dto.status, actor);
    }
    @Patch(':publicId/reset-password')
    @Roles(UserRole.ADMIN, UserRole.HR, UserRole.PRINCIPAL)
    resetPassword(@Param('publicId') publicId: string, @CurrentUser() actor: JwtPayload) {
        return this.users.resetPassword(publicId, actor);
    }
    @Delete(':publicId')
    remove(@Param('publicId') publicId: string, @CurrentUser() actor: JwtPayload) {
        return this.users.remove(publicId, actor);
    }
}
