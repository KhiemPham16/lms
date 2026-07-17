import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '~/prisma/prisma.service';

export type JwtPayload = {
    sub: string;
    role: UserRole;
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
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Mã truy cập không tồn tại');
        }

        const token = authHeader.split(' ')[1];
        const secret = this.configService.get<string>('auth.accessJwtSecret');

        if (!secret) {
            throw new Error('auth.accessJwtSecret is missing');
        }

        try {
            const payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret });
            const user = await this.prisma.user.findFirst({
                where: {
                    publicId: payload.sub
                },
                select: {
                    status: true
                }
            });

            if (!user || user.status !== UserStatus.ACTIVE) {
                throw new ForbiddenException({
                    code: 'ACCOUNT_NOT_ACTIVE',
                    status: user?.status ?? 'DELETED',
                    message: 'Tài khoản không hoạt động'
                });
            }

            request.user = {
                sub: payload.sub,
                role: payload.role
            };

            return true;
        } catch (error) {
            if (error instanceof ForbiddenException) {
                throw error;
            }

            throw new UnauthorizedException('Mã truy cập không hợp lệ');
        }
    }
}
