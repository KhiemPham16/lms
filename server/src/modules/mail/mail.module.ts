import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { MailQueueService } from './mail-queue.service';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'mail'
        })
    ],
    providers: [MailService, MailProcessor, MailQueueService],
    exports: [MailQueueService]
})
export class MailModule { }
