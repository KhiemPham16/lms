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
        const existedUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ code: dto.code }, { email: dto.email }, ...(dto.phone ? [{ phone: dto.phone }] : [])]
            }
        });

        if (existedUser) {
            throw new ConflictException('Mã người dùng, email hoặc số điện thoại đã tồn tại');
        }

        const password = await bcrypt.hash(dto.password ?? '123456', 10);

        return this.prisma.user.create({
            data: {
                code: dto.code,
                fullName: dto.fullName,
                email: dto.email,
                phone: dto.phone,
                password,
                role: dto.role,
                status: dto.status ?? UserStatus.ACTIVE,
                gender: dto.gender,
                avatarUrl: dto.avatarUrl,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                address: dto.address,
                departmentId: dto.departmentId
            },
            select: this.defaultSelect()
        });
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
            ...(query.role ? { role: query.role } : {}),
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
            items,
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

        return user;
    }

    findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: {
                email
            }
        });
    }

    findByPublicIdRaw(publicId: string) {
        return this.prisma.user.findUnique({
            where: {
                publicId
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

        const duplicateUser = await this.prisma.user.findFirst({
            where: {
                publicId: {
                    not: publicId
                },
                OR: [
                    ...(dto.code ? [{ code: dto.code }] : []),
                    ...(dto.email ? [{ email: dto.email }] : []),
                    ...(dto.phone ? [{ phone: dto.phone }] : [])
                ]
            }
        });

        if (duplicateUser) {
            throw new ConflictException('Mã người dùng, email hoặc số điện thoại đã tồn tại');
        }

        return this.prisma.user.update({
            where: {
                publicId
            },
            data: {
                code: dto.code,
                fullName: dto.fullName,
                email: dto.email,
                phone: dto.phone,
                role: dto.role,
                status: dto.status,
                gender: dto.gender,
                avatarUrl: dto.avatarUrl,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                address: dto.address,
                departmentId: dto.departmentId
            },
            select: this.defaultSelect()
        });
    }

    async softDelete(publicId: string) {
        const user = await this.findByPublicIdOrThrow(publicId);

        if (user.status === UserStatus.LOCKED) {
            throw new BadRequestException('Tài khoản đã bị khóa');
        }

        return this.prisma.user.update({
            where: {
                publicId
            },
            data: {
                deletedAt: new Date(),
                status: UserStatus.INACTIVE
            },
            select: this.defaultSelect()
        });
    }

    async updateStatus(publicId: string, status: UserStatus) {
        await this.findByPublicIdOrThrow(publicId);

        return this.prisma.user.update({
            where: {
                publicId
            },
            data: {
                status
            },
            select: this.defaultSelect()
        });
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
            role: true,
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
}
