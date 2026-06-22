import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '~/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateUserDto) {
        const roleId = await this.resolveRoleId(dto.roleId, dto.role);

        const existedUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ code: dto.code }, { email: dto.email }, ...(dto.phone ? [{ phone: dto.phone }] : [])]
            }
        });

        if (existedUser) {
            throw new ConflictException('Mã người dùng, email hoặc số điện thoại đã tồn tại');
        }

        const password = await bcrypt.hash(dto.password ?? '123456', 10);

        const user = await this.prisma.user.create({
            data: {
                code: dto.code,
                fullName: dto.fullName,
                email: dto.email,
                phone: dto.phone,
                password,
                roleId,
                status: dto.status ?? UserStatus.ACTIVE,
                gender: dto.gender,
                avatarUrl: dto.avatarUrl,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                address: dto.address,
                departmentId: dto.departmentId
            },
            select: this.defaultSelect()
        });

        return this.formatUser(user);
    }

    async findAll(query: QueryUserDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const where = {
            deletedAt: null,
            ...(query.keyword
                ? {
                      OR: [
                          {
                              fullName: {
                                  contains: query.keyword
                              }
                          },
                          {
                              email: {
                                  contains: query.keyword
                              }
                          },
                          {
                              code: {
                                  contains: query.keyword
                              }
                          }
                      ]
                  }
                : {}),
            ...(query.role ? { role: { code: query.role } } : {}),
            ...(query.roleId ? { roleId: query.roleId } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.departmentId ? { departmentId: query.departmentId } : {})
        };

        const [items, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: 'desc'
                },
                select: this.defaultSelect()
            }),
            this.prisma.user.count({ where })
        ]);

        return {
            items: items.map((user) => this.formatUser(user)),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async findByPublicIdOrThrow(publicId: string) {
        const user = await this.prisma.user.findFirst({
            where: {
                publicId,
                deletedAt: null
            },
            select: this.defaultSelect()
        });

        if (!user) {
            throw new NotFoundException('Không tìm thấy người dùng');
        }

        return this.formatUser(user);
    }

    findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: {
                email
            },
            include: {
                role: true
            }
        });
    }

    findByPublicIdRaw(publicId: string) {
        return this.prisma.user.findUnique({
            where: {
                publicId
            },
            include: {
                role: true
            }
        });
    }

    updateLastLogin(userId: number) {
        return this.prisma.user.update({
            where: {
                id: userId
            },
            data: {
                lastLoginAt: new Date()
            }
        });
    }

    async update(publicId: string, dto: UpdateUserDto) {
        await this.findByPublicIdOrThrow(publicId);
        const roleId = dto.roleId || dto.role ? await this.resolveRoleId(dto.roleId, dto.role) : undefined;

        const duplicateFilters = [
            ...(dto.code ? [{ code: dto.code }] : []),
            ...(dto.email ? [{ email: dto.email }] : []),
            ...(dto.phone ? [{ phone: dto.phone }] : [])
        ];

        const duplicateUser =
            duplicateFilters.length > 0
                ? await this.prisma.user.findFirst({
                      where: {
                          publicId: {
                              not: publicId
                          },
                          OR: duplicateFilters
                      }
                  })
                : null;

        if (duplicateUser) {
            throw new ConflictException('Mã người dùng, email hoặc số điện thoại đã tồn tại');
        }

        const user = await this.prisma.user.update({
            where: {
                publicId
            },
            data: {
                code: dto.code,
                fullName: dto.fullName,
                email: dto.email,
                phone: dto.phone,
                roleId,
                status: dto.status,
                gender: dto.gender,
                avatarUrl: dto.avatarUrl,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                address: dto.address,
                departmentId: dto.departmentId
            },
            select: this.defaultSelect()
        });

        return this.formatUser(user);
    }

    async softDelete(publicId: string) {
        const user = await this.findByPublicIdOrThrow(publicId);

        if (user.status === UserStatus.LOCKED) {
            throw new BadRequestException('Tài khoản đã bị khóa');
        }

        const updatedUser = await this.prisma.user.update({
            where: {
                publicId
            },
            data: {
                deletedAt: new Date(),
                status: UserStatus.INACTIVE
            },
            select: this.defaultSelect()
        });

        return this.formatUser(updatedUser);
    }

    async updateStatus(publicId: string, status: UserStatus) {
        await this.findByPublicIdOrThrow(publicId);

        const user = await this.prisma.user.update({
            where: {
                publicId
            },
            data: {
                status
            },
            select: this.defaultSelect()
        });

        return this.formatUser(user);
    }

    updateResetPasswordOtp(userId: number, otp: string, expiresAt: Date) {
        return this.prisma.user.update({
            where: {
                id: userId
            },
            data: {
                resetPasswordOtp: otp,
                resetPasswordOtpExpiresAt: expiresAt
            }
        });
    }

    clearResetPasswordOtp(userId: number) {
        return this.prisma.user.update({
            where: {
                id: userId
            },
            data: {
                resetPasswordOtp: null,
                resetPasswordOtpExpiresAt: null
            }
        });
    }

    updatePassword(userId: number, password: string) {
        return this.prisma.user.update({
            where: {
                id: userId
            },
            data: {
                password
            }
        });
    }

    createSession(userId: number, refreshToken: string, expiresAt: Date) {
        return this.prisma.session.create({
            data: {
                userId,
                refreshToken,
                expiresAt
            }
        });
    }

    findActiveSessionsByUserId(userId: number) {
        return this.prisma.session.findMany({
            where: {
                userId,
                expiresAt: {
                    gt: new Date()
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    deleteSession(sessionId: number) {
        return this.prisma.session.delete({
            where: {
                id: sessionId
            }
        });
    }

    private defaultSelect() {
        return {
            publicId: true,
            code: true,
            fullName: true,
            email: true,
            phone: true,
            roleId: true,
            role: {
                select: {
                    publicId: true,
                    code: true,
                    name: true,
                    permissions: {
                        select: {
                            permission: {
                                select: {
                                    code: true,
                                    name: true,
                                    module: true
                                }
                            }
                        }
                    }
                }
            },
            status: true,
            gender: true,
            avatarUrl: true,
            dateOfBirth: true,
            address: true,
            departmentId: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true
        };
    }

    private async resolveRoleId(roleId?: number, roleCode?: string) {
        const role = await this.prisma.role.findFirst({
            where: roleId ? { id: roleId } : { code: roleCode ?? 'STUDENT' }
        });

        if (!role) {
            throw new BadRequestException('Vai trò không hợp lệ');
        }

        return role.id;
    }

    private formatUser(user: any) {
        const { role, ...rest } = user;
        const permissions = role?.permissions?.map((item) => item.permission) ?? [];
        const roleDetail = role
            ? {
                  publicId: role.publicId,
                  code: role.code,
                  name: role.name,
                  permissions,
                  permissionCodes: permissions.map((permission) => permission.code)
              }
            : null;

        return {
            ...rest,
            role: role?.code,
            roleDetail,
            permissions,
            permissionCodes: permissions.map((permission) => permission.code)
        };
    }
}
