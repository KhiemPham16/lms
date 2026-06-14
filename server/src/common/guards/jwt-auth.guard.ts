import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export type JwtPayload = {
    sub: string;
    role: string;
};

export type AuthenticatedRequest = Request & {
    user: JwtPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService
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

            request.user = {
                sub: payload.sub,
                role: payload.role
            };

            return true;
        } catch {
            throw new UnauthorizedException('Token không hợp lệ');
        }
    }
}