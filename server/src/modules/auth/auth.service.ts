import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { SignOptions } from 'jsonwebtoken';

import { PrismaService } from '~/prisma/prisma.service';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MailQueueService } from '../mail/mail-queue.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { MediaService } from '../media/media.service';
import { AvatarService, type UploadedAvatarFile } from '../avatar/avatar.service';

const accountNotActiveError = (status: UserStatus) =>
    new ForbiddenException({ code: 'ACCOUNT_NOT_ACTIVE', status, message: 'Tài khoản không hoạt động' });

type RefreshTokenPayload = JwtPayload & { type?: string };

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly mailQueueService: MailQueueService,
        private readonly audit: AuditService,
        private readonly settings: SystemSettingsService,
        private readonly avatars: AvatarService,
        private readonly media: MediaService
    ) {}

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

        if (!user || !(await bcrypt.compare(dto.password, user.password))) {
            throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
        }
        if (user.status !== UserStatus.ACTIVE) throw accountNotActiveError(user.status);

        const tokenPolicy = await this.settings.tokenPolicy();
        const tokenPayload = { publicId: user.publicId, role: user.role };
        const accessToken = await this.generateAccessToken(tokenPayload);
        const refreshToken = await this.generateRefreshToken(tokenPayload, tokenPolicy.refreshTokenDays);
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

        const activeSessions = await this.prisma.session.findMany({
            where: { userId: user.id, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' },
            select: { id: true }
        });
        const sessionsToRemove = activeSessions.slice(Math.max(0, tokenPolicy.maxActiveSessions - 1));

        await this.prisma.$transaction([
            this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
            this.prisma.session.deleteMany({ where: { id: { in: sessionsToRemove.map((session) => session.id) } } }),
            this.prisma.session.create({
                data: {
                    userId: user.id,
                    refreshToken: hashedRefreshToken,
                    expiresAt: new Date(Date.now() + tokenPolicy.refreshTokenDays * 24 * 60 * 60 * 1000)
                }
            })
        ]);

        await this.audit.record({ actorPublicId: user.publicId, action: AuditAction.LOGIN, module: 'xac-thuc', targetType: 'User', targetPublicId: user.publicId });

        return {
            message: 'Đăng nhập thành công',
            accessToken,
            refreshToken,
            refreshTokenMaxAgeMs: tokenPolicy.refreshTokenDays * 24 * 60 * 60 * 1000
        };
    }

    async me(publicId: string) {
        const user = await this.prisma.user.findUnique({
            where: { publicId },
            select: {
                publicId: true,
                code: true,
                fullName: true,
                email: true,
                role: true,
                status: true,
                lastLoginAt: true,
                avatarUrl: true,
                department: { select: { publicId: true, code: true, name: true } }
            }
        });
        if (!user) throw new UnauthorizedException('Người dùng không tồn tại');
        return user;
    }

    async updateAvatar(publicId: string, file: UploadedAvatarFile | undefined) {
        const user = await this.prisma.user.findUnique({
            where: { publicId },
            select: { id: true, publicId: true, role: true, avatarUrl: true }
        });
        if (!user) throw new UnauthorizedException('Người dùng không tồn tại');

        const uploaded = await this.avatars.upload(file);
        try {
            await this.prisma.user.update({
                where: { id: user.id },
                data: { avatarUrl: uploaded.url }
            });
        } catch (error) {
            await this.avatars.removeByUrl(uploaded.url);
            throw error;
        }

        await this.audit.record({
            actorPublicId: publicId,
            action: AuditAction.UPDATE,
            module: 'ho-so-ca-nhan',
            targetType: 'User',
            targetPublicId: publicId,
            newValue: { avatarUrl: uploaded.url }
        });
        await this.removePreviousAvatar(user.avatarUrl, publicId, user.role);

        return { message: 'Đã cập nhật ảnh đại diện', avatarUrl: uploaded.url };
    }

    async removeAvatar(publicId: string) {
        const user = await this.prisma.user.findUnique({
            where: { publicId },
            select: { id: true, publicId: true, role: true, avatarUrl: true }
        });
        if (!user) throw new UnauthorizedException('Người dùng không tồn tại');

        await this.prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
        await this.audit.record({
            actorPublicId: publicId,
            action: AuditAction.UPDATE,
            module: 'ho-so-ca-nhan',
            targetType: 'User',
            targetPublicId: publicId,
            newValue: { avatarUrl: null }
        });
        await this.removePreviousAvatar(user.avatarUrl, publicId, user.role);

        return { message: 'Đã xóa ảnh đại diện', avatarUrl: null };
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (user) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            await this.prisma.user.update({
                where: { id: user.id },
                data: { resetPasswordOtp: otp, resetPasswordOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000) }
            });
            await this.mailQueueService.sendForgotPassword({
                email: user.email,
                fullName: user.fullName,
                otp
            });
        }
        return { message: 'Nếu email tồn tại, hệ thống sẽ gửi mã đặt lại mật khẩu' };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user || user.resetPasswordOtp !== dto.otp || !user.resetPasswordOtpExpiresAt) {
            throw new BadRequestException('Mã OTP không hợp lệ');
        }
        if (user.resetPasswordOtpExpiresAt < new Date()) throw new BadRequestException('Mã OTP đã hết hạn');

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: user.id },
                data: {
                    password: await bcrypt.hash(dto.newPassword, 10),
                    resetPasswordOtp: null,
                    resetPasswordOtpExpiresAt: null
                }
            }),
            this.prisma.session.deleteMany({ where: { userId: user.id } })
        ]);
        await this.audit.record({ actorPublicId: user.publicId, action: AuditAction.RESET_PASSWORD, module: 'xac-thuc', targetType: 'User', targetPublicId: user.publicId });
        return { message: 'Đặt lại mật khẩu thành công' };
    }

    async changePassword(publicId: string, dto: ChangePasswordDto) {
        const user = await this.prisma.user.findUnique({ where: { publicId } });
        if (!user) throw new UnauthorizedException('Người dùng không tồn tại');

        const currentPasswordIsValid = await bcrypt.compare(dto.currentPassword, user.password);
        if (!currentPasswordIsValid) throw new BadRequestException('Mật khẩu hiện tại không đúng');

        const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);
        if (isSamePassword) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');

        const password = await bcrypt.hash(
            dto.newPassword,
            this.configService.get<number>('auth.bcryptRounds') ?? 10
        );

        await this.prisma.$transaction([
            this.prisma.user.update({ where: { id: user.id }, data: { password } }),
            this.prisma.session.deleteMany({ where: { userId: user.id } })
        ]);

        await this.audit.record({
            actorPublicId: publicId,
            action: AuditAction.CHANGE_PASSWORD,
            module: 'xac-thuc',
            targetType: 'User',
            targetPublicId: publicId
        });

        return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại' };
    }

    async activate(token: string) {
        const user = await this.prisma.user.findUnique({ where: { activationToken: token } });
        if (!user || !user.activationTokenExpiresAt || user.activationTokenExpiresAt < new Date()) {
            throw new BadRequestException('Liên kết kích hoạt không hợp lệ hoặc đã hết hạn');
        }
        await this.prisma.user.update({
            where: { id: user.id },
            data: { status: UserStatus.ACTIVE, activationToken: null, activationTokenExpiresAt: null }
        });
        return { message: 'Kích hoạt tài khoản thành công' };
    }

    async refresh(refreshToken?: string) {
        if (!refreshToken) throw new UnauthorizedException('Mã làm mới không tồn tại');
        const payload = await this.verifyRefreshToken(refreshToken);
        const user = await this.prisma.user.findUnique({ where: { publicId: payload.sub }, include: { sessions: true } });
        if (!user) throw new UnauthorizedException('Người dùng không tồn tại');
        if (user.status !== UserStatus.ACTIVE) throw accountNotActiveError(user.status);

        const session = await this.findSession(user.sessions, refreshToken);
        if (!session) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');

        return {
            message: 'Làm mới phiên đăng nhập thành công',
            accessToken: await this.generateAccessToken({ publicId: user.publicId, role: user.role })
        };
    }

    async logout(refreshToken?: string) {
        if (refreshToken) {
            try {
                const payload = await this.verifyRefreshToken(refreshToken);
                const user = await this.prisma.user.findUnique({ where: { publicId: payload.sub }, include: { sessions: true } });
                if (user) {
                    const session = await this.findSession(user.sessions, refreshToken);
                    if (session) await this.prisma.session.delete({ where: { id: session.id } });
                }
            } catch {
                // Đăng xuất luôn trả kết quả thành công để không làm lộ trạng thái của mã làm mới.
            }
        }
        return { message: 'Đăng xuất thành công' };
    }

    private async generateAccessToken(user: { publicId: string; role: UserRole }) {
        const policy = await this.settings.tokenPolicy();
        return this.jwtService.signAsync(
            { sub: user.publicId, role: user.role },
            { secret: this.requiredSecret('auth.accessJwtSecret'), expiresIn: `${policy.accessTokenMinutes}m` } as SignOptions
        );
    }

    private generateRefreshToken(user: { publicId: string; role: UserRole }, refreshTokenDays: number) {
        return this.jwtService.signAsync(
            { sub: user.publicId, role: user.role, type: 'refresh' },
            { secret: this.requiredSecret('auth.refreshJwtSecret'), expiresIn: `${refreshTokenDays}d` } as SignOptions
        );
    }

    private async verifyRefreshToken(token: string) {
        try {
            const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
                secret: this.requiredSecret('auth.refreshJwtSecret')
            });
            if (payload.type !== 'refresh') throw new Error();
            return payload;
        } catch {
            throw new UnauthorizedException('Mã làm mới không hợp lệ');
        }
    }

    private requiredSecret(key: string) {
        const secret = this.configService.get<string>(key);
        if (!secret) throw new Error(`${key} is missing`);
        return secret;
    }

    private async removePreviousAvatar(avatarUrl: string | null, publicId: string, role: UserRole) {
        if (await this.avatars.removeByUrl(avatarUrl)) return;
        const mediaPublicId = avatarUrl?.match(/\/media\/([^/?#]+)/)?.[1];
        if (!mediaPublicId) return;
        await this.media.remove(mediaPublicId, { sub: publicId, role }).catch(() => undefined);
    }

    private async findSession(sessions: Array<{ id: number; refreshToken: string; expiresAt: Date }>, token: string) {
        for (const session of sessions) {
            if (session.expiresAt > new Date() && (await bcrypt.compare(token, session.refreshToken))) return session;
        }
        return null;
    }
}
