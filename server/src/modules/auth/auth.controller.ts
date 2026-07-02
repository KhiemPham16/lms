import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.login(dto, req);

        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
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

    private getCookie(request: Request, name: string) {
        const cookies = (request as unknown as { cookies?: Record<string, unknown> }).cookies;
        const value = cookies?.[name];

        return typeof value === 'string' ? value : undefined;
    }
}
