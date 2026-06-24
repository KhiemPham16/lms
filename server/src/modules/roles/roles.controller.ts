import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { RolesService } from './roles.service';

@ApiTags('Roles & Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('system.permissions.manage')
@Controller('roles')
export class RolesController {
    constructor(private readonly rolesService: RolesService) {}

    @Post()
    @ApiOperation({ summary: 'Tạo vai trò' })
    create(@Body() dto: CreateRoleDto) {
        return this.rolesService.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'Danh sách vai trò' })
    findAll() {
        return this.rolesService.findAll();
    }

    @Get('permissions')
    @ApiOperation({ summary: 'Danh mục quyền' })
    findPermissions() {
        return this.rolesService.findPermissions();
    }

    @Get(':publicId')
    @ApiOperation({ summary: 'Chi tiết vai trò' })
    findOne(@Param('publicId') publicId: string) {
        return this.rolesService.findByPublicIdOrThrow(publicId);
    }

    @Patch(':publicId')
    @ApiOperation({ summary: 'Cập nhật vai trò' })
    update(@Param('publicId') publicId: string, @Body() dto: UpdateRoleDto) {
        return this.rolesService.update(publicId, dto);
    }

    @Put(':publicId/permissions')
    @ApiOperation({ summary: 'Cập nhật quyền của vai trò' })
    updatePermissions(
        @Param('publicId') publicId: string,
        @Body() dto: UpdateRolePermissionsDto,
        @CurrentUser() actor: JwtPayload,
        @Req() request: Request
    ) {
        return this.rolesService.updatePermissions(publicId, dto, actor.sub, request);
    }

    @Delete(':publicId')
    @ApiOperation({ summary: 'Xóa vai trò' })
    remove(@Param('publicId') publicId: string) {
        return this.rolesService.remove(publicId);
    }
}
