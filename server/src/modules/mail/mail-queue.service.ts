import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class MailQueueService {
    constructor(
        @InjectQueue('mail')
        private readonly mailQueue: Queue
    ) {}

    async sendForgotPassword(data: { email: string; fullName: string; otp: string }) {
        return this.addMailJob('forgot-password', data);
    }

    private addMailJob(name: string, data: unknown) {
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
