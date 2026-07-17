import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '~/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export const SYSTEM_SETTING_KEYS = [
    'token-policy',
    'upload-policy',
    'mail',
    'redis',
    'grading-policy',
    'maintenance'
] as const;
export type SystemSettingKey = (typeof SYSTEM_SETTING_KEYS)[number];

export type TokenPolicy = { accessTokenMinutes: number; refreshTokenDays: number; maxActiveSessions: number };
export type UploadPolicy = {
    imageMaxMb: number;
    pdfMaxMb: number;
    documentMaxMb: number;
    webpQuality: number;
};
export type MailSettings = { host: string; port: number; secure: boolean; user: string; from: string };
export type RedisSettings = { host: string; port: number; tls: boolean };
export type GradingPolicy = { defaultPassScore: number; finalEligibilityScore: number; scoreScale: number };
export type MaintenanceSettings = { enabled: boolean; message: string };
type SettingMap = {
    'token-policy': TokenPolicy;
    'upload-policy': UploadPolicy;
    mail: MailSettings;
    redis: RedisSettings;
    'grading-policy': GradingPolicy;
    maintenance: MaintenanceSettings;
};

@Injectable()
export class SystemSettingsService {
    private readonly cache = new Map<SystemSettingKey, SettingMap[SystemSettingKey]>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly audit: AuditService
    ) {}

    async list() {
        const rows = await this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
        const byKey = new Map(rows.map((row) => [row.key, row]));
        return Promise.all(
            SYSTEM_SETTING_KEYS.map(async (key) => {
                const row = byKey.get(key);
                return { key, value: await this.get(key), updatedAt: row?.updatedAt ?? null };
            })
        );
    }

    async getByKey(key: string) {
        if (!this.isKey(key)) throw new BadRequestException('Khóa cấu hình không hợp lệ');
        return { key, value: await this.get(key) };
    }

    tokenPolicy() {
        return this.get('token-policy');
    }

    uploadPolicy() {
        return this.get('upload-policy');
    }

    gradingPolicy() {
        return this.get('grading-policy');
    }

    maintenance() {
        return this.get('maintenance');
    }

    async update<K extends SystemSettingKey>(key: K, patch: Partial<SettingMap[K]>, actorPublicId: string) {
        const actor = await this.prisma.user.findUniqueOrThrow({
            where: { publicId: actorPublicId },
            select: { id: true }
        });
        const value = { ...(await this.get(key)), ...patch };
        const row = await this.prisma.systemSetting.upsert({
            where: { key },
            create: { key, value: value, updatedById: actor.id },
            update: { value: value, updatedById: actor.id }
        });
        this.cache.set(key, value);
        await this.audit.record({
            actorPublicId,
            action: AuditAction.UPDATE,
            module: 'cau-hinh-he-thong',
            targetType: 'SystemSetting',
            targetPublicId: key,
            newValue: value
        });
        return { key, value, updatedAt: row.updatedAt, requiresRestart: key === 'redis' };
    }

    reload() {
        this.cache.clear();
        return { message: 'Đã tải lại cấu hình hệ thống từ cơ sở dữ liệu' };
    }

    async testMail(recipient: string) {
        const setting = await this.get('mail');
        const transporter = nodemailer.createTransport({
            host: setting.host,
            port: setting.port,
            secure: setting.secure,
            auth: { user: setting.user, pass: this.config.get<string>('mail.pass') },
            tls: { rejectUnauthorized: false }
        });
        await transporter.verify();
        await transporter.sendMail({
            from: setting.from,
            to: recipient,
            subject: '[LMS] Kiểm tra cấu hình email',
            text: 'Cấu hình email của hệ thống LMS đang hoạt động bình thường.'
        });
        return { message: 'Đã gửi thư kiểm tra thành công' };
    }

    async testRedis() {
        const setting = await this.get('redis');
        const redis = new Redis({
            host: setting.host,
            port: setting.port,
            password: this.config.get<string>('redis.password'),
            tls: setting.tls ? {} : undefined,
            lazyConnect: true,
            connectTimeout: 5000,
            maxRetriesPerRequest: 1
        });
        try {
            await redis.connect();
            const pong = await redis.ping();
            return { message: 'Kết nối Redis thành công', response: pong };
        } finally {
            redis.disconnect();
        }
    }

    async mailRuntimeConfig() {
        const setting = await this.get('mail');
        return { ...setting, pass: this.config.get<string>('mail.pass') };
    }

    private async get<K extends SystemSettingKey>(key: K): Promise<SettingMap[K]> {
        const cached = this.cache.get(key);
        if (cached) return cached as SettingMap[K];
        const row = await this.prisma.systemSetting.findUnique({ where: { key } });
        const value = { ...this.defaults()[key], ...this.jsonObject(row?.value) } as SettingMap[K];
        this.cache.set(key, value);
        return value;
    }

    private defaults(): SettingMap {
        return {
            'token-policy': { accessTokenMinutes: 15, refreshTokenDays: 7, maxActiveSessions: 5 },
            'upload-policy': {
                imageMaxMb: 10,
                pdfMaxMb: 25,
                documentMaxMb: 25,
                webpQuality: 82
            },
            mail: {
                host: this.config.get<string>('mail.host') ?? '',
                port: this.config.get<number>('mail.port') ?? 587,
                secure: this.config.get<boolean>('mail.secure') ?? false,
                user: this.config.get<string>('mail.user') ?? '',
                from: this.config.get<string>('mail.from') ?? ''
            },
            redis: {
                host: this.config.get<string>('redis.host') ?? 'localhost',
                port: this.config.get<number>('redis.port') ?? 6379,
                tls: this.config.get<boolean>('redis.tls') ?? false
            },
            'grading-policy': { defaultPassScore: 5, finalEligibilityScore: 5, scoreScale: 10 },
            maintenance: { enabled: false, message: 'Hệ thống đang bảo trì, vui lòng quay lại sau.' }
        };
    }

    private jsonObject(value: Prisma.JsonValue | undefined) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    private isKey(key: string): key is SystemSettingKey {
        return SYSTEM_SETTING_KEYS.includes(key as SystemSettingKey);
    }
}
