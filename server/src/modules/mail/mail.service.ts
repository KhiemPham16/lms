import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ejs from 'ejs';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import { readFile } from 'fs/promises';
import { ActivationMailData, ForgotPasswordMailData } from './mail.types';

const templateRenderer = ejs as {
    render: (template: string, data: Record<string, unknown>) => string;
};

@Injectable()
export class MailService {
    private readonly transporter: nodemailer.Transporter;
    private readonly templatesPath = path.join(process.cwd(), 'src', 'modules', 'mail', 'templates');

    constructor(private readonly configService: ConfigService) {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get<string>('mail.host'),
            port: this.configService.get<number>('mail.port'),
            secure: this.configService.get<boolean>('mail.secure'),
            auth: {
                user: this.configService.get<string>('mail.user'),
                pass: this.configService.get<string>('mail.pass')
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        this.transporter.verify().catch((error) => {
            console.error('[MAIL_VERIFY_ERROR]', error);
        });
    }

    async sendForgotPassword(data: ForgotPasswordMailData): Promise<void> {
        await this.sendMail({
            to: data.email,
            subject: '[LMS] Đặt lại mật khẩu',
            template: 'forgot-password',
            data: {
                fullName: data.fullName,
                otp: data.otp
            }
        });
    }

    async sendActivation(data: ActivationMailData): Promise<void> {
        await this.sendMail({
            to: data.email,
            subject: '[LMS] Kích hoạt tài khoản',
            template: 'activation',
            data: {
                fullName: data.fullName,
                status: data.status,
                activationUrl: data.activationUrl,
                expiresAt: data.expiresAt
            }
        });
    }

    private async sendMail(options: {
        to: string;
        subject: string;
        template: string;
        data: Record<string, unknown>;
    }): Promise<void> {
        const html = await this.renderTemplate(options.template, options.data);

        await this.transporter.sendMail({
            from: this.configService.get<string>('mail.from'),
            to: options.to,
            subject: options.subject,
            html
        });
    }

    private async renderTemplate(templateName: string, data: Record<string, unknown>) {
        const template = await readFile(path.join(this.templatesPath, `${templateName}.ejs`), 'utf8');
        return templateRenderer.render(template, data);
    }
}
