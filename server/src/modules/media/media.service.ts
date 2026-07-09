import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, MediaType, Prisma } from '@prisma/client';
import { existsSync } from 'node:fs';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { PrismaService } from '~/prisma/prisma.service';
import { QueryMediaDto } from './dto/query-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { buildMediaUrl, inferMediaType, MEDIA_UPLOAD_ROOT, sanitizeMediaFolder } from './media-upload.util';

export type UploadedMediaFile = {
    filename: string;
    originalname: string;
    mimetype: string;
    size: number;
    path?: string;
};

type MediaActor = {
    id: number;
    publicId: string;
    fullName: string;
    email: string;
    role: {
        code: string;
    };
};

const courseRelatedMediaFolders = new Set([
    'courses/images',
    'courses/documents',
    'lessons/images',
    'lessons/documents',
    'exams/documents'
]);
const courseMediaRoles = new Set(['LECTURER', 'DEPARTMENT_HEAD', 'TRAINING_OFFICER']);

@Injectable()
export class MediaService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService
    ) {}

    async upload(actorPublicId: string, file: UploadedMediaFile | undefined, data: UpdateMediaDto) {
        if (!file) throw new BadRequestException('Can chon file de upload');

        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const folder = sanitizeMediaFolder(data.folder);
        const type = inferMediaType(file.mimetype);
        try {
            this.ensureCanUseMedia(actor, folder, type);
        } catch (error) {
            await this.deleteUploadedFile(file);
            throw error;
        }
        await this.moveUploadedFileToFolder(file, folder);
        const media = await this.prisma.$transaction(async (tx) => {
            const created = await tx.media.create({
                data: {
                    fileName: file.filename,
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    url: buildMediaUrl(folder, file.filename),
                    type,
                    alt: data.alt,
                    folder,
                    uploadedById: actor.id
                },
                select: this.mediaSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.CREATE,
                    module: 'media',
                    targetType: 'Media',
                    targetId: created.id,
                    targetPublicId: created.publicId,
                    newValue: this.auditMediaValue(created)
                },
                tx
            );

            return created;
        });

        return this.formatMedia(media);
    }

    async findAll(query: QueryMediaDto, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const accessWhere = this.mediaAccessWhere(actor);
        const where: Prisma.MediaWhereInput = {
            ...accessWhere,
            ...(query.type ? { type: query.type } : {}),
            ...(query.folder ? { folder: sanitizeMediaFolder(query.folder) } : {}),
            ...(query.keyword
                ? {
                      OR: [
                          { originalName: { contains: query.keyword } },
                          { fileName: { contains: query.keyword } },
                          { alt: { contains: query.keyword } }
                      ]
                  }
                : {})
        };

        const [items, total] = await Promise.all([
            this.prisma.media.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: this.mediaSelect()
            }),
            this.prisma.media.count({ where })
        ]);

        return {
            items: items.map((item) => this.formatMedia(item)),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async findOne(publicId: string, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const media = await this.findMediaByPublicIdOrThrow(publicId);
        this.ensureCanUseMedia(actor, media.folder ?? '', media.type);
        return this.formatMedia(media);
    }

    async update(publicId: string, dto: UpdateMediaDto, actorPublicId: string) {
        const [actor, media] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findMediaByPublicIdOrThrow(publicId)
        ]);
        const nextFolder = dto.folder === undefined ? undefined : sanitizeMediaFolder(dto.folder);
        this.ensureCanUseMedia(actor, media.folder ?? '', media.type);
        if (nextFolder) this.ensureCanUseMedia(actor, nextFolder, media.type);
        const nextUrl = nextFolder && nextFolder !== media.folder ? await this.moveExistingMediaToFolder(media, nextFolder) : undefined;

        const updated = await this.prisma.$transaction(async (tx) => {
            const item = await tx.media.update({
                where: { publicId },
                data: {
                    alt: dto.alt,
                    folder: nextFolder,
                    url: nextUrl
                },
                select: this.mediaSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.UPDATE,
                    module: 'media',
                    targetType: 'Media',
                    targetId: item.id,
                    targetPublicId: item.publicId,
                    oldValue: this.auditMediaValue(media),
                    newValue: this.auditMediaValue(item)
                },
                tx
            );

            return item;
        });

        return this.formatMedia(updated);
    }

    async remove(publicId: string, actorPublicId: string) {
        const [actor, media] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findMediaByPublicIdOrThrow(publicId)
        ]);
        this.ensureCanUseMedia(actor, media.folder ?? '', media.type);

        await this.prisma.$transaction(async (tx) => {
            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.DELETE,
                    module: 'media',
                    targetType: 'Media',
                    targetId: media.id,
                    targetPublicId: media.publicId,
                    oldValue: this.auditMediaValue(media)
                },
                tx
            );

            await tx.media.delete({ where: { publicId } });
        });

        await this.deleteLocalFile(media.url);

        return { publicId, deleted: true };
    }

    private async findUserByPublicIdOrThrow(publicId: string) {
        const user = await this.prisma.user.findFirst({
            where: { publicId, deletedAt: null },
            select: {
                id: true,
                publicId: true,
                fullName: true,
                email: true,
                role: {
                    select: {
                        code: true
                    }
                }
            }
        });

        if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
        if (!user.role) throw new ForbiddenException('Nguoi dung chua duoc gan vai tro');
        return { ...user, role: user.role };
    }

    private mediaAccessWhere(actor: MediaActor): Prisma.MediaWhereInput {
        if (actor.role.code === 'ADMIN') return {};
        if (courseMediaRoles.has(actor.role.code)) {
            return {
                folder: { in: Array.from(courseRelatedMediaFolders) },
                type: { not: MediaType.VIDEO }
            };
        }

        throw new ForbiddenException('Ban khong co quyen xem thu vien media');
    }

    private ensureCanUseMedia(
        actor: MediaActor,
        folder: string,
        type: MediaType
    ) {
        if (actor.role.code === 'ADMIN') return;
        if (courseMediaRoles.has(actor.role.code) && courseRelatedMediaFolders.has(folder) && type !== MediaType.VIDEO) {
            return;
        }

        throw new ForbiddenException('Ban chi duoc dung media lien quan khoa hoc va khong bao gom video upload');
    }

    private async deleteUploadedFile(file: UploadedMediaFile) {
        if (!file.path) return;
        const uploadsRoot = resolve(process.cwd(), 'uploads');
        const filePath = resolve(file.path);
        if (!filePath.startsWith(uploadsRoot) || !existsSync(filePath)) return;
        await unlink(filePath);
    }

    private async findMediaByPublicIdOrThrow(publicId: string) {
        const media = await this.prisma.media.findUnique({
            where: { publicId },
            select: this.mediaSelect()
        });

        if (!media) throw new NotFoundException('Khong tim thay media');
        return media;
    }

    private async deleteLocalFile(url: string) {
        const uploadsRoot = resolve(process.cwd(), 'uploads');
        const filePath = resolve(process.cwd(), url.replace(/^\/+/, ''));

        if (!filePath.startsWith(uploadsRoot) || !existsSync(filePath)) return;
        await unlink(filePath);
    }

    private async moveUploadedFileToFolder(file: UploadedMediaFile, folder: string) {
        if (!file.path) return;

        const targetPath = join(MEDIA_UPLOAD_ROOT, folder, file.filename);
        if (resolve(file.path) === resolve(targetPath)) return;

        await mkdir(dirname(targetPath), { recursive: true });
        if (existsSync(file.path)) {
            await rename(file.path, targetPath);
        }
    }

    private async moveExistingMediaToFolder(
        media: Prisma.MediaGetPayload<{ select: ReturnType<MediaService['mediaSelect']> }>,
        folder: string
    ) {
        const uploadsRoot = resolve(process.cwd(), 'uploads');
        const currentPath = resolve(process.cwd(), media.url.replace(/^\/+/, ''));
        const targetPath = resolve(MEDIA_UPLOAD_ROOT, folder, media.fileName);

        if (!currentPath.startsWith(uploadsRoot) || !targetPath.startsWith(uploadsRoot)) {
            throw new BadRequestException('Duong dan media khong hop le');
        }

        if (!existsSync(currentPath)) {
            throw new BadRequestException('Khong tim thay file media tren server');
        }

        await mkdir(dirname(targetPath), { recursive: true });
        if (currentPath !== targetPath) {
            await rename(currentPath, targetPath);
        }

        return buildMediaUrl(folder, media.fileName);
    }
    private mediaSelect() {
        return {
            id: true,
            publicId: true,
            fileName: true,
            originalName: true,
            mimeType: true,
            size: true,
            url: true,
            type: true,
            alt: true,
            folder: true,
            uploadedBy: {
                select: {
                    publicId: true,
                    code: true,
                    fullName: true,
                    email: true
                }
            },
            createdAt: true,
            updatedAt: true
        } satisfies Prisma.MediaSelect;
    }

    private auditMediaValue(media: Prisma.MediaGetPayload<{ select: ReturnType<MediaService['mediaSelect']> }>) {
        return {
            publicId: media.publicId,
            fileName: media.fileName,
            originalName: media.originalName,
            mimeType: media.mimeType,
            size: media.size,
            url: media.url,
            type: media.type,
            alt: media.alt,
            folder: media.folder
        };
    }

    private formatMedia(media: Prisma.MediaGetPayload<{ select: ReturnType<MediaService['mediaSelect']> }>) {
        const { id: _id, ...rest } = media;
        void _id;

        return rest;
    }
}
