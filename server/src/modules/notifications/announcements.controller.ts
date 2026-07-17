import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Roles } from '~/common/decorators/roles.decorator';
import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import { AnnouncementsService } from './announcements.service';
import {
    CreateAnnouncementDto,
    QueryAnnouncementDto,
    ScheduleAnnouncementDto,
    UpdateAnnouncementDto
} from './dto/announcement.dto';

@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
    constructor(private readonly announcements: AnnouncementsService) {}

    @Get('feed')
    feed(@CurrentUser() user: JwtPayload) {
        return this.announcements.feed(user.sub);
    }

    @Get()
    @Roles(UserRole.ADMIN)
    list(@Query() query: QueryAnnouncementDto) {
        return this.announcements.list(query);
    }

    @Get(':publicId')
    @Roles(UserRole.ADMIN)
    findOne(@Param('publicId') publicId: string) {
        return this.announcements.findOne(publicId);
    }

    @Post()
    @Roles(UserRole.ADMIN)
    create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: JwtPayload) {
        return this.announcements.create(dto, user.sub);
    }

    @Patch(':publicId')
    @Roles(UserRole.ADMIN)
    update(
        @Param('publicId') publicId: string,
        @Body() dto: UpdateAnnouncementDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.announcements.update(publicId, dto, user.sub);
    }

    @Post(':publicId/publish')
    @Roles(UserRole.ADMIN)
    publish(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.announcements.publish(publicId, user.sub);
    }

    @Post(':publicId/schedule')
    @Roles(UserRole.ADMIN)
    schedule(
        @Param('publicId') publicId: string,
        @Body() dto: ScheduleAnnouncementDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.announcements.schedule(publicId, dto.scheduledAt, user.sub);
    }

    @Post(':publicId/cancel')
    @Roles(UserRole.ADMIN)
    cancel(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.announcements.cancel(publicId, user.sub);
    }

    @Delete(':publicId')
    @Roles(UserRole.ADMIN)
    remove(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.announcements.remove(publicId, user.sub);
    }
}
