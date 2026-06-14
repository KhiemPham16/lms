import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '~/prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

    findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email }
        });
    }

    findByPublicId(publicId: string) {
        return this.prisma.user.findUnique({
            where: { publicId },
            select: this.defaultSelect()
        });
    }

    async findByPublicIdOrThrow(publicId: string) {
        const user = await this.findByPublicId(publicId);

        if (!user) {
            throw new NotFoundException('Không tìm thấy người dùng');
        }

        return user;
    }

    updateLastLogin(userId: number) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                lastLoginAt: new Date()
            }
        });
    }

    updateResetPasswordOtp(userId: number, otp: string, expiresAt: Date) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                resetPasswordOtp: otp,
                resetPasswordOtpExpiresAt: expiresAt
            }
        });
    }

    clearResetPasswordOtp(userId: number) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                resetPasswordOtp: null,
                resetPasswordOtpExpiresAt: null
            }
        });
    }

    updatePassword(userId: number, password: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                password
            }
        });
    }

    findByPublicIdRaw(publicId: string) {
        return this.prisma.user.findUnique({
            where: {
                publicId
            }
        });
    }

    createSession(userId: number, refreshToken: string, expiresAt: Date) {
        return this.prisma.session.create({
            data: {
                userId,
                refreshToken,
                expiresAt
            }
        });
    }

    findActiveSessionsByUserId(userId: number) {
        return this.prisma.session.findMany({
            where: {
                userId,
                expiresAt: {
                    gt: new Date()
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    deleteSession(sessionId: number) {
        return this.prisma.session.delete({
            where: {
                id: sessionId
            }
        });
    }

    deleteSessionsByUserId(userId: number) {
        return this.prisma.session.deleteMany({
            where: {
                userId
            }
        });
    }

    private defaultSelect() {
        return {
            publicId: true,
            code: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            gender: true,
            avatarUrl: true,
            departmentId: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true
        };
    }
}
