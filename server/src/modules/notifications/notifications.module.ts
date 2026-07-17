import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { BullModule } from '@nestjs/bullmq';
import { AnnouncementProcessor } from './announcement.processor';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

@Global()
@Module({
    imports: [BullModule.registerQueue({ name: 'announcements' })],
    controllers: [NotificationsController, AnnouncementsController],
    providers: [NotificationsService, AnnouncementsService, AnnouncementProcessor],
    exports: [NotificationsService, AnnouncementsService]
})
export class NotificationsModule {}
