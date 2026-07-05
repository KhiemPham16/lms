import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    @Permissions('notifications.read')
    @ApiOperation({ summary: 'Danh sách thông báo của tôi' })
    findMine(@CurrentUser() user: JwtPayload, @Query() query: QueryNotificationDto) {
        return this.notificationsService.findMine(user.sub, query);
    }

    @Get('unread-count')
    @Permissions('notifications.read')
    @ApiOperation({ summary: 'Số thông báo chưa đọc' })
    unreadCount(@CurrentUser() user: JwtPayload) {
        return this.notificationsService.unreadCount(user.sub);
    }

    @Patch(':publicId/read')
    @Permissions('notifications.read')
    @ApiOperation({ summary: 'Đánh dấu đã đọc một thông báo' })
    markRead(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.notificationsService.markRead(publicId, user.sub);
    }

    @Patch('read-all')
    @Permissions('notifications.read')
    @ApiOperation({ summary: 'Đánh dấu đã đọc tất cả thông báo' })
    markAllRead(@CurrentUser() user: JwtPayload) {
        return this.notificationsService.markAllRead(user.sub);
    }
}
