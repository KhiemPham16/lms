import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { SignOptions } from 'jsonwebtoken';
import type { Request } from 'express';

import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailQueueService } from '~/modules/mail/mail-queue.service';

const accountNotActiveError = (status: string) =>
    new ForbiddenException({
        code: 'ACCOUNT_NOT_ACTIVE',
        status,
        message: 'Tai khoan khong hoat dong'
    });

type RefreshTokenPayload = JwtPayload & { type?: string };

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly mailQueueService: MailQueueService
    ) {}

    async login(dto: LoginDto, request?: Request) {
        const user = await this.usersService.findByEmail(dto.email);

        if (!user) {
            throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
        }

        if (user.status !== 'ACTIVE') {
            throw accountNotActiveError(user.status);
        }


        const isPasswordValid = await bcrypt.compare(dto.password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
        }

        if (!user.role || !user.roleId) {
            throw new UnauthorizedException('Tai khoan chua duoc gan vai tro');
        }

        const role = user.role;
        const roleId = user.roleId;

        await this.usersService.updateLastLogin(user.id);
        await this.usersService.recordLogin({ ...user, role }, request);

        const accessToken = await this.generateAccessToken({
            publicId: user.publicId,
            roleId,
            role: role.code
        });

        const refreshToken = await this.generateRefreshToken({
            publicId: user.publicId,
            roleId,
            role: role.code
        });

        const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

        await this.usersService.createSession(user.id, hashedRefreshToken, refreshTokenExpiresAt);

        return {
            message: 'Đăng nhập thành công',
            accessToken,
            refreshToken
        };
    }

    async me(publicId: string) {
        return this.usersService.findByPublicIdOrThrow(publicId);
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.usersService.findByEmail(dto.email);

        if (!user) {
            return {
                message: 'Nếu email tồn tại, hệ thống sẽ gửi mã đặt lại mật khẩu'
            };
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await this.usersService.updateResetPasswordOtp(user.id, otp, expiresAt);

        this.mailQueueService
            .sendForgotPassword({
                email: user.email,
                fullName: user.fullName,
                otp
            })
            .catch((error) => {
                console.error('[AUTH_FORGOT_PASSWORD_MAIL_QUEUE_ERROR]', error);
            });

        return {
            message: 'Nếu email tồn tại, hệ thống sẽ gửi mã đặt lại mật khẩu'
        };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const user = await this.usersService.findByEmail(dto.email);

        if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpiresAt) {
            throw new BadRequestException('OTP không hợp lệ');
        }

        if (user.resetPasswordOtp !== dto.otp) {
            throw new BadRequestException('OTP không đúng');
        }

        if (user.resetPasswordOtpExpiresAt < new Date()) {
            throw new BadRequestException('OTP đã hết hạn');
        }

        const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

        await this.usersService.updatePassword(user.id, hashedPassword);

        await this.usersService.clearResetPasswordOtp(user.id);

        return {
            message: 'Đặt lại mật khẩu thành công'
        };
    }

    activate(token: string) {
        return this.usersService.activateByToken(token);
    }

    async refresh(refreshToken?: string) {
        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token không tồn tại');
        }

        const secret = this.configService.get<string>('auth.refreshJwtSecret');

        if (!secret) {
            throw new Error('auth.refreshJwtSecret is missing');
        }

        let payload: RefreshTokenPayload;

        try {
            payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
                secret
            });
        } catch {
            throw new UnauthorizedException('Refresh token không hợp lệ');
        }

        if (payload.type !== 'refresh') {
            throw new UnauthorizedException('Refresh token không hợp lệ');
        }

        const user = await this.usersService.findByPublicIdRaw(payload.sub);

        if (!user) {
            throw new UnauthorizedException('Người dùng không tồn tại');
        }

        const userStatus = user.status;

        if (userStatus !== 'ACTIVE') {
            throw accountNotActiveError(userStatus);
        }

        const session = await this.findSessionByRefreshToken(user.id, refreshToken);

        if (!session) {
            throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
        }


        if (!user.role || !user.roleId) {
            throw new UnauthorizedException('Tai khoan chua duoc gan vai tro');
        }

        const refreshRole = user.role;
        const refreshRoleId = user.roleId;

        const accessToken = await this.generateAccessToken({
            publicId: user.publicId,
            roleId: refreshRoleId,
            role: refreshRole.code
        });

        return {
            message: 'Làm mới token thành công',
            accessToken
        };
    }

    async logout(refreshToken?: string) {
        if (!refreshToken) {
            return {
                message: 'Đăng xuất thành công'
            };
        }

        const secret = this.configService.get<string>('auth.refreshJwtSecret');

        if (!secret) {
            throw new Error('auth.refreshJwtSecret is missing');
        }

        try {
            const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
                secret
            });

            const user = await this.usersService.findByPublicIdRaw(payload.sub);

            if (user) {
                const session = await this.findSessionByRefreshToken(user.id, refreshToken);

                if (session) {
                    await this.usersService.deleteSession(session.id);
                }
            }
        } catch (error) {
            console.error('[AUTH_LOGOUT_ERROR]', error);
        }

        return {
            message: 'Đăng xuất thành công'
        };
    }

    private async generateAccessToken(user: { publicId: string; roleId: number; role: string }) {
        const expiresIn = this.configService.get<string>('auth.accessTokenExpires') ?? '15m';

        const secret = this.configService.get<string>('auth.accessJwtSecret');

        if (!secret) {
            throw new Error('auth.accessJwtSecret is missing');
        }

        return this.jwtService.signAsync(
            {
                sub: user.publicId,
                roleId: user.roleId,
                role: user.role
            },
            {
                secret,
                expiresIn
            } as SignOptions
        );
    }

    private async generateRefreshToken(user: { publicId: string; roleId: number; role: string }) {
        const expiresIn = this.configService.get<string>('auth.refreshTokenExpires') ?? '7d';

        const secret = this.configService.get<string>('auth.refreshJwtSecret');

        if (!secret) {
            throw new Error('auth.refreshJwtSecret is missing');
        }

        return this.jwtService.signAsync(
            {
                sub: user.publicId,
                roleId: user.roleId,
                role: user.role,
                type: 'refresh'
            },
            {
                secret,
                expiresIn
            } as SignOptions
        );
    }

    private async findSessionByRefreshToken(userId: number, refreshToken: string) {
        const sessions = await this.usersService.findActiveSessionsByUserId(userId);

        for (const session of sessions) {
            const isMatch = await bcrypt.compare(refreshToken, session.refreshToken);

            if (isMatch) {
                return session;
            }
        }

        return null;
    }
}
