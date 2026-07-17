import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '~/prisma/prisma.service';
import { QueryAuditDto } from './dto/query-audit.dto';

type AuditInput = {
    actorPublicId?: string;
    action: AuditAction;
    module: string;
    targetType: string;
    targetPublicId?: string;
    oldValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
};

@Injectable()
export class AuditService {
    constructor(private readonly prisma: PrismaService) {}

    async record(input: AuditInput) {
        const actor = input.actorPublicId
            ? await this.prisma.user.findUnique({ where: { publicId: input.actorPublicId }, select: { id: true } })
            : null;

        return this.prisma.auditLog.create({
            data: {
                actorId: actor?.id,
                action: input.action,
                module: input.module,
                targetType: input.targetType,
                targetPublicId: input.targetPublicId,
                oldValue: input.oldValue,
                newValue: input.newValue,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent
            }
        });
    }

    async list(query: QueryAuditDto) {
        const where: Prisma.AuditLogWhereInput = { action: query.action, module: query.module };
        const skip = (query.page - 1) * query.limit;
        const [data, total] = await this.prisma.$transaction([
            this.prisma.auditLog.findMany({
                where, skip, take: query.limit, orderBy: { createdAt: 'desc' },
                include: { actor: { select: { publicId: true, code: true, fullName: true, role: true } } }
            }),
            this.prisma.auditLog.count({ where })
        ]);
        return {
            data: data.map((item) => ({
                ...item,
                id: item.id.toString()
            })),
            meta: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit)
            }
        };
    }
}
