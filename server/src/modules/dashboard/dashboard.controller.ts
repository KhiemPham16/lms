import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
    constructor(private readonly dashboard: DashboardService) {}

    @Get()
    get(@CurrentUser() user: JwtPayload) {
        return this.dashboard.get(user);
    }
}
