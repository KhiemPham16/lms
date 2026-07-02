import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { Request } from 'express';

import { PrismaService } from '~/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailQueueService } from '../mail/mail-queue.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UserStatusActionDto } from './dto/user-status-action.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { BulkAssignRoleDto } from './dto/bulk-assign-role.dto';

@Injectable()
export class UsersService {
    private readonly defaultPassword = 'Lms@123';
    private readonly adminCreatableRoles = ['HR', 'PRINCIPAL'];
    private readonly hrBlockedRoles = ['ADMIN', 'HR', 'PRINCIPAL'];

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService,
        private readonly mailQueueService: MailQueueService
    ) {}

    async create(dto: CreateUserDto, actorPublicId?: string, request?: Request) {
        const role = await this.resolveRole(dto.roleId, dto.role);
        await this.assertCanCreateRole(actorPublicId, role.code);
        await this.assertSingleAdmin(role.code);
        const code = dto.code ?? (await this.generateUserCode(role.code, dto.cohortYear));

        const existedUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ code }, { email: dto.email }, ...(dto.phone ? [{ phone: dto.phone }] : [])]
            }
        });

        if (existedUser) {
            throw new ConflictException('Mã người dùng, email hoặc số điện thoại đã tồn tại');
        }

        const password = await bcrypt.hash(dto.password ?? this.defaultPassword, 10);

        const user = await this.prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: {
                    code,
                    fullName: dto.fullName,
                    email: dto.email,
                    phone: dto.phone,
                    password,
                    roleId: role.id,
                    status: dto.status ?? UserStatus.ACTIVE,
                    gender: dto.gender,
                    avatarUrl: dto.avatarUrl,
                    dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                    address: dto.address,
                    departmentId: dto.departmentId
                },
                select: {
                    ...this.defaultSelect()
                }
            });

            await this.auditLogsService.create(
                {
                    actorId: await this.resolveActorId(actorPublicId, tx),
                    action: AuditAction.CREATE,
                    module: 'users',
                    targetType: 'User',
                    targetId: createdUser.id,
                    targetPublicId: createdUser.publicId,
                    newValue: {
                        code: createdUser.code,
                        email: createdUser.email,
                        role: createdUser.role?.code,
                        status: createdUser.status
                    },
                    ipAddress: this.getIpAddress(request),
                    userAgent: request?.headers['user-agent']
                },
                tx
            );

            return createdUser;
        });

        return this.formatUser(user);
    }

    async findAll(query: QueryUserDto, actorPublicId?: string) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const where = await this.buildUserWhere(query, actorPublicId);

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

    async summary(query: QueryUserDto, actorPublicId?: string) {
        const where = await this.buildUserWhere({
            ...query,
            status: undefined,
            page: undefined,
            limit: undefined
        }, actorPublicId);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [total, active, pending, locked, newThisMonth, unassignedRole] = await Promise.all([
            this.prisma.user.count({ where }),
            this.prisma.user.count({ where: { ...where, status: UserStatus.ACTIVE } }),
            this.prisma.user.count({ where: { ...where, status: UserStatus.PENDING } }),
            this.prisma.user.count({ where: { ...where, status: UserStatus.LOCKED } }),
            this.prisma.user.count({
                where: {
                    ...where,
                    createdAt: {
                        gte: startOfMonth
                    }
                }
            }),
            this.prisma.user.count({ where: { ...where, roleId: null } })
        ]);

        const toPercent = (value: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : '0%');

        return {
            total,
            active,
            pending,
            locked,
            newThisMonth,
            unassignedRole,
            trends: {
                total: total > 0 ? '100%' : '0%',
                active: toPercent(active),
                pending: toPercent(pending),
                locked: toPercent(locked),
                newThisMonth: toPercent(newThisMonth),
                unassignedRole: toPercent(unassignedRole)
            }
        };
    }

    async exportCsv(query: QueryUserDto, actorPublicId?: string) {
        const users = await this.prisma.user.findMany({
            where: await this.buildUserWhere(query, actorPublicId),
            orderBy: {
                createdAt: 'desc'
            },
            select: this.defaultSelect()
        });

        const rows = [
            ['Code', 'Full name', 'Email', 'Phone', 'Role', 'Status', 'Department ID', 'Created at'],
            ...users.map((user) => [
                user.code,
                user.fullName,
                user.email,
                user.phone ?? '',
                user.role?.code ?? '',
                user.status,
                user.departmentId?.toString() ?? '',
                user.createdAt.toISOString()
            ])
        ];

        return rows.map((row) => row.map((cell) => this.csvCell(cell)).join(',')).join('\n');
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

    recordLogin(user: { id: number; publicId: string; email: string; role: { code: string } }, request?: Request) {
        return this.auditLogsService.create({
            actorId: user.id,
            action: AuditAction.LOGIN,
            module: 'auth',
            targetType: 'User',
            targetId: user.id,
            targetPublicId: user.publicId,
            newValue: {
                email: user.email,
                role: user.role.code
            },
            ipAddress: this.getIpAddress(request),
            userAgent: request?.headers['user-agent']
        });
    }

    async update(publicId: string, dto: UpdateUserDto, actorPublicId?: string) {
        const currentUser = await this.findByPublicIdRawOrThrow(publicId);
        const role = dto.roleId || dto.role ? await this.resolveRole(dto.roleId, dto.role) : undefined;
        const roleId = role?.id;

        if (role) {
            await this.assertCanAssignRole(actorPublicId, publicId, currentUser.role?.code ?? '', role.code);
            await this.assertSingleAdmin(role.code, publicId);
        }

        if (dto.status) {
            await this.assertCanUpdateStatus(actorPublicId, currentUser, dto.status);
        }

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

    async updateStatus(publicId: string, status: UserStatus, actorPublicId?: string, dto: UserStatusActionDto = {}, request?: Request) {
        const currentUser = await this.findByPublicIdRawOrThrow(publicId);
        await this.assertCanUpdateStatus(actorPublicId, currentUser, status);
        const auditAction =
            status === UserStatus.INACTIVE
                ? AuditAction.USER_DEACTIVATED
                : status === UserStatus.ACTIVE && currentUser.status === UserStatus.INACTIVE
                    ? AuditAction.USER_REACTIVATED
                    : AuditAction.STATUS_CHANGE;

        const user = await this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: {
                    publicId
                },
                data: {
                    status
                },
                select: this.defaultSelect()
            });

            if ((status === UserStatus.LOCKED || status === UserStatus.INACTIVE) && dto.revokeSessions !== false) {
                await tx.session.deleteMany({
                    where: {
                        userId: currentUser.id
                    }
                });
            }

            await this.auditLogsService.create(
                {
                    actorId: await this.resolveActorId(actorPublicId, tx),
                    action: auditAction,
                    module: 'users',
                    targetType: 'USER',
                    targetId: currentUser.id,
                    targetPublicId: currentUser.publicId,
                    oldValue: {
                        status: currentUser.status
                    },
                    newValue: {
                        status,
                        reason: dto.reason,
                        expiresAt: dto.expiresAt,
                        revokeSessions: status === UserStatus.LOCKED || status === UserStatus.INACTIVE ? dto.revokeSessions !== false : undefined
                    },
                    ipAddress: this.getIpAddress(request),
                    userAgent: request?.headers['user-agent']
                },
                tx
            );

            return updatedUser;
        });

        return this.formatUser(user);
    }

    async updateRole(publicId: string, dto: UpdateUserRoleDto, actorPublicId?: string, request?: Request) {
        if (!dto.roleId && !dto.role) {
            throw new BadRequestException('Vui long chon vai tro');
        }

        const currentUser = await this.findByPublicIdRawOrThrow(publicId);
        const role = await this.resolveRole(dto.roleId, dto.role);
        await this.assertCanAssignRole(actorPublicId, publicId, currentUser.role?.code ?? '', role.code);
        await this.assertSingleAdmin(role.code, publicId);

        const user = await this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: {
                    publicId
                },
                data: {
                    roleId: role.id
                },
                select: this.defaultSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: await this.resolveActorId(actorPublicId, tx),
                    action: AuditAction.ASSIGN,
                    module: 'users',
                    targetType: 'User',
                    targetId: currentUser.id,
                    targetPublicId: currentUser.publicId,
                    oldValue: {
                        roleId: currentUser.roleId,
                        role: currentUser.role?.code ?? null
                    },
                    newValue: {
                        roleId: role.id,
                        role: role.code
                    },
                    ipAddress: this.getIpAddress(request),
                    userAgent: request?.headers['user-agent']
                },
                tx
            );

            return updatedUser;
        });

        return this.formatUser(user);
    }

    async adminResetPassword(publicId: string, dto: ResetUserPasswordDto, actorPublicId?: string, request?: Request) {
        const user = await this.findByPublicIdRawOrThrow(publicId);
        const mode = dto.mode ?? 'link';

        if (mode === 'temporary') {
            const temporaryPassword = this.generateTemporaryPassword();
            const password = await bcrypt.hash(temporaryPassword, 10);

            await this.prisma.$transaction(async (tx) => {
                await tx.user.update({
                    where: {
                        publicId
                    },
                    data: {
                        password,
                        resetPasswordOtp: null,
                        resetPasswordOtpExpiresAt: null
                    }
                });

                if (dto.revokeSessions !== false) {
                    await tx.session.deleteMany({
                        where: {
                            userId: user.id
                        }
                    });
                }

                await this.auditLogsService.create(
                    {
                        actorId: await this.resolveActorId(actorPublicId, tx),
                        action: AuditAction.UPDATE,
                        module: 'users',
                        targetType: 'User',
                        targetId: user.id,
                        targetPublicId: user.publicId,
                        newValue: {
                            resetPasswordMode: mode,
                            forceChange: dto.forceChange,
                            revokeSessions: dto.revokeSessions !== false
                        },
                        ipAddress: this.getIpAddress(request),
                        userAgent: request?.headers['user-agent']
                    },
                    tx
                );
            });

            return {
                message: 'Dat lai mat khau thanh cong',
                temporaryPassword
            };
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: {
                    publicId
                },
                data: {
                    resetPasswordOtp: otp,
                    resetPasswordOtpExpiresAt: expiresAt
                }
            });

            if (dto.revokeSessions) {
                await tx.session.deleteMany({
                    where: {
                        userId: user.id
                    }
                });
            }

            await this.auditLogsService.create(
                {
                    actorId: await this.resolveActorId(actorPublicId, tx),
                    action: AuditAction.UPDATE,
                    module: 'users',
                    targetType: 'User',
                    targetId: user.id,
                    targetPublicId: user.publicId,
                    newValue: {
                        resetPasswordMode: mode,
                        forceChange: dto.forceChange,
                        revokeSessions: dto.revokeSessions === true
                    },
                    ipAddress: this.getIpAddress(request),
                    userAgent: request?.headers['user-agent']
                },
                tx
            );
        });

        this.mailQueueService
            .sendForgotPassword({
                email: user.email,
                fullName: user.fullName,
                otp
            })
            .catch((error) => {
                console.error('[USER_RESET_PASSWORD_MAIL_QUEUE_ERROR]', error);
            });

        return {
            message: 'Da gui email dat lai mat khau'
        };
    }

    async resendActivation(publicId: string, actorPublicId?: string, request?: Request) {
        const user = await this.findByPublicIdRawOrThrow(publicId);

        await this.auditLogsService.create({
            actorId: await this.resolveActorId(actorPublicId),
            action: AuditAction.UPDATE,
            module: 'users',
            targetType: 'User',
            targetId: user.id,
            targetPublicId: user.publicId,
            newValue: {
                activationEmailResent: true,
                status: user.status
            },
            ipAddress: this.getIpAddress(request),
            userAgent: request?.headers['user-agent']
        });

        this.mailQueueService
            .sendActivation({
                email: user.email,
                fullName: user.fullName,
                status: user.status
            })
            .catch((error) => {
                console.error('[USER_ACTIVATION_MAIL_QUEUE_ERROR]', error);
            });

        return {
            message: 'Da gui lai email kich hoat'
        };
    }

    async activities(publicId: string, query: QueryUserDto) {
        const user = await this.findByPublicIdRawOrThrow(publicId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const where = {
            targetType: 'User',
            targetPublicId: user.publicId
        };

        const [items, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    publicId: true,
                    action: true,
                    module: true,
                    targetType: true,
                    targetPublicId: true,
                    oldValue: true,
                    newValue: true,
                    ipAddress: true,
                    userAgent: true,
                    actor: {
                        select: {
                            publicId: true,
                            code: true,
                            fullName: true,
                            email: true
                        }
                    },
                    createdAt: true
                }
            }),
            this.prisma.auditLog.count({ where })
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

    async loginHistory(publicId: string, query: QueryUserDto) {
        const user = await this.findByPublicIdRawOrThrow(publicId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const where = {
            action: AuditAction.LOGIN,
            module: 'auth',
            targetType: 'User',
            targetPublicId: user.publicId
        };

        const [items, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    publicId: true,
                    ipAddress: true,
                    userAgent: true,
                    createdAt: true
                }
            }),
            this.prisma.auditLog.count({ where })
        ]);

        return {
            items: items.map((item) => ({
                ...item,
                device: this.describeDevice(item.userAgent),
                browser: this.describeBrowser(item.userAgent)
            })),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async bulkUpdateStatus(
        publicIds: string[],
        status: UserStatus,
        actorPublicId?: string,
        dto: UserStatusActionDto = {},
        request?: Request
    ) {
        const results: any[] = [];

        for (const publicId of publicIds) {
            const user = await this.updateStatus(publicId, status, actorPublicId, dto, request);
            results.push(user);
        }

        return {
            message: 'Xu ly hang loat thanh cong',
            total: results.length,
            items: results
        };
    }

    async bulkAssignRole(dto: BulkAssignRoleDto, actorPublicId?: string, request?: Request) {
        if (!dto.roleId && !dto.role) {
            throw new BadRequestException('Vui long chon vai tro');
        }

        const results: any[] = [];

        for (const publicId of dto.userIds) {
            const user = await this.updateRole(publicId, dto, actorPublicId, request);
            results.push(user);
        }

        return {
            message: 'Gan vai tro hang loat thanh cong',
            total: results.length,
            items: results
        };
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

    private async buildUserWhere(query: QueryUserDto, actorPublicId?: string): Promise<Prisma.UserWhereInput> {
        const createdAt =
            query.createdFrom || query.createdTo
                ? {
                      ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
                      ...(query.createdTo ? { lte: this.endOfDay(query.createdTo) } : {})
                  }
                : undefined;

        const where: Prisma.UserWhereInput = {
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
            ...(!query.status && query.emailVerified !== undefined
                ? { status: query.emailVerified ? { not: UserStatus.PENDING } : UserStatus.PENDING }
                : {}),
            ...(query.roleAssigned !== undefined ? (query.roleAssigned ? { roleId: { not: null } } : { roleId: null }) : {}),
            ...(query.publicIds?.length ? { publicId: { in: query.publicIds } } : {}),
            ...(query.departmentId ? { departmentId: query.departmentId } : {}),
            ...(createdAt ? { createdAt } : {})
        };

        if (query.createdBy) {
            const creatorPublicIds = await this.findCreatedUserPublicIds(query.createdBy);
            where.publicId = {
                in: query.publicIds?.length
                    ? creatorPublicIds.filter((publicId) => query.publicIds?.includes(publicId))
                    : creatorPublicIds
            };
        }

        const actor = await this.findActor(actorPublicId);

        if (actor?.role?.code === 'HR') {
            if (query.role && this.hrBlockedRoles.includes(query.role)) {
                where.id = { in: [] };
            } else {
                where.role = query.role ? { code: query.role } : { code: { notIn: this.hrBlockedRoles } };
            }
        }

        return where;
    }

    private async findByPublicIdRawOrThrow(publicId: string) {
        const user = await this.prisma.user.findFirst({
            where: {
                publicId,
                deletedAt: null
            },
            include: {
                role: true
            }
        });

        if (!user) {
            throw new NotFoundException('Khong tim thay nguoi dung');
        }

        return user;
    }

    private async resolveActorId(actorPublicId?: string, client: Pick<PrismaService, 'user'> | Prisma.TransactionClient = this.prisma) {
        if (!actorPublicId) {
            return undefined;
        }

        const actor = await client.user.findFirst({
            where: {
                publicId: actorPublicId,
                deletedAt: null
            },
            select: {
                id: true
            }
        });

        return actor?.id;
    }

    private async findActor(actorPublicId?: string) {
        if (!actorPublicId) {
            return null;
        }

        return this.prisma.user.findFirst({
            where: {
                publicId: actorPublicId,
                deletedAt: null
            },
            include: {
                role: true
            }
        });
    }

    private async assertCanCreateRole(actorPublicId: string | undefined, targetRoleCode: string) {
        const actor = await this.findActor(actorPublicId);

        if (!actor) {
            throw new ForbiddenException('Khong xac dinh duoc nguoi thuc hien');
        }

        if (!actor.role) {
            throw new ForbiddenException('Nguoi thuc hien chua duoc gan vai tro');
        }

        if (actor.role.code === 'ADMIN') {
            if (!this.adminCreatableRoles.includes(targetRoleCode)) {
                throw new ForbiddenException('Admin chi duoc tao HR hoac Hieu truong');
            }

            return;
        }

        if (actor.role.code === 'HR') {
            if (this.hrBlockedRoles.includes(targetRoleCode)) {
                throw new ForbiddenException('HR khong duoc tao Admin, HR hoac Hieu truong');
            }

            return;
        }

        throw new ForbiddenException('Ban khong co quyen tao vai tro nay');
    }

    private async assertCanAssignRole(
        actorPublicId: string | undefined,
        targetPublicId: string,
        currentRoleCode: string,
        nextRoleCode: string
    ) {
        if (actorPublicId === targetPublicId) {
            throw new ForbiddenException('Khong duoc tu thay doi vai tro cua chinh minh');
        }

        const actor = await this.findActor(actorPublicId);

        if (!actor) {
            throw new ForbiddenException('Khong xac dinh duoc nguoi thuc hien');
        }

        if (!actor.role) {
            throw new ForbiddenException('Nguoi thuc hien chua duoc gan vai tro');
        }

        if (actor.role.code === 'HR' && (this.hrBlockedRoles.includes(currentRoleCode) || this.hrBlockedRoles.includes(nextRoleCode))) {
            throw new ForbiddenException('HR khong duoc quan ly Admin, HR hoac Hieu truong');
        }
    }

    private async assertCanUpdateStatus(actorPublicId: string | undefined, targetUser: Awaited<ReturnType<UsersService['findByPublicIdRawOrThrow']>>, status: UserStatus) {
        const actor = await this.findActor(actorPublicId);

        if (actor?.role?.code === 'HR' && targetUser.role && this.hrBlockedRoles.includes(targetUser.role.code)) {
            throw new ForbiddenException('HR khong duoc quan ly Admin, HR hoac Hieu truong');
        }

        if (status !== UserStatus.LOCKED && status !== UserStatus.INACTIVE) {
            return;
        }

        if (actorPublicId === targetUser.publicId) {
            throw new ForbiddenException(status === UserStatus.INACTIVE ? 'Không đươc vô hiệu hóa tài khoản của chính mình' : 'Không được khóa tài khoản của chính mình');
        }

        if (targetUser.role?.code === 'ADMIN') {
            const activeAdminCount = await this.prisma.user.count({
                where: {
                    deletedAt: null,
                    status: UserStatus.ACTIVE,
                    role: {
                        code: 'ADMIN'
                    }
                }
            });

            if (targetUser.status === UserStatus.ACTIVE && activeAdminCount <= 1) {
                throw new BadRequestException('Khong duoc khoa Admin cuoi cung dang hoat dong');
            }
        }
    }

    private async assertSingleAdmin(roleCode: string, targetPublicId?: string) {
        if (roleCode !== 'ADMIN') {
            return;
        }

        const adminCount = await this.prisma.user.count({
            where: {
                deletedAt: null,
                role: {
                    code: 'ADMIN'
                },
                ...(targetPublicId
                    ? {
                          publicId: {
                              not: targetPublicId
                          }
                      }
                    : {})
            }
        });

        if (adminCount > 0) {
            throw new ConflictException('He thong chi duoc co 1 Admin');
        }
    }

    private async findCreatedUserPublicIds(createdBy: string) {
        const logs = await this.prisma.auditLog.findMany({
            where: {
                action: AuditAction.CREATE,
                module: 'users',
                targetType: 'User',
                targetPublicId: {
                    not: null
                },
                actor: {
                    OR: [
                        { publicId: createdBy },
                        { code: createdBy },
                        { email: createdBy },
                        { fullName: { contains: createdBy } }
                    ]
                }
            },
            distinct: ['targetPublicId'],
            select: {
                targetPublicId: true
            }
        });

        return logs.map((log) => log.targetPublicId).filter((publicId): publicId is string => Boolean(publicId));
    }

    private getIpAddress(request?: Request) {
        const forwardedFor = request?.headers['x-forwarded-for'];

        if (Array.isArray(forwardedFor)) {
            return forwardedFor[0];
        }

        if (typeof forwardedFor === 'string') {
            return forwardedFor.split(',')[0]?.trim();
        }

        return request?.ip;
    }

    private endOfDay(value: string) {
        const date = new Date(value);
        date.setHours(23, 59, 59, 999);

        return date;
    }

    private csvCell(value: string) {
        return `"${value.replace(/"/g, '""')}"`;
    }

    private describeBrowser(userAgent?: string | null) {
        if (!userAgent) {
            return 'Unknown browser';
        }

        if (userAgent.includes('Edg/')) return 'Microsoft Edge';
        if (userAgent.includes('Chrome/')) return 'Chrome';
        if (userAgent.includes('Firefox/')) return 'Firefox';
        if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) return 'Safari';

        return 'Unknown browser';
    }

    private describeDevice(userAgent?: string | null) {
        if (!userAgent) {
            return 'Unknown device';
        }

        const platform = userAgent.includes('Windows')
            ? 'Windows'
            : userAgent.includes('Mac OS X')
              ? 'macOS'
              : userAgent.includes('Android')
                ? 'Android'
                : userAgent.includes('iPhone') || userAgent.includes('iPad')
                  ? 'iOS'
                  : userAgent.includes('Linux')
                    ? 'Linux'
                    : 'Unknown OS';

        const formFactor = /Mobile|Android|iPhone/i.test(userAgent) ? 'Mobile' : 'Desktop';

        return `${platform} ${formFactor}`;
    }

    private generateTemporaryPassword() {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        let password = 'Aa1!';

        for (let index = 0; index < 8; index += 1) {
            password += alphabet[Math.floor(Math.random() * alphabet.length)];
        }

        return password;
    }

    private defaultSelect() {
        return {
            id: true,
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
        const role = await this.resolveRole(roleId, roleCode);

        return role.id;
    }

    private async resolveRole(roleId?: number, roleCode?: string) {
        const role = await this.prisma.role.findFirst({
            where: roleId ? { id: roleId } : { code: roleCode ?? 'STUDENT' }
        });

        if (!role) {
            throw new BadRequestException('Vai trò không hợp lệ');
        }

        return role;
    }

    private async generateUserCode(roleCode: string, cohortYear?: number) {
        const year = cohortYear ?? new Date().getFullYear();
        const prefix = this.buildUserCodePrefix(roleCode, year);

        const latestUser = await this.prisma.user.findFirst({
            where: {
                code: {
                    startsWith: prefix
                }
            },
            orderBy: {
                code: 'desc'
            },
            select: {
                code: true
            }
        });

        const latestSequence = latestUser ? Number(latestUser.code.slice(prefix.length)) : 0;
        const nextSequence = latestSequence + 1;

        if (nextSequence > 999) {
            throw new BadRequestException('Da het so thu tu ma nguoi dung cho nhom nay');
        }

        return `${prefix}${nextSequence.toString().padStart(3, '0')}`;
    }

    private buildUserCodePrefix(roleCode: string, year: number) {
        const yearCode = (year % 100).toString().padStart(2, '0');
        const rolePrefixMap: Record<string, string> = {
            STUDENT: '92',
            LECTURER: '93',
            DEPARTMENT_HEAD: '94',
            TRAINING_OFFICER: '95',
            HR: '96',
            PRINCIPAL: '97',
            ADMIN: '98'
        };

        return `${rolePrefixMap[roleCode] ?? '49'}${yearCode}10`;
    }

    private formatUser(user: any) {
        const { id, role, ...rest } = user;
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
            id,
            ...rest,
            role: role?.code,
            roleDetail,
            permissions,
            permissionCodes: permissions.map((permission) => permission.code)
        };
    }
}
