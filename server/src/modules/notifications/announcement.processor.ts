import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AnnouncementsService } from './announcements.service';

@Processor('announcements')
export class AnnouncementProcessor extends WorkerHost {
    constructor(private readonly announcements: AnnouncementsService) {
        super();
    }

    async process(job: Job<{ publicId: string }>) {
        if (job.name !== 'publish') throw new Error(`Công việc thông báo không hợp lệ: ${job.name}`);
        await this.announcements.publishScheduled(job.data.publicId);
    }
}
