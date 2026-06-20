import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { Permissions } from '~/common/decorators/permissions.decorator';

import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('departments')
export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) {}

    @Post()
    @Permissions('departments.create')
    @ApiOperation({ summary: 'Tạo phòng ban/khoa' })
    create(@Body() dto: CreateDepartmentDto) {
        return this.departmentsService.create(dto);
    }

    @Get()
    @Permissions('departments.read')
    @ApiOperation({ summary: 'Danh sách phòng ban/khoa' })
    findAll() {
        return this.departmentsService.findAll();
    }

    @Get(':publicId')
    @Permissions('departments.read')
    @ApiOperation({ summary: 'Chi tiết phòng ban/khoa' })
    findOne(@Param('publicId') publicId: string) {
        return this.departmentsService.findByPublicIdOrThrow(publicId);
    }

    @Patch(':publicId')
    @Permissions('departments.update')
    @ApiOperation({ summary: 'Cập nhật phòng ban/khoa' })
    update(@Param('publicId') publicId: string, @Body() dto: UpdateDepartmentDto) {
        return this.departmentsService.update(publicId, dto);
    }

    @Delete(':publicId')
    @Permissions('departments.delete')
    @ApiOperation({ summary: 'Xóa phòng ban/khoa' })
    remove(@Param('publicId') publicId: string) {
        return this.departmentsService.remove(publicId);
    }
}
