import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Roles } from '~/common/decorators/roles.decorator';
import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import {
    TestMailDto,
    UpdateGradingPolicyDto,
    UpdateMailSettingsDto,
    UpdateMaintenanceDto,
    UpdateRedisSettingsDto,
    UpdateTokenPolicyDto,
    UpdateUploadPolicyDto
} from './dto/system-settings.dto';
import { SystemSettingsService } from './system-settings.service';

@Controller('system-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SystemSettingsController {
    constructor(private readonly settings: SystemSettingsService) {}

    @Get() list() { return this.settings.list(); }
    @Get(':key') get(@Param('key') key: string) { return this.settings.getByKey(key); }
    @Patch('token-policy') updateToken(@Body() dto: UpdateTokenPolicyDto, @CurrentUser() user: JwtPayload) { return this.settings.update('token-policy', dto, user.sub); }
    @Patch('upload-policy') updateUpload(@Body() dto: UpdateUploadPolicyDto, @CurrentUser() user: JwtPayload) { return this.settings.update('upload-policy', dto, user.sub); }
    @Patch('mail') updateMail(@Body() dto: UpdateMailSettingsDto, @CurrentUser() user: JwtPayload) { return this.settings.update('mail', dto, user.sub); }
    @Post('mail/test') testMail(@Body() dto: TestMailDto) { return this.settings.testMail(dto.recipient); }
    @Patch('redis') updateRedis(@Body() dto: UpdateRedisSettingsDto, @CurrentUser() user: JwtPayload) { return this.settings.update('redis', dto, user.sub); }
    @Post('redis/test') testRedis() { return this.settings.testRedis(); }
    @Patch('grading-policy') updateGrading(@Body() dto: UpdateGradingPolicyDto, @CurrentUser() user: JwtPayload) { return this.settings.update('grading-policy', dto, user.sub); }
    @Patch('maintenance') updateMaintenance(@Body() dto: UpdateMaintenanceDto, @CurrentUser() user: JwtPayload) { return this.settings.update('maintenance', dto, user.sub); }
    @Post('reload') reload() { return this.settings.reload(); }
}
