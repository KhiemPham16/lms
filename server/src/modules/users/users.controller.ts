import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('me')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    me(@CurrentUser() user: JwtPayload) {
        return this.usersService.findByPublicIdOrThrow(user.sub);
    }
}
