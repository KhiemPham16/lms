import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '~/prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateDepartmentDto) {
        const existed = await this.prisma.department.findFirst({
            where: {
                OR: [{ code: dto.code }, { name: dto.name }]
            }
        });

        if (existed) {
            throw new ConflictException('Mã hoặc tên phòng ban đã tồn tại');
        }

        return this.prisma.department.create({
            data: {
                code: dto.code,
                name: dto.name
            },
            select: this.defaultSelect()
        });
    }

    findAll() {
        return this.prisma.department.findMany({
            select: this.defaultSelect(),
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async findByPublicIdOrThrow(publicId: string) {
        const department = await this.prisma.department.findUnique({
            where: { publicId },
            select: this.defaultSelect()
        });

        if (!department) {
            throw new NotFoundException('Không tìm thấy phòng ban');
        }

        return department;
    }

    async update(publicId: string, dto: UpdateDepartmentDto) {
        await this.findByPublicIdOrThrow(publicId);

        const duplicate = await this.prisma.department.findFirst({
            where: {
                publicId: {
                    not: publicId
                },
                OR: [...(dto.code ? [{ code: dto.code }] : []), ...(dto.name ? [{ name: dto.name }] : [])]
            }
        });

        if (duplicate) {
            throw new ConflictException('Mã hoặc tên phòng ban đã tồn tại');
        }

        return this.prisma.department.update({
            where: { publicId },
            data: {
                code: dto.code,
                name: dto.name
            },
            select: this.defaultSelect()
        });
    }

    async remove(publicId: string) {
        await this.findByPublicIdOrThrow(publicId);

        const userCount = await this.prisma.user.count({
            where: {
                department: {
                    publicId
                },
                deletedAt: null
            }
        });

        const courseCount = await this.prisma.course.count({
            where: {
                department: {
                    publicId
                }
            }
        });

        if (userCount > 0 || courseCount > 0) {
            throw new ConflictException('Không thể xóa phòng ban đang có người dùng hoặc môn học');
        }

        return this.prisma.department.delete({
            where: { publicId },
            select: this.defaultSelect()
        });
    }

    private defaultSelect() {
        return {
            id: true,
            publicId: true,
            code: true,
            name: true,
            createdAt: true,
            updatedAt: true
        };
    }
}
