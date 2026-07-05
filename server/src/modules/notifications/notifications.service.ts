import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';
import { QueryNotificationDto } from './dto/query-notification.dto';

type NotificationTx = Prisma.TransactionClient | PrismaService;

export type CreateNotificationInput = {
    recipientIds: number[];
    actorId?: number | null;
    type: string;
    title: string;
    message: string;
    data?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
    constructor(private readonly prisma: PrismaService) {}

    async createMany(input: CreateNotificationInput, tx: NotificationTx = this.prisma) {
        const recipientIds = Array.from(new Set(input.recipientIds)).filter((id) => id > 0);
        if (recipientIds.length === 0) return { count: 0 };

        return tx.notification.createMany({
            data: recipientIds.map((recipientId) => ({
                recipientId,
                actorId: input.actorId ?? null,
                type: input.type,
                title: input.title,
                message: input.message,
                data: input.data ?? Prisma.JsonNull
            }))
        });
    }

    async findMine(actorPublicId: string, query: QueryNotificationDto) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const where: Prisma.NotificationWhereInput = {
            recipientId: actor.id,
            ...(query.unreadOnly ? { readAt: null } : {}),
            ...(query.type ? { type: query.type } : {})
        };

        const [items, total, unreadCount] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: this.notificationSelect()
            }),
            this.prisma.notification.count({ where }),
            this.prisma.notification.count({
                where: {
                    recipientId: actor.id,
                    readAt: null
                }
            })
        ]);

        return {
            items,
            unreadCount,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async unreadCount(actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const count = await this.prisma.notification.count({
            where: {
                recipientId: actor.id,
                readAt: null
            }
        });

        return { count };
    }

    async markRead(publicId: string, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const notification = await this.prisma.notification.findFirst({
            where: {
                publicId,
                recipientId: actor.id
            },
            select: { id: true }
        });

        if (!notification) throw new NotFoundException('Không tìm thấy thông báo');

        return this.prisma.notification.update({
            where: { id: notification.id },
            data: { readAt: new Date() },
            select: this.notificationSelect()
        });
    }

    async markAllRead(actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const result = await this.prisma.notification.updateMany({
            where: {
                recipientId: actor.id,
                readAt: null
            },
            data: { readAt: new Date() }
        });

        return { updatedCount: result.count };
    }

    private async findUserByPublicIdOrThrow(publicId: string) {
        const user = await this.prisma.user.findFirst({
            where: {
                publicId,
                deletedAt: null
            },
            select: { id: true }
        });

        if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
        return user;
    }

    private notificationSelect() {
        return {
            publicId: true,
            type: true,
            title: true,
            message: true,
            data: true,
            readAt: true,
            createdAt: true,
            actor: {
                select: {
                    publicId: true,
                    code: true,
                    fullName: true,
                    email: true
                }
            }
        } satisfies Prisma.NotificationSelect;
    }
}
