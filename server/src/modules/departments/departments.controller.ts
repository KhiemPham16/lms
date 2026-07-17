import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Roles } from '~/common/decorators/roles.decorator';
import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
    constructor(private readonly departments: DepartmentsService) {}

    @Get()
    @Roles(UserRole.ADMIN, UserRole.HR, UserRole.PRINCIPAL, UserRole.TRAINING_OFFICER)
    list() {
        return this.departments.list();
    }

    @Post()
    @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TRAINING_OFFICER)
    create(@Body() dto: CreateDepartmentDto, @CurrentUser() user: JwtPayload) {
        return this.departments.create(dto, user.sub);
    }

    @Patch(':publicId')
    @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TRAINING_OFFICER)
    update(@Param('publicId') publicId: string, @Body() dto: UpdateDepartmentDto, @CurrentUser() user: JwtPayload) {
        return this.departments.update(publicId, dto, user.sub);
    }

    @Delete(':publicId')
    @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TRAINING_OFFICER)
    remove(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.departments.remove(publicId, user.sub);
    }
}
