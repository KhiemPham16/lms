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
        return this.mailQueue.add('forgot-password', data, {
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
