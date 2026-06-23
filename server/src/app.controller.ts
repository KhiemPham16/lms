import { Controller, Get } from '@nestjs/common';
import { AppHealthService } from './app-health.service';

@Controller()
export class AppController {
    constructor(private readonly appHealthService: AppHealthService) {}

    @Get()
    healthCheck() {
        return {
            status: 'ok',
            service: 'lms-api',
            apiCount: this.appHealthService.getApiCount(),
            timestamp: new Date()
        };
    }
}
