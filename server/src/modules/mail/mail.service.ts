import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ejs from 'ejs';
import * as nodemailer from 'nodemailer';
import * as path from 'path';

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

    async sendForgotPassword(data: { email: string; fullName: string; otp: string }) {
        return this.sendMail({
            to: data.email,
            subject: '[LMS] Đặt lại mật khẩu',
            template: 'forgot-password',
            data: {
                fullName: data.fullName,
                otp: data.otp
            }
        });
    }

    async sendActivation(data: { email: string; fullName: string; status: string }) {
        return this.sendMail({
            to: data.email,
            subject: '[LMS] Kich hoat tai khoan',
            template: 'activation',
            data: {
                fullName: data.fullName,
                status: data.status
            }
        });
    }

    private async sendMail(options: { to: string; subject: string; template: string; data: Record<string, unknown> }) {
        const html = await this.renderTemplate(options.template, options.data);

        return this.transporter.sendMail({
            from: this.configService.get<string>('mail.from'),
            to: options.to,
            subject: options.subject,
            html
        });
    }

    private renderTemplate(templateName: string, data: Record<string, unknown>) {
        return ejs.renderFile(path.join(this.templatesPath, `${templateName}.ejs`), data);
    }
}
