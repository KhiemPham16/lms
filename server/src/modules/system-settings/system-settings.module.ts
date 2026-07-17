import { Global, Module } from '@nestjs/common';
import { MaintenanceMiddleware } from './maintenance.middleware';
import { SystemSettingsController } from './system-settings.controller';
import { SystemSettingsService } from './system-settings.service';

@Global()
@Module({
    controllers: [SystemSettingsController],
    providers: [SystemSettingsService, MaintenanceMiddleware],
    exports: [SystemSettingsService, MaintenanceMiddleware]
})
export class SystemSettingsModule {}
