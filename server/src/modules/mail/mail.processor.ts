import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { MailService } from './mail.service';

@Processor('mail')
export class MailProcessor extends WorkerHost {
    constructor(private readonly mailService: MailService) {
        super();
    }

    async process(job: Job) {
        switch (job.name) {
            case 'forgot-password':
                return this.mailService.sendForgotPassword(job.data);

            default:
                throw new Error(`Unknown mail job: ${job.name}`);
        }
    }
}
