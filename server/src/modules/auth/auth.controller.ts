import { Body, Controller, Delete, Get, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard, type AuthenticatedRequest } from '~/common/guards/jwt-auth.guard';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import type { UploadedAvatarFile } from '../avatar/avatar.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.login(dto);

        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: result.refreshTokenMaxAgeMs
        });

        return {
            message: result.message,
            accessToken: result.accessToken
        };
    }

    @Post('refresh')
    refresh(@Req() req: Request) {
        return this.authService.refresh(this.getCookie(req, 'refreshToken'));
    }

    @Post('logout')
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.logout(this.getCookie(req, 'refreshToken'));

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: false,
            sameSite: 'lax'
        });

        return result;
    }

    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @Post('reset-password')
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: JwtPayload) {
        return this.authService.changePassword(user.sub, dto);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    me(@Req() req: AuthenticatedRequest) {
        return this.authService.me(req.user.sub);
    }

    @Post('avatar')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
    updateAvatar(@UploadedFile() file: UploadedAvatarFile | undefined, @CurrentUser() user: JwtPayload) {
        return this.authService.updateAvatar(user.sub, file);
    }

    @Delete('avatar')
    @UseGuards(JwtAuthGuard)
    removeAvatar(@CurrentUser() user: JwtPayload) {
        return this.authService.removeAvatar(user.sub);
    }

    @Post('activate')
    activate(@Body() dto: ActivateAccountDto) {
        return this.authService.activate(dto.token);
    }

    private getCookie(request: Request, name: string) {
        const cookies = (request as unknown as { cookies?: Record<string, unknown> }).cookies;
        const value = cookies?.[name];

        return typeof value === 'string' ? value : undefined;
    }
}
