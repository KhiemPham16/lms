import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '~/prisma/prisma.service';
import { QueryNotificationDto } from './dto/query-notification.dto';

type NotificationInput = {
    recipientId: number;
    type: string;
    title: string;
    message: string;
    data?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
    constructor(private readonly prisma: PrismaService) {}

    create(input: NotificationInput) {
        return this.prisma.notification.create({ data: input });
    }

    createMany(inputs: NotificationInput[]) {
        if (!inputs.length) return Promise.resolve({ count: 0 });
        return this.prisma.notification.createMany({ data: inputs });
    }

    async list(recipientPublicId: string, query: QueryNotificationDto) {
        const recipient = await this.requireRecipient(recipientPublicId);
        const where: Prisma.NotificationWhereInput = {
            recipientId: recipient.id,
            readAt: query.unreadOnly ? null : undefined
        };
        const skip = (query.page - 1) * query.limit;
        const [items, total, unread] = await this.prisma.$transaction([
            this.prisma.notification.findMany({ where, skip, take: query.limit, orderBy: { createdAt: 'desc' } }),
            this.prisma.notification.count({ where }),
            this.prisma.notification.count({ where: { recipientId: recipient.id, readAt: null } })
        ]);
        return {
            data: items.map((item) => ({ ...item, id: item.id.toString() })),
            meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit), unread }
        };
    }

    async unreadCount(recipientPublicId: string) {
        const recipient = await this.requireRecipient(recipientPublicId);
        return { count: await this.prisma.notification.count({ where: { recipientId: recipient.id, readAt: null } }) };
    }

    async markRead(publicId: string, recipientPublicId: string) {
        const recipient = await this.requireRecipient(recipientPublicId);
        const notification = await this.prisma.notification.findFirst({ where: { publicId, recipientId: recipient.id } });
        if (!notification) throw new NotFoundException('Không tìm thấy thông báo');
        await this.prisma.notification.update({ where: { id: notification.id }, data: { readAt: notification.readAt ?? new Date() } });
        return { message: 'Đã đánh dấu thông báo là đã đọc' };
    }

    async markAllRead(recipientPublicId: string) {
        const recipient = await this.requireRecipient(recipientPublicId);
        const result = await this.prisma.notification.updateMany({ where: { recipientId: recipient.id, readAt: null }, data: { readAt: new Date() } });
        return { message: 'Đã đọc toàn bộ thông báo', count: result.count };
    }

    private async requireRecipient(publicId: string) {
        const recipient = await this.prisma.user.findUnique({ where: { publicId }, select: { id: true } });
        if (!recipient) throw new NotFoundException('Không tìm thấy người dùng');
        return recipient;
    }
}
