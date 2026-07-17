import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, MediaType, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { parse, resolve } from 'node:path';
import sharp from 'sharp';
import { PrismaService } from '~/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SystemSettingsService, type UploadPolicy } from '../system-settings/system-settings.service';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { BulkMoveMediaDto, QueryMediaDto, UpdateMediaDto, UploadMediaDto } from './dto/media.dto';

export type UploadedMediaFile = {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
};

type NormalizedFile = {
    type: MediaType;
    extension: string;
    mimeType: string;
    buffer: Buffer;
    width?: number;
    height?: number;
};

const publicMediaInclude = {
    uploadedBy: { select: { publicId: true, fullName: true, email: true } },
    _count: { select: { lessons: true } }
} satisfies Prisma.MediaInclude;

@Injectable()
export class MediaService {
    private readonly root: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly audit: AuditService,
        private readonly settings: SystemSettingsService
    ) {
        this.root = resolve(process.cwd(), this.config.get<string>('media.root') ?? 'storage/media');
    }

    uploadImage(file: UploadedMediaFile | undefined, uploaderPublicId: string) {
        return this.upload(file, {}, uploaderPublicId, MediaType.IMAGE);
    }

    uploadPdf(file: UploadedMediaFile | undefined, uploaderPublicId: string) {
        return this.upload(file, {}, uploaderPublicId, MediaType.PDF);
    }

    async uploadMedia(file: UploadedMediaFile | undefined, dto: UploadMediaDto, uploaderPublicId: string) {
        return this.upload(file, dto, uploaderPublicId);
    }

    async list(query: QueryMediaDto) {
        const where: Prisma.MediaWhereInput = {
            NOT: { folder: 'avatars' },
            type: query.type,
            folder:
                query.folder === undefined
                    ? undefined
                    : query.folder === 'legacy'
                      ? ''
                      : this.safeFolder(query.folder),
            uploadedBy: query.uploaderPublicId ? { publicId: query.uploaderPublicId } : undefined,
            createdAt:
                query.from || query.to
                    ? {
                          gte: query.from ? new Date(query.from) : undefined,
                          lte: query.to ? new Date(query.to) : undefined
                      }
                    : undefined,
            OR: query.search
                ? [
                      { title: { contains: query.search } },
                      { originalName: { contains: query.search } },
                      { altText: { contains: query.search } },
                      { caption: { contains: query.search } }
                  ]
                : undefined
        };
        const skip = (query.page - 1) * query.limit;
        const [items, total] = await this.prisma.$transaction([
            this.prisma.media.findMany({
                where,
                include: publicMediaInclude,
                orderBy: { createdAt: 'desc' },
                skip,
                take: query.limit
            }),
            this.prisma.media.count({ where })
        ]);
        return {
            data: items.map((item) => this.toPublicMedia(item)),
            meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
        };
    }

    async folders() {
        const folders = await this.prisma.media.groupBy({
            by: ['folder'],
            where: { folder: { not: 'avatars' } },
            _count: { _all: true },
            _sum: { size: true },
            orderBy: { folder: 'asc' }
        });
        return folders.map((item) => ({
            folder: item.folder || 'legacy',
            count: item._count._all,
            totalSize: item._sum.size ?? 0
        }));
    }

    async details(publicId: string) {
        const media = await this.prisma.media.findUnique({ where: { publicId }, include: publicMediaInclude });
        if (!media) throw new NotFoundException('Không tìm thấy media');
        return this.toPublicMedia(media);
    }

    async usage(publicId: string) {
        const media = await this.prisma.media.findUnique({
            where: { publicId },
            include: {
                lessons: {
                    select: {
                        publicId: true,
                        title: true,
                        section: { select: { class: { select: { publicId: true, code: true, name: true } } } }
                    }
                }
            }
        });
        if (!media) throw new NotFoundException('Không tìm thấy media');
        return { publicId, usageCount: media.lessons.length, lessons: media.lessons };
    }

    async update(publicId: string, dto: UpdateMediaDto, actor: JwtPayload) {
        const media = await this.requireManageable(publicId, actor);
        let folder = media.folder;
        let fileMoved = false;
        if (dto.folder !== undefined) {
            const targetFolder = this.safeFolder(dto.folder);
            if (targetFolder !== folder) {
                await this.moveStoredFile(media, targetFolder);
                folder = targetFolder;
                fileMoved = true;
            }
        }
        try {
            const updated = await this.prisma.media.update({
                where: { id: media.id },
                data: {
                    title: this.optionalText(dto.title),
                    altText: this.optionalText(dto.altText),
                    caption: this.optionalText(dto.caption),
                    description: this.optionalText(dto.description),
                    folder
                },
                include: publicMediaInclude
            });
            await this.record(actor.sub, AuditAction.UPDATE, publicId, { folder, title: updated.title });
            return this.toPublicMedia(updated);
        } catch (error) {
            if (fileMoved)
                await this.moveStoredFile({ folder, filename: media.filename }, media.folder).catch(() => undefined);
            throw error;
        }
    }

    async replace(publicId: string, file: UploadedMediaFile | undefined, actor: JwtPayload) {
        const media = await this.requireManageable(publicId, actor);
        const normalized = await this.normalize(file);
        if (normalized.type !== media.type) {
            const usageCount = await this.prisma.lesson.count({ where: { mediaId: media.id } });
            if (usageCount)
                throw new ConflictException({
                    code: 'MEDIA_TYPE_IN_USE',
                    message: 'Không thể đổi loại media khi tệp đang được sử dụng trong bài học',
                    currentType: media.type,
                    replacementType: normalized.type,
                    usageCount
                });
        }
        const filename = `${randomUUID()}.${normalized.extension}`;
        const newPath = this.pathFor(media.folder, filename);
        await mkdir(resolve(this.root, media.folder), { recursive: true });
        await writeFile(newPath, normalized.buffer, { flag: 'wx' });
        try {
            const updated = await this.prisma.media.update({
                where: { id: media.id },
                data: {
                    type: normalized.type,
                    filename,
                    originalName: file!.originalname.slice(0, 191),
                    mimeType: normalized.mimeType,
                    size: normalized.buffer.length,
                    width: normalized.width,
                    height: normalized.height
                },
                include: publicMediaInclude
            });
            await unlink(this.pathFor(media.folder, media.filename)).catch(() => undefined);
            await this.record(actor.sub, AuditAction.UPDATE, publicId, {
                replaced: true,
                type: updated.type,
                size: updated.size
            });
            return this.toPublicMedia(updated);
        } catch (error) {
            await unlink(newPath).catch(() => undefined);
            throw error;
        }
    }

    async remove(publicId: string, actor: JwtPayload) {
        const media = await this.requireManageable(publicId, actor);
        const usageCount = await this.prisma.lesson.count({ where: { mediaId: media.id } });
        if (usageCount)
            throw new ConflictException({
                code: 'MEDIA_IN_USE',
                message: 'Không thể xóa media đang được sử dụng trong bài học',
                usageCount
            });
        await this.prisma.media.delete({ where: { id: media.id } });
        await unlink(this.pathFor(media.folder, media.filename)).catch(() => undefined);
        await this.record(actor.sub, AuditAction.DELETE, publicId, {
            originalName: media.originalName,
            permanentlyDeleted: true
        });
        return { message: 'Đã xóa media vĩnh viễn' };
    }

    async bulkRemove(publicIds: string[], actor: JwtPayload) {
        const results: Array<{ publicId: string; deleted: boolean; message?: string }> = [];
        for (const publicId of publicIds) {
            try {
                await this.remove(publicId, actor);
                results.push({ publicId, deleted: true });
            } catch (error) {
                results.push({
                    publicId,
                    deleted: false,
                    message: error instanceof Error ? error.message : 'Không thể xóa media'
                });
            }
        }
        return {
            deletedCount: results.filter((item) => item.deleted).length,
            failedCount: results.filter((item) => !item.deleted).length,
            results
        };
    }

    async bulkMove(dto: BulkMoveMediaDto, actor: JwtPayload) {
        const folder = this.safeFolder(dto.folder);
        const results: Array<{ publicId: string; moved: boolean; message?: string }> = [];
        for (const publicId of dto.publicIds) {
            try {
                const media = await this.requireManageable(publicId, actor);
                if (media.folder !== folder) {
                    await this.moveStoredFile(media, folder);
                    try {
                        await this.prisma.media.update({ where: { id: media.id }, data: { folder } });
                    } catch (error) {
                        await this.moveStoredFile({ folder, filename: media.filename }, media.folder).catch(
                            () => undefined
                        );
                        throw error;
                    }
                }
                results.push({ publicId, moved: true });
            } catch (error) {
                results.push({
                    publicId,
                    moved: false,
                    message: error instanceof Error ? error.message : 'Không thể chuyển thư mục'
                });
            }
        }
        await this.record(actor.sub, AuditAction.UPDATE, 'bulk', { folder, count: results.length });
        return {
            movedCount: results.filter((item) => item.moved).length,
            failedCount: results.filter((item) => !item.moved).length,
            results
        };
    }

    async requireMedia(publicId: string, type: MediaType) {
        const media = await this.prisma.media.findUnique({ where: { publicId } });
        if (!media || media.type !== type)
            throw new BadRequestException('Media không tồn tại hoặc không đúng loại');
        return media;
    }

    async open(publicId: string) {
        const media = await this.prisma.media.findUnique({ where: { publicId } });
        if (!media) throw new NotFoundException('Không tìm thấy media');
        const path = this.pathFor(media.folder, media.filename);
        try {
            const fileStat = await stat(path);
            return {
                stream: createReadStream(path),
                mimeType: media.mimeType,
                size: fileStat.size,
                originalName: media.originalName,
                type: media.type,
                updatedAt: media.updatedAt
            };
        } catch {
            throw new NotFoundException('Tệp media không còn tồn tại');
        }
    }

    private async upload(
        file: UploadedMediaFile | undefined,
        dto: UploadMediaDto,
        uploaderPublicId: string,
        expectedType?: MediaType
    ) {
        const normalized = await this.normalize(file);
        if (expectedType && normalized.type !== expectedType)
            throw new BadRequestException(`Tệp tải lên phải có loại ${expectedType}`);
        const uploader = await this.prisma.user.findUnique({
            where: { publicId: uploaderPublicId },
            select: { id: true }
        });
        if (!uploader) throw new NotFoundException('Không tìm thấy người tải lên');
        const folder = this.safeFolder(dto.folder ?? this.defaultFolder());
        const filename = `${randomUUID()}.${normalized.extension}`;
        const path = this.pathFor(folder, filename);
        await mkdir(resolve(this.root, folder), { recursive: true });
        await writeFile(path, normalized.buffer, { flag: 'wx' });
        try {
            const media = await this.prisma.media.create({
                data: {
                    type: normalized.type,
                    filename,
                    originalName: file!.originalname.slice(0, 191),
                    mimeType: normalized.mimeType,
                    size: normalized.buffer.length,
                    title: this.optionalText(dto.title) ?? parse(file!.originalname).name.slice(0, 191),
                    altText: this.optionalText(dto.altText),
                    caption: this.optionalText(dto.caption),
                    description: this.optionalText(dto.description),
                    folder,
                    width: normalized.width,
                    height: normalized.height,
                    uploadedById: uploader.id
                },
                include: publicMediaInclude
            });
            await this.record(uploaderPublicId, AuditAction.CREATE, media.publicId, {
                type: media.type,
                mimeType: media.mimeType,
                size: media.size,
                folder
            });
            return this.toPublicMedia(media);
        } catch (error) {
            await unlink(path).catch(() => undefined);
            throw error;
        }
    }

    private async normalize(file: UploadedMediaFile | undefined): Promise<NormalizedFile> {
        if (!file?.buffer?.length) throw new BadRequestException('Vui lòng chọn tệp tải lên');
        const policy = await this.settings.uploadPolicy();
        if (file.mimetype.startsWith('image/')) return this.normalizeImage(file, policy);
        if (file.mimetype === 'application/pdf') {
            this.assertSize(file.buffer.length, policy.pdfMaxMb, 'Tệp PDF');
            if (file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-')
                throw new BadRequestException('Tệp tải lên không phải PDF hợp lệ');
            return { type: MediaType.PDF, extension: 'pdf', mimeType: 'application/pdf', buffer: file.buffer };
        }
        const documentExtensions: Record<string, string> = {
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/vnd.ms-excel': 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-powerpoint': 'ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
            'text/plain': 'txt',
            'text/csv': 'csv'
        };
        if (documentExtensions[file.mimetype]) {
            this.assertSize(file.buffer.length, policy.documentMaxMb, 'Tài liệu');
            return {
                type: MediaType.DOCUMENT,
                extension: documentExtensions[file.mimetype],
                mimeType: file.mimetype,
                buffer: file.buffer
            };
        }
        throw new BadRequestException('Định dạng tệp chưa được hỗ trợ');
    }

    private async normalizeImage(file: UploadedMediaFile, policy: UploadPolicy): Promise<NormalizedFile> {
        this.assertSize(file.buffer.length, policy.imageMaxMb, 'Hình ảnh');
        try {
            const buffer = await sharp(file.buffer)
                .rotate()
                .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: policy.webpQuality, effort: 4 })
                .toBuffer();
            const metadata = await sharp(buffer).metadata();
            return {
                type: MediaType.IMAGE,
                extension: 'webp',
                mimeType: 'image/webp',
                buffer,
                width: metadata.width,
                height: metadata.height
            };
        } catch {
            throw new BadRequestException('Tệp tải lên không phải hình ảnh hợp lệ');
        }
    }

    private async requireManageable(publicId: string, actor: JwtPayload) {
        const media = await this.prisma.media.findUnique({
            where: { publicId },
            include: { uploadedBy: { select: { publicId: true } } }
        });
        if (!media) throw new NotFoundException('Không tìm thấy media');
        const elevated = actor.role === UserRole.ADMIN || actor.role === UserRole.PRINCIPAL;
        if (!elevated && media.uploadedBy?.publicId !== actor.sub)
            throw new ForbiddenException('Bạn chỉ được quản lý media do mình tải lên');
        return media;
    }

    private async moveStoredFile(media: { folder: string; filename: string }, targetFolder: string) {
        const source = this.pathFor(media.folder, media.filename);
        const target = this.pathFor(targetFolder, media.filename);
        await mkdir(resolve(this.root, targetFolder), { recursive: true });
        try {
            await rename(source, target);
        } catch {
            throw new NotFoundException('Tệp media không còn tồn tại để chuyển thư mục');
        }
    }

    private pathFor(folder: string, filename: string) {
        const path = resolve(this.root, folder, filename);
        if (path !== this.root && !path.startsWith(`${this.root}\\`) && !path.startsWith(`${this.root}/`))
            throw new BadRequestException('Đường dẫn media không hợp lệ');
        return path;
    }

    private safeFolder(value: string) {
        const folder = String(value || 'common')
            .replace(/\\/g, '/')
            .split('/')
            .map((part) =>
                [...part.trim()]
                    .map((character) =>
                        character.charCodeAt(0) < 32 || '<>:"|?*'.includes(character) ? '-' : character,
                    )
                    .join(''),
            )
            .filter((part) => part && part !== '.' && part !== '..')
            .join('/');
        return (folder || 'common').slice(0, 191);
    }

    private defaultFolder() {
        const now = new Date();
        return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    private assertSize(size: number, maxMb: number, label: string) {
        if (size > maxMb * 1024 * 1024)
            throw new BadRequestException(`${label} không được vượt quá ${maxMb} MB`);
    }

    private optionalText(value: string | undefined) {
        if (value === undefined) return undefined;
        return value.trim() || null;
    }

    private toPublicMedia(media: Prisma.MediaGetPayload<{ include: typeof publicMediaInclude }>) {
        return {
            id: media.publicId,
            publicId: media.publicId,
            fileName: media.filename,
            originalName: media.originalName,
            mimeType: media.mimeType,
            size: media.size,
            url: `/api/v1/media/${media.publicId}`,
            type: media.type,
            title: media.title,
            altText: media.altText,
            caption: media.caption,
            description: media.description,
            folder: media.folder || 'legacy',
            width: media.width,
            height: media.height,
            usageCount: media._count.lessons,
            uploadedBy: media.uploadedBy,
            createdAt: media.createdAt,
            updatedAt: media.updatedAt
        };
    }

    private record(
        actorPublicId: string,
        action: AuditAction,
        targetPublicId: string,
        newValue: Prisma.InputJsonValue
    ) {
        return this.audit.record({
            actorPublicId,
            action,
            module: 'media',
            targetType: 'Media',
            targetPublicId,
            newValue
        });
    }
}
