import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ActivationMailData, ForgotPasswordMailData, MailJob } from './mail.types';

@Injectable()
export class MailQueueService {
    constructor(
        @InjectQueue('mail')
        private readonly mailQueue: Queue<MailJob['data']>
    ) {}

    async sendForgotPassword(data: ForgotPasswordMailData) {
        return this.addMailJob('forgot-password', data);
    }

    async sendActivation(data: ActivationMailData) {
        return this.addMailJob('activation', data);
    }

    private addMailJob<TName extends MailJob['name']>(
        name: TName,
        data: Extract<MailJob, { name: TName }>['data']
    ) {
        return this.mailQueue.add(name, data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 3000
            },
            removeOnComplete: 100,
            removeOnFail: 50
        });
    }
}
