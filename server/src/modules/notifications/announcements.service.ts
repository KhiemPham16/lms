import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
    AnnouncementAudience,
    AnnouncementStatus,
    AuditAction,
    Prisma,
    UserStatus
} from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '~/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
    CreateAnnouncementDto,
    QueryAnnouncementDto,
    UpdateAnnouncementDto
} from './dto/announcement.dto';

const announcementInclude = {
    createdBy: { select: { publicId: true, fullName: true } },
    publishedBy: { select: { publicId: true, fullName: true } }
} satisfies Prisma.AnnouncementInclude;

@Injectable()
export class AnnouncementsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        @InjectQueue('announcements') private readonly queue: Queue<{ publicId: string }>
    ) {}

    async list(query: QueryAnnouncementDto) {
        const where: Prisma.AnnouncementWhereInput = {
            status: query.status,
            category: query.category,
            OR: query.search
                ? [{ title: { contains: query.search } }, { message: { contains: query.search } }]
                : undefined
        };
        const skip = (query.page - 1) * query.limit;
        const [data, total] = await this.prisma.$transaction([
            this.prisma.announcement.findMany({
                where,
                include: announcementInclude,
                orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
                skip,
                take: query.limit
            }),
            this.prisma.announcement.count({ where })
        ]);
        return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
    }

    async findOne(publicId: string) {
        const announcement = await this.prisma.announcement.findUnique({
            where: { publicId },
            include: announcementInclude
        });
        if (!announcement) throw new NotFoundException('Không tìm thấy thông báo toàn trường');
        return announcement;
    }

    async feed(userPublicId: string) {
        const user = await this.prisma.user.findUnique({
            where: { publicId: userPublicId },
            select: { role: true, department: { select: { publicId: true } } }
        });
        if (!user) throw new NotFoundException('Không tìm thấy người dùng');
        const now = new Date();
        const candidates = await this.prisma.announcement.findMany({
            where: {
                status: AnnouncementStatus.PUBLISHED,
                publishedAt: { lte: now },
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
            },
            include: announcementInclude,
            orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
            take: 100
        });
        return candidates.filter((item) => {
            if (item.audience === AnnouncementAudience.ALL) return true;
            if (item.audience === AnnouncementAudience.ROLES)
                return this.jsonStrings(item.targetRoles).includes(user.role);
            return !!user.department?.publicId && this.jsonStrings(item.targetDepartmentIds).includes(user.department.publicId);
        });
    }

    async create(dto: CreateAnnouncementDto, actorPublicId: string) {
        const actor = await this.requireActor(actorPublicId);
        const targets = await this.validateAudience(dto.audience ?? AnnouncementAudience.ALL, dto);
        const expiresAt = this.optionalFutureDate(dto.expiresAt, 'Thời gian hết hiệu lực');
        const announcement = await this.prisma.announcement.create({
            data: {
                title: dto.title.trim(),
                message: dto.message.trim(),
                category: dto.category,
                audience: dto.audience,
                targetRoles: targets.targetRoles,
                targetDepartmentIds: targets.targetDepartmentIds,
                isPinned: dto.isPinned,
                expiresAt,
                createdById: actor.id
            },
            include: announcementInclude
        });
        await this.record(actorPublicId, AuditAction.CREATE, announcement.publicId, {
            title: announcement.title,
            audience: announcement.audience
        });
        return announcement;
    }

    async update(publicId: string, dto: UpdateAnnouncementDto, actorPublicId: string) {
        const current = await this.requireEditable(publicId);
        const audience = dto.audience ?? current.audience;
        const targets = await this.validateAudience(audience, {
            targetRoles: dto.targetRoles ?? this.jsonStrings(current.targetRoles),
            targetDepartmentPublicIds:
                dto.targetDepartmentPublicIds ?? this.jsonStrings(current.targetDepartmentIds)
        });
        const expiresAt = dto.expiresAt
            ? this.optionalFutureDate(dto.expiresAt, 'Thời gian hết hiệu lực')
            : undefined;
        const announcement = await this.prisma.announcement.update({
            where: { id: current.id },
            data: {
                title: dto.title?.trim(),
                message: dto.message?.trim(),
                category: dto.category,
                audience,
                targetRoles: targets.targetRoles,
                targetDepartmentIds: targets.targetDepartmentIds,
                isPinned: dto.isPinned,
                expiresAt
            },
            include: announcementInclude
        });
        await this.record(actorPublicId, AuditAction.UPDATE, publicId, { title: announcement.title });
        return announcement;
    }

    async publish(publicId: string, actorPublicId: string) {
        const actor = await this.requireActor(actorPublicId);
        return this.publishInternal(publicId, actor.id, actorPublicId);
    }

    async schedule(publicId: string, scheduledAtValue: string, actorPublicId: string) {
        const current = await this.requireEditable(publicId);
        const actor = await this.requireActor(actorPublicId);
        const scheduledAt = new Date(scheduledAtValue);
        if (scheduledAt <= new Date()) throw new BadRequestException('Thời gian đăng phải ở tương lai');
        if (current.expiresAt && scheduledAt >= current.expiresAt)
            throw new BadRequestException('Thời gian đăng phải trước thời gian hết hiệu lực');
        await this.removeScheduledJob(current.id);
        const announcement = await this.prisma.announcement.update({
            where: { id: current.id },
            data: {
                status: AnnouncementStatus.SCHEDULED,
                scheduledAt,
                publishedById: actor.id,
                cancelledAt: null
            },
            include: announcementInclude
        });
        await this.queue.add(
            'publish',
            { publicId },
            {
                jobId: this.jobId(current.id),
                delay: Math.max(0, scheduledAt.getTime() - Date.now()),
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: 100,
                removeOnFail: 100
            }
        );
        await this.record(actorPublicId, AuditAction.UPDATE, publicId, {
            status: AnnouncementStatus.SCHEDULED,
            scheduledAt
        });
        return announcement;
    }

    async publishScheduled(publicId: string) {
        const current = await this.prisma.announcement.findUnique({
            where: { publicId },
            include: { publishedBy: { select: { id: true, publicId: true } }, createdBy: { select: { id: true, publicId: true } } }
        });
        if (!current || current.status !== AnnouncementStatus.SCHEDULED) return;
        const publisher = current.publishedBy ?? current.createdBy;
        await this.publishInternal(publicId, publisher.id, publisher.publicId);
    }

    async cancel(publicId: string, actorPublicId: string) {
        const current = await this.prisma.announcement.findUnique({ where: { publicId } });
        if (!current) throw new NotFoundException('Không tìm thấy thông báo toàn trường');
        if (!this.hasStatus(current.status, [AnnouncementStatus.DRAFT, AnnouncementStatus.SCHEDULED, AnnouncementStatus.PUBLISHED]))
            throw new ConflictException('Thông báo không thể hủy ở trạng thái hiện tại');
        await this.removeScheduledJob(current.id);
        const announcement = await this.prisma.$transaction(async (tx) => {
            if (current.status === AnnouncementStatus.PUBLISHED)
                await tx.notification.deleteMany({ where: { announcementId: current.id } });
            return tx.announcement.update({
                where: { id: current.id },
                data: { status: AnnouncementStatus.CANCELLED, cancelledAt: new Date(), scheduledAt: null },
                include: announcementInclude
            });
        });
        await this.record(actorPublicId, AuditAction.STATUS_CHANGE, publicId, {
            status: AnnouncementStatus.CANCELLED
        });
        return announcement;
    }

    async remove(publicId: string, actorPublicId: string) {
        const current = await this.prisma.announcement.findUnique({ where: { publicId } });
        if (!current) throw new NotFoundException('Không tìm thấy thông báo toàn trường');
        if (!this.hasStatus(current.status, [AnnouncementStatus.DRAFT, AnnouncementStatus.CANCELLED]))
            throw new ConflictException('Chỉ được xóa thông báo nháp hoặc đã hủy');
        await this.removeScheduledJob(current.id);
        await this.prisma.announcement.delete({ where: { id: current.id } });
        await this.record(actorPublicId, AuditAction.DELETE, publicId, { title: current.title });
        return { message: 'Đã xóa thông báo toàn trường' };
    }

    private async publishInternal(publicId: string, publisherId: number, actorPublicId: string) {
        const current = await this.prisma.announcement.findUnique({ where: { publicId } });
        if (!current) throw new NotFoundException('Không tìm thấy thông báo toàn trường');
        if (current.status === AnnouncementStatus.PUBLISHED) return this.findOne(publicId);
        if (!this.hasStatus(current.status, [AnnouncementStatus.DRAFT, AnnouncementStatus.SCHEDULED]))
            throw new ConflictException('Thông báo không thể đăng ở trạng thái hiện tại');
        if (current.expiresAt && current.expiresAt <= new Date())
            throw new BadRequestException('Thông báo đã hết thời gian hiệu lực');

        const claimed = await this.prisma.announcement.updateMany({
            where: { id: current.id, status: current.status },
            data: { status: AnnouncementStatus.PUBLISHING }
        });
        if (!claimed.count) return this.findOne(publicId);
        try {
            const recipients = await this.recipients(current);
            const publishedAt = new Date();
            const data = {
                announcementPublicId: current.publicId,
                category: current.category,
                expiresAt: current.expiresAt?.toISOString() ?? null
            } satisfies Prisma.InputJsonObject;
            const announcement = await this.prisma.$transaction(async (tx) => {
                if (recipients.length) {
                    await tx.notification.createMany({
                        data: recipients.map((recipient) => ({
                            recipientId: recipient.id,
                            announcementId: current.id,
                            type: 'ANNOUNCEMENT',
                            title: current.title,
                            message: current.message,
                            data
                        }))
                    });
                }
                return tx.announcement.update({
                    where: { id: current.id },
                    data: {
                        status: AnnouncementStatus.PUBLISHED,
                        publishedAt,
                        publishedById: publisherId,
                        scheduledAt: null,
                        cancelledAt: null
                    },
                    include: announcementInclude
                });
            });
            await this.removeScheduledJob(current.id);
            await this.record(actorPublicId, AuditAction.STATUS_CHANGE, publicId, {
                status: AnnouncementStatus.PUBLISHED,
                recipientCount: recipients.length
            });
            return { ...announcement, recipientCount: recipients.length };
        } catch (error) {
            await this.prisma.announcement.updateMany({
                where: { id: current.id, status: AnnouncementStatus.PUBLISHING },
                data: { status: current.status }
            });
            throw error;
        }
    }

    private recipients(announcement: {
        audience: AnnouncementAudience;
        targetRoles: Prisma.JsonValue;
        targetDepartmentIds: Prisma.JsonValue;
    }) {
        const where: Prisma.UserWhereInput = { status: UserStatus.ACTIVE };
        if (announcement.audience === AnnouncementAudience.ROLES)
            where.role = { in: this.jsonStrings(announcement.targetRoles) as Prisma.EnumUserRoleFilter['in'] };
        if (announcement.audience === AnnouncementAudience.DEPARTMENTS)
            where.department = { publicId: { in: this.jsonStrings(announcement.targetDepartmentIds) } };
        return this.prisma.user.findMany({ where, select: { id: true } });
    }

    private async validateAudience(
        audience: AnnouncementAudience,
        input: { targetRoles?: unknown; targetDepartmentPublicIds?: unknown }
    ) {
        if (audience === AnnouncementAudience.ALL)
            return { targetRoles: Prisma.JsonNull, targetDepartmentIds: Prisma.JsonNull };
        if (audience === AnnouncementAudience.ROLES) {
            const roles = Array.isArray(input.targetRoles) ? [...new Set(input.targetRoles as string[])] : [];
            if (!roles.length) throw new BadRequestException('Phải chọn ít nhất một vai trò nhận thông báo');
            return { targetRoles: roles, targetDepartmentIds: Prisma.JsonNull };
        }
        const ids = Array.isArray(input.targetDepartmentPublicIds)
            ? [...new Set(input.targetDepartmentPublicIds as string[])]
            : [];
        if (!ids.length) throw new BadRequestException('Phải chọn ít nhất một phòng ban nhận thông báo');
        const count = await this.prisma.department.count({ where: { publicId: { in: ids }, isActive: true } });
        if (count !== ids.length) throw new BadRequestException('Có phòng ban không tồn tại hoặc đã ngừng hoạt động');
        return { targetRoles: Prisma.JsonNull, targetDepartmentIds: ids };
    }

    private async requireEditable(publicId: string) {
        const announcement = await this.prisma.announcement.findUnique({ where: { publicId } });
        if (!announcement) throw new NotFoundException('Không tìm thấy thông báo toàn trường');
        if (!this.hasStatus(announcement.status, [AnnouncementStatus.DRAFT, AnnouncementStatus.SCHEDULED]))
            throw new ConflictException('Chỉ được sửa thông báo nháp hoặc đang chờ đăng');
        return announcement;
    }

    private async requireActor(publicId: string) {
        const actor = await this.prisma.user.findUnique({ where: { publicId }, select: { id: true } });
        if (!actor) throw new NotFoundException('Không tìm thấy người thực hiện');
        return actor;
    }

    private optionalFutureDate(value: string | undefined, label: string) {
        if (!value) return undefined;
        const date = new Date(value);
        if (date <= new Date()) throw new BadRequestException(`${label} phải ở tương lai`);
        return date;
    }

    private jsonStrings(value: Prisma.JsonValue | null) {
        return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
    }

    private hasStatus(status: AnnouncementStatus, allowed: AnnouncementStatus[]) {
        return allowed.includes(status);
    }

    private jobId(id: number) {
        return `announcement-${id}`;
    }

    private async removeScheduledJob(id: number) {
        const job = await this.queue.getJob(this.jobId(id));
        if (job) await job.remove().catch(() => undefined);
    }

    private record(actorPublicId: string, action: AuditAction, targetPublicId: string, value: Prisma.InputJsonValue) {
        return this.audit.record({
            actorPublicId,
            action,
            module: 'thong-bao-toan-truong',
            targetType: 'Announcement',
            targetPublicId,
            newValue: value
        });
    }
}
