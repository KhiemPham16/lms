import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { GradebookController } from './gradebook.controller';
import { GradebookService } from './gradebook.service';

@Module({
    imports: [JwtModule.register({})],
    controllers: [GradebookController],
    providers: [GradebookService]
})
export class GradebookModule {}
