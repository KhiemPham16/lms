import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import type { Request } from 'express';

export const MAX_MEDIA_SIZE = 20 * 1024 * 1024;
export const MEDIA_UPLOAD_ROOT = join(process.cwd(), 'uploads', 'media');

const allowedMimePrefixes = ['image/', 'video/', 'application/pdf'];
const allowedMimeTypes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
];

export function sanitizeMediaFolder(folder?: string) {
    const value = (folder || 'avatars').trim().toLowerCase();
    const safeValue = value
        .split(/[\\/]+/)
        .map((segment) => segment.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''))
        .filter(Boolean)
        .join('/');

    return safeValue || 'avatars';
}

export function inferMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) return MediaType.IMAGE;
    if (mimeType.startsWith('video/')) return MediaType.VIDEO;
    return MediaType.DOCUMENT;
}

export function isAllowedMediaMimeType(mimeType: string) {
    return allowedMimePrefixes.some((prefix) => mimeType.startsWith(prefix)) || allowedMimeTypes.includes(mimeType);
}

export function buildMediaUrl(folder: string, fileName: string) {
    return `/uploads/media/${folder}/${fileName}`;
}

export function mediaDestination(req: Request, _file: unknown, callback: (error: Error | null, destination: string) => void) {
    const body = req.body as { folder?: unknown } | undefined;
    const folder = sanitizeMediaFolder(typeof body?.folder === 'string' ? body.folder : undefined);
    const destination = join(MEDIA_UPLOAD_ROOT, folder);

    mkdirSync(destination, { recursive: true });
    callback(null, destination);
}

export function mediaFileName(_req: Request, file: { originalname: string }, callback: (error: Error | null, name: string) => void) {
    const extension = extname(file.originalname || '').toLowerCase();
    callback(null, `${randomUUID()}${extension}`);
}

export function mediaFileFilter(
    _req: Request,
    file: { mimetype: string },
    callback: (error: Error | null, acceptFile: boolean) => void
) {
    if (!isAllowedMediaMimeType(file.mimetype)) {
        callback(new BadRequestException('File khong dung dinh dang ho tro'), false);
        return;
    }

    callback(null, true);
}
