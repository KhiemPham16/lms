import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { SystemSettingsService } from './system-settings.service';

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
    constructor(
        private readonly settings: SystemSettingsService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService
    ) {}

    async use(request: Request, response: Response, next: NextFunction) {
        const policy = await this.settings.maintenance();
        if (!policy.enabled || this.isAlwaysAvailable(request.originalUrl)) return next();
        const token = request.headers.authorization?.startsWith('Bearer ')
            ? request.headers.authorization.slice(7)
            : undefined;
        if (token) {
            try {
                const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
                    secret: this.config.get<string>('auth.accessJwtSecret')
                });
                if (payload.role === UserRole.ADMIN || payload.role === UserRole.PRINCIPAL) return next();
            } catch {
                // Trả trạng thái bảo trì thống nhất ở bên dưới.
            }
        }
        response.status(503).json({ statusCode: 503, code: 'MAINTENANCE_MODE', message: policy.message });
    }

    private isAlwaysAvailable(url: string) {
        return (
            url === '/api/v1' ||
            url.startsWith('/api/docs') ||
            url.startsWith('/api/v1/auth/login') ||
            url.startsWith('/api/v1/system-settings')
        );
    }
}
