import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
    imports: [JwtModule.register({})],
    controllers: [RolesController],
    providers: [RolesService],
    exports: [RolesService]
})
export class RolesModule {}
