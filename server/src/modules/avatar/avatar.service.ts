import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { SystemSettingsService } from '../system-settings/system-settings.service';

export type UploadedAvatarFile = {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
};

@Injectable()
export class AvatarService {
    private readonly root = resolve(process.cwd(), 'storage/avatars');

    constructor(private readonly settings: SystemSettingsService) {}

    async upload(file: UploadedAvatarFile | undefined) {
        if (!file?.buffer?.length) throw new BadRequestException('Vui lòng chọn ảnh đại diện');
        if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Tệp tải lên phải là hình ảnh');
        const policy = await this.settings.uploadPolicy();
        if (file.buffer.length > policy.imageMaxMb * 1024 * 1024) {
            throw new BadRequestException(`Hình ảnh không được vượt quá ${policy.imageMaxMb} MB`);
        }

        let buffer: Buffer;
        try {
            buffer = await sharp(file.buffer)
                .rotate()
                .resize(512, 512, { fit: 'cover', position: 'centre', withoutEnlargement: true })
                .webp({ quality: policy.webpQuality, effort: 4 })
                .toBuffer();
        } catch {
            throw new BadRequestException('Tệp tải lên không phải hình ảnh hợp lệ');
        }

        const filename = `${randomUUID()}.webp`;
        await mkdir(this.root, { recursive: true });
        await writeFile(this.pathFor(filename), buffer, { flag: 'wx' });
        return { filename, url: `/api/v1/avatars/${filename}` };
    }

    async removeByUrl(url: string | null | undefined) {
        const filename = this.filenameFromUrl(url);
        if (!filename) return false;
        await unlink(this.pathFor(filename)).catch(() => undefined);
        return true;
    }

    async open(filename: string) {
        if (!this.isValidFilename(filename)) throw new NotFoundException('Không tìm thấy ảnh đại diện');
        const path = this.pathFor(filename);
        try {
            const fileStat = await stat(path);
            return { stream: createReadStream(path), size: fileStat.size, updatedAt: fileStat.mtime };
        } catch {
            throw new NotFoundException('Không tìm thấy ảnh đại diện');
        }
    }

    private filenameFromUrl(url: string | null | undefined) {
        const filename = url?.match(/\/avatars\/([^/?#]+)/)?.[1];
        return filename && this.isValidFilename(filename) ? filename : null;
    }

    private isValidFilename(filename: string) {
        return /^[0-9a-f-]{36}\.webp$/i.test(filename);
    }

    private pathFor(filename: string) {
        return resolve(this.root, filename);
    }
}
