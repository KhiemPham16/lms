import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import type { Request } from 'express';

import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { PrismaService } from '~/prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

type RoleAuditActorClient = {
    user: {
        findUnique: PrismaService['user']['findUnique'];
    };
};

const defaultRoleSelect = () =>
    ({
        id: true,
        publicId: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: {
            select: {
                permission: {
                    select: {
                        id: true,
                        publicId: true,
                        code: true,
                        name: true,
                        module: true
                    }
                }
            }
        },
        _count: {
            select: {
                users: {
                    where: {
                        deletedAt: null
                    }
                }
            }
        },
        createdAt: true,
        updatedAt: true
    }) satisfies Prisma.RoleSelect;

type RoleWithDetails = Prisma.RoleGetPayload<{ select: ReturnType<typeof defaultRoleSelect> }>;
type RolePermissionDetail = RoleWithDetails['permissions'][number]['permission'];
type FormattedRole = Omit<RoleWithDetails, 'permissions'> & {
    permissions: RolePermissionDetail[];
    permissionCodes: string[];
};

@Injectable()
export class RolesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService
    ) {}

    async create(dto: CreateRoleDto) {
        const existed = await this.prisma.role.findUnique({
            where: {
                code: dto.code
            }
        });

        if (existed) {
            throw new ConflictException('Mã vai trò đã tồn tại');
        }

        const role = await this.prisma.role.create({
            data: {
                code: dto.code,
                name: dto.name,
                description: dto.description,
                isSystem: dto.isSystem ?? false
            },
            select: this.defaultSelect()
        });

        return this.formatRole(role);
    }

    async findAll() {
        const roles = await this.prisma.role.findMany({
            orderBy: {
                createdAt: 'asc'
            },
            select: this.defaultSelect()
        });

        return roles.map((role) => this.formatRole(role));
    }

    async findByPublicIdOrThrow(publicId: string) {
        const role = await this.prisma.role.findUnique({
            where: {
                publicId
            },
            select: this.defaultSelect()
        });

        if (!role) {
            throw new NotFoundException('Không tìm thấy vai trò');
        }

        return this.formatRole(role);
    }

    async update(publicId: string, dto: UpdateRoleDto) {
        const currentRole = await this.findByPublicIdOrThrow(publicId);

        if (currentRole.code === 'ADMIN') {
            throw new BadRequestException('Khong duoc sua vai tro Admin');
        }

        if (dto.code === 'ADMIN') {
            throw new BadRequestException('Khong duoc tao them hoac doi vai tro khac thanh Admin');
        }

        if (dto.code) {
            const duplicate = await this.prisma.role.findFirst({
                where: {
                    publicId: {
                        not: publicId
                    },
                    code: dto.code
                }
            });

            if (duplicate) {
                throw new ConflictException('Mã vai trò đã tồn tại');
            }
        }

        const role = await this.prisma.role.update({
            where: {
                publicId
            },
            data: {
                code: dto.code,
                name: dto.name,
                description: dto.description,
                isSystem: dto.isSystem
            },
            select: this.defaultSelect()
        });

        return this.formatRole(role);
    }

    async remove(publicId: string) {
        const role = await this.findByPublicIdOrThrow(publicId);

        if (role.isSystem) {
            throw new BadRequestException('Không thể xóa vai trò hệ thống');
        }

        const userCount = await this.prisma.user.count({
            where: {
                role: {
                    publicId
                },
                deletedAt: null
            }
        });

        if (userCount > 0) {
            throw new ConflictException('Không thể xóa vai trò đang có người dùng');
        }

        const deletedRole = await this.prisma.role.delete({
            where: {
                publicId
            },
            select: this.defaultSelect()
        });

        return this.formatRole(deletedRole);
    }

    async findPermissions() {
        const items = await this.prisma.permission.findMany({
            orderBy: [{ module: 'asc' }, { id: 'asc' }],
            select: {
                id: true,
                publicId: true,
                code: true,
                name: true,
                module: true,
                description: true
            }
        });

        const groups = items.reduce<Record<string, typeof items>>((result, permission) => {
            result[permission.module] = result[permission.module] ?? [];
            result[permission.module].push(permission);
            return result;
        }, {});

        return {
            items,
            groups
        };
    }

    async updatePermissions(publicId: string, dto: UpdateRolePermissionsDto, actorPublicId?: string, request?: Request) {
        const role = await this.findByPublicIdOrThrow(publicId);

        if (role.code === 'ADMIN') {
            throw new BadRequestException('Khong duoc sua quyen cua Admin');
        }

        const permissionCodes = dto.permissionCodes ?? [];
        const permissionIds = dto.permissionIds ?? [];

        const permissions =
            permissionCodes.length + permissionIds.length > 0
                ? await this.prisma.permission.findMany({
                      where: {
                          OR: [
                              ...(permissionCodes.length > 0 ? [{ code: { in: permissionCodes } }] : []),
                              ...(permissionIds.length > 0 ? [{ id: { in: permissionIds } }] : [])
                          ]
                      },
                      select: {
                          id: true,
                          code: true
                      }
                  })
                : [];

        if (permissionCodes.length + permissionIds.length > 0 && permissions.length === 0) {
            throw new BadRequestException('Danh sách quyền không hợp lệ');
        }

        const hasPermissionManagement = permissions.some((permission) => permission.code === 'system.permissions.manage');

        if (role.code !== 'ADMIN' && hasPermissionManagement) {
            throw new BadRequestException('Chỉ ADMIN được quản lý phân quyền');
        }

        const previousPermissionCodes = role.permissionCodes || [];
        const nextPermissionCodes = permissions.map((permission) => permission.code);
        const addedPermissionCodes = nextPermissionCodes.filter((code) => !previousPermissionCodes.includes(code));
        const removedPermissionCodes = previousPermissionCodes.filter((code) => !nextPermissionCodes.includes(code));

        await this.prisma.$transaction(async (tx) => {
            await tx.rolePermission.deleteMany({
                where: {
                    roleId: role.id
                }
            });

            if (permissions.length > 0) {
                await tx.rolePermission.createMany({
                    data: permissions.map((permission) => ({
                        roleId: role.id,
                        permissionId: permission.id
                    })),
                    skipDuplicates: true
                });
            }

            await this.auditLogsService.create(
                {
                    actorId: await this.resolveActorId(actorPublicId, tx),
                    action: AuditAction.PERMISSION_CHANGE,
                    module: 'roles',
                    targetType: 'Role',
                    targetId: role.id,
                    targetPublicId: role.publicId,
                    oldValue: {
                        roleCode: role.code,
                        roleName: role.name,
                        permissionCodes: previousPermissionCodes
                    },
                    newValue: {
                        roleCode: role.code,
                        roleName: role.name,
                        permissionCodes: nextPermissionCodes,
                        addedPermissionCodes,
                        removedPermissionCodes,
                        reason: dto.reason
                    },
                    ipAddress: this.getIpAddress(request),
                    userAgent: request?.headers['user-agent']
                },
                tx
            );
        });

        return this.findByPublicIdOrThrow(publicId);
    }

    private async resolveActorId(actorPublicId?: string, client: RoleAuditActorClient = this.prisma) {
        if (!actorPublicId) return undefined;
        const actor = await client.user.findUnique({
            where: {
                publicId: actorPublicId
            },
            select: {
                id: true
            }
        });

        return actor?.id;
    }

    private getIpAddress(request?: Request) {
        if (!request) return undefined;
        const forwardedFor = request.headers['x-forwarded-for'];
        if (Array.isArray(forwardedFor)) return forwardedFor[0];
        return forwardedFor?.split(',')[0]?.trim() || request.ip;
    }

    private defaultSelect() {
        return defaultRoleSelect();
    }

    private formatRole(role: RoleWithDetails): FormattedRole {
        const permissions = role.permissions.map((item) => item.permission);

        return {
            ...role,
            permissions,
            permissionCodes: permissions.map((permission) => permission.code)
        };
    }
}
