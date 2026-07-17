import { Injectable } from '@nestjs/common';
import * as ejs from 'ejs';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import { readFile } from 'fs/promises';
import { ActivationMailData, ForgotPasswordMailData } from './mail.types';
import { SystemSettingsService } from '../system-settings/system-settings.service';

const templateRenderer = ejs as {
    render: (template: string, data: Record<string, unknown>) => string;
};

@Injectable()
export class MailService {
    private readonly templatesPath = path.join(__dirname, 'templates');

    constructor(private readonly settings: SystemSettingsService) {}

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
                account: data.account,
                password: data.password,
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
        const config = await this.settings.mailRuntimeConfig();
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: { user: config.user, pass: config.pass },
            tls: { rejectUnauthorized: false }
        });

        await transporter.sendMail({
            from: config.from,
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
