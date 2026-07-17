import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notifications: NotificationsService) {}
    @Get() list(@Query() query: QueryNotificationDto, @CurrentUser() user: JwtPayload) { return this.notifications.list(user.sub, query); }
    @Get('unread-count') unreadCount(@CurrentUser() user: JwtPayload) { return this.notifications.unreadCount(user.sub); }
    @Patch('read-all') markAllRead(@CurrentUser() user: JwtPayload) { return this.notifications.markAllRead(user.sub); }
    @Patch(':publicId/read') markRead(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) { return this.notifications.markRead(publicId, user.sub); }
}
