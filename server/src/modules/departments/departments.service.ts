import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '~/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService
    ) {}

    async list() {
        const departments = await this.prisma.department.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: {
                        users: true,
                        subjects: true,
                        subjectProposals: true,
                        classes: true
                    }
                }
            }
        });
        return departments.map((department) => ({
            ...department,
            canDelete: Object.values(department._count).every((count) => count === 0)
        }));
    }

    async create(dto: CreateDepartmentDto, actorPublicId: string) {
        const code = dto.code.trim().toUpperCase();
        const duplicate = await this.prisma.department.findFirst({
            where: { OR: [{ code }, { name: dto.name.trim() }] }
        });
        if (duplicate) throw new ConflictException('Mã hoặc tên phòng ban đã tồn tại');
        const department = await this.prisma.department.create({ data: { ...dto, code, name: dto.name.trim() } });
        await this.audit.record({
            actorPublicId,
            action: AuditAction.CREATE,
            module: 'phong-ban',
            targetType: 'Department',
            targetPublicId: department.publicId,
            newValue: { code: department.code, name: department.name }
        });
        return department;
    }

    async update(publicId: string, dto: UpdateDepartmentDto, actorPublicId: string) {
        const current = await this.prisma.department.findUnique({ where: { publicId } });
        if (!current) throw new NotFoundException('Không tìm thấy phòng ban');
        const department = await this.prisma.department.update({
            where: { publicId },
            data: { ...dto, code: dto.code?.trim().toUpperCase(), name: dto.name?.trim() }
        });
        await this.audit.record({
            actorPublicId,
            action: AuditAction.UPDATE,
            module: 'phong-ban',
            targetType: 'Department',
            targetPublicId: publicId,
            oldValue: { code: current.code, name: current.name, isActive: current.isActive },
            newValue: { code: department.code, name: department.name, isActive: department.isActive }
        });
        return department;
    }

    async remove(publicId: string, actorPublicId: string) {
        const current = await this.prisma.department.findUnique({
            where: { publicId },
            include: {
                _count: {
                    select: {
                        users: true,
                        subjects: true,
                        subjectProposals: true,
                        classes: true
                    }
                }
            }
        });
        if (!current) throw new NotFoundException('Không tìm thấy phòng ban');

        const relatedData = Object.entries(current._count)
            .filter(([, count]) => count > 0)
            .map(([relation]) => relation);
        if (relatedData.length) {
            throw new ConflictException(`Không thể xóa phòng ban đang có dữ liệu liên quan: ${relatedData.join(', ')}`);
        }

        await this.prisma.department.delete({ where: { publicId } });
        await this.audit.record({
            actorPublicId,
            action: AuditAction.DELETE,
            module: 'phong-ban',
            targetType: 'Department',
            targetPublicId: publicId,
            oldValue: { code: current.code, name: current.name, isActive: current.isActive }
        });
        return { message: 'Xóa phòng ban thành công' };
    }
}
