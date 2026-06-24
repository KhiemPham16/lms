import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '~/prisma/prisma.service';

export type JwtPayload = {
    sub: string;
    role?: string;
    roleId?: number;
    permissions?: string[];
};

export type AuthenticatedRequest = Request & {
    user: JwtPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();

        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Token không tồn tại');
        }

        const token = authHeader.split(' ')[1];

        const secret = this.configService.get<string>('auth.accessJwtSecret');

        if (!secret) {
            throw new Error('auth.accessJwtSecret is missing');
        }

        try {
            const payload = await this.jwtService.verifyAsync<JwtPayload>(
                token,
                { secret }
            );

            const user = await this.prisma.user.findFirst({
                where: {
                    publicId: payload.sub,
                    deletedAt: null
                },
                select: {
                    status: true
                }
            });

            if (!user || user.status === 'INACTIVE') {
                throw new ForbiddenException('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ bộ phận quản trị để được hỗ trợ.');
            }

            request.user = {
                sub: payload.sub,
                role: payload.role,
                roleId: payload.roleId
            };

            return true;
        } catch (error) {
            if (error instanceof ForbiddenException) {
                throw error;
            }
            throw new UnauthorizedException('Token không hợp lệ');
        }
    }
}
