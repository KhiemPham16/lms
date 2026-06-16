import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import { Roles } from '~/common/decorators/roles.decorator';

import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) {}

    @Post()
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Tạo phòng ban/khoa' })
    create(@Body() dto: CreateDepartmentDto) {
        return this.departmentsService.create(dto);
    }

    @Get()
    @Roles(UserRole.ADMIN, UserRole.TRAINING_OFFICER, UserRole.PRINCIPAL)
    @ApiOperation({ summary: 'Danh sách phòng ban/khoa' })
    findAll() {
        return this.departmentsService.findAll();
    }

    @Get(':publicId')
    @Roles(UserRole.ADMIN, UserRole.TRAINING_OFFICER, UserRole.PRINCIPAL)
    @ApiOperation({ summary: 'Chi tiết phòng ban/khoa' })
    findOne(@Param('publicId') publicId: string) {
        return this.departmentsService.findByPublicIdOrThrow(publicId);
    }

    @Patch(':publicId')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Cập nhật phòng ban/khoa' })
    update(@Param('publicId') publicId: string, @Body() dto: UpdateDepartmentDto) {
        return this.departmentsService.update(publicId, dto);
    }

    @Delete(':publicId')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Xóa phòng ban/khoa' })
    remove(@Param('publicId') publicId: string) {
        return this.departmentsService.remove(publicId);
    }
}
