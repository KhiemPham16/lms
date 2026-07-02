import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { MailService } from './mail.service';
import { ActivationMailData, ForgotPasswordMailData, MailJob } from './mail.types';

@Processor('mail')
export class MailProcessor extends WorkerHost {
    constructor(private readonly mailService: MailService) {
        super();
    }

    async process(job: Job<MailJob['data'], void, string>): Promise<void> {
        switch (job.name) {
            case 'forgot-password':
                if (!this.isForgotPasswordMailData(job.data)) {
                    throw new Error('Invalid forgot-password mail payload');
                }

                await this.mailService.sendForgotPassword(job.data);
                return;

            case 'activation':
                if (!this.isActivationMailData(job.data)) {
                    throw new Error('Invalid activation mail payload');
                }

                await this.mailService.sendActivation(job.data);
                return;

            default:
                throw new Error(`Unknown mail job: ${job.name}`);
        }
    }

    private isForgotPasswordMailData(data: MailJob['data']): data is ForgotPasswordMailData {
        return 'otp' in data;
    }

    private isActivationMailData(data: MailJob['data']): data is ActivationMailData {
        return 'status' in data;
    }
}
