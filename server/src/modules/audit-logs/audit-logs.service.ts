import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

type AuditLogClient = {
    auditLog: {
        create: PrismaService['auditLog']['create'];
    };
};

export type CreateAuditLogInput = {
    actorId?: number;
    action: AuditAction;
    module: string;
    targetType?: string;
    targetId?: number;
    targetPublicId?: string;
    oldValue?: Prisma.InputJsonObject;
    newValue?: Prisma.InputJsonObject;
    ipAddress?: string;
    userAgent?: string;
};

@Injectable()
export class AuditLogsService {
    constructor(private readonly prisma: PrismaService) {}

    create(data: CreateAuditLogInput, client: AuditLogClient = this.prisma) {
        return client.auditLog.create({
            data: {
                actorId: data.actorId,
                action: data.action,
                module: data.module,
                targetType: data.targetType,
                targetId: data.targetId,
                targetPublicId: data.targetPublicId,
                oldValue: data.oldValue,
                newValue: data.newValue,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent
            }
        });
    }

    async findAll(query: QueryAuditLogDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const where = {
            ...(query.action ? { action: query.action } : {}),
            ...(query.module ? { module: query.module } : {}),
            ...(query.targetType ? { targetType: query.targetType } : {}),
            ...(query.targetPublicId ? { targetPublicId: query.targetPublicId } : {}),
            ...(query.actorId ? { actorId: query.actorId } : {})
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
                    targetId: true,
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
}
