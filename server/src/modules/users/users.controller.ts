import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

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
                    password: '123456',
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
                    password: '123456',
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
                    password: '123456',
                    role: 'HR',
                    departmentId: 4,
                    cohortYear: 2026
                }
            }
        }
    })
    create(@Body() dto: CreateUserDto) {
        return this.usersService.create(dto);
    }

    @Get()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.read')
    @ApiOperation({ summary: 'Danh sách người dùng' })
    findAll(@Query() query: QueryUserDto) {
        return this.usersService.findAll(query);
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
    update(@Param('publicId') publicId: string, @Body() dto: UpdateUserDto) {
        return this.usersService.update(publicId, dto);
    }

    @Patch(':publicId/status')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('users.status')
    @ApiOperation({ summary: 'Cập nhật trạng thái người dùng' })
    updateStatus(@Param('publicId') publicId: string, @Body() dto: ChangeUserStatusDto) {
        return this.usersService.updateStatus(publicId, dto.status);
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
