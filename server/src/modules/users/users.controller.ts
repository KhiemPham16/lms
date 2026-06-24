import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { PermissionsGuard } from '~/common/guards/permissions.guard';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UserStatusActionDto } from './dto/user-status-action.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { BulkUserActionDto } from './dto/bulk-user-action.dto';
import { BulkAssignRoleDto } from './dto/bulk-assign-role.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('me')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Lấy thông tin người dùng hiện tại' })
    me(@CurrentUser() user: JwtPayload) {
        return this.usersService.findByPublicIdOrThrow(user.sub);
    }

    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.create')
    @ApiOperation({ summary: 'Tạo người dùng' })
    @ApiBody({
        type: CreateUserDto,
        examples: {
            student2022: {
                summary: 'Tạo sinh viên khóa 2022, code tự sinh 922210xxx',
                value: {
                    fullName: 'Nguyen Van A',
                    email: 'student2022@lms.com',
                    password: 'Lms@123',
                    role: 'STUDENT',
                    departmentId: 1,
                    cohortYear: 2022,
                    gender: 'MALE',
                    dateOfBirth: '2004-01-01',
                    address: 'TP. Ho Chi Minh'
                }
            },
            lecturer2026: {
                summary: 'Tạo giảng viên năm 2026, code tự sinh 932610xxx',
                value: {
                    fullName: 'Tran Thi B',
                    email: 'lecturer2026@lms.com',
                    password: 'Lms@123',
                    role: 'LECTURER',
                    departmentId: 1,
                    cohortYear: 2026,
                    gender: 'FEMALE'
                }
            },
            hr2026: {
                summary: 'Tạo HR năm 2026, code tự sinh 962610xxx',
                value: {
                    fullName: 'Le Van HR',
                    email: 'hr2026@lms.com',
                    password: 'Lms@123',
                    role: 'HR',
                    departmentId: 4,
                    cohortYear: 2026
                }
            }
        }
    })
    create(@CurrentUser() actor: JwtPayload, @Body() dto: CreateUserDto, @Req() request: Request) {
        return this.usersService.create(dto, actor.sub, request);
    }

    @Get()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.read')
    @ApiOperation({ summary: 'Danh sách người dùng' })
    findAll(@CurrentUser() actor: JwtPayload, @Query() query: QueryUserDto) {
        return this.usersService.findAll(query, actor.sub);
    }

    @Get('summary')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.read')
    @ApiOperation({ summary: 'Tong hop so lieu nguoi dung' })
    summary(@CurrentUser() actor: JwtPayload, @Query() query: QueryUserDto) {
        return this.usersService.summary(query, actor.sub);
    }

    @Get('export')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.read')
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename="users.csv"')
    @ApiOperation({ summary: 'Xuat danh sach nguoi dung CSV' })
    export(@CurrentUser() actor: JwtPayload, @Query() query: QueryUserDto) {
        return this.usersService.exportCsv(query, actor.sub);
    }

    @Post('bulk/lock')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.status')
    @ApiOperation({ summary: 'Khoa nhieu tai khoan' })
    bulkLock(@CurrentUser() actor: JwtPayload, @Body() dto: BulkUserActionDto, @Req() request: Request) {
        return this.usersService.bulkUpdateStatus(dto.userIds, UserStatus.LOCKED, actor.sub, dto, request);
    }

    @Post('bulk/unlock')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.status')
    @ApiOperation({ summary: 'Mo khoa nhieu tai khoan' })
    bulkUnlock(@CurrentUser() actor: JwtPayload, @Body() dto: BulkUserActionDto, @Req() request: Request) {
        return this.usersService.bulkUpdateStatus(dto.userIds, UserStatus.ACTIVE, actor.sub, dto, request);
    }

    @Post('bulk/assign-role')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.update')
    @ApiOperation({ summary: 'Gan vai tro nhieu nguoi dung' })
    bulkAssignRole(@CurrentUser() actor: JwtPayload, @Body() dto: BulkAssignRoleDto, @Req() request: Request) {
        return this.usersService.bulkAssignRole(dto, actor.sub, request);
    }

    @Get(':publicId')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.read')
    @ApiOperation({ summary: 'Chi tiết người dùng' })
    findOne(@Param('publicId') publicId: string) {
        return this.usersService.findByPublicIdOrThrow(publicId);
    }

    @Patch(':publicId')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.update')
    @ApiOperation({ summary: 'Cập nhật người dùng' })
    update(@Param('publicId') publicId: string, @CurrentUser() actor: JwtPayload, @Body() dto: UpdateUserDto) {
        return this.usersService.update(publicId, dto, actor.sub);
    }

    @Patch(':publicId/status')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.status')
    @ApiOperation({ summary: 'Cập nhật trạng thái người dùng' })
    updateStatus(
        @Param('publicId') publicId: string,
        @CurrentUser() actor: JwtPayload,
        @Body() dto: ChangeUserStatusDto,
        @Req() request: Request
    ) {
        return this.usersService.updateStatus(publicId, dto.status, actor.sub, dto, request);
    }

    @Patch(':publicId/role')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.update')
    @ApiOperation({ summary: 'Cap nhat vai tro nguoi dung' })
    updateRole(
        @Param('publicId') publicId: string,
        @CurrentUser() actor: JwtPayload,
        @Body() dto: UpdateUserRoleDto,
        @Req() request: Request
    ) {
        return this.usersService.updateRole(publicId, dto, actor.sub, request);
    }

    @Post(':publicId/reset-password')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.update')
    @ApiOperation({ summary: 'Admin dat lai mat khau nguoi dung' })
    resetPassword(
        @Param('publicId') publicId: string,
        @CurrentUser() actor: JwtPayload,
        @Body() dto: ResetUserPasswordDto,
        @Req() request: Request
    ) {
        return this.usersService.adminResetPassword(publicId, dto, actor.sub, request);
    }

    @Post(':publicId/resend-activation')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.update')
    @ApiOperation({ summary: 'Gui lai email kich hoat tai khoan' })
    resendActivation(@Param('publicId') publicId: string, @CurrentUser() actor: JwtPayload, @Req() request: Request) {
        return this.usersService.resendActivation(publicId, actor.sub, request);
    }

    @Get(':publicId/activities')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.read')
    @ApiOperation({ summary: 'Nhat ky hoat dong cua nguoi dung' })
    activities(@Param('publicId') publicId: string, @Query() query: QueryUserDto) {
        return this.usersService.activities(publicId, query);
    }

    @Delete(':publicId')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.update')
    @ApiOperation({ summary: 'Xóa mềm người dùng' })
    softDelete(@Param('publicId') publicId: string) {
        return this.usersService.softDelete(publicId);
    }
}
