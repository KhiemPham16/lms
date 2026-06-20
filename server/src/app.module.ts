import { Module } from '@nestjs/common';
import { AppController } from '~/app.controller';
import { PrismaModule } from '~/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import configuration from '~/config/env.config';

import { QueueModule } from './queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { RolesModule } from './modules/roles/roles.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration]
        }),

        PrismaModule,
        QueueModule,
        AuthModule,
        UsersModule,
        DepartmentsModule,
        RolesModule
    ],
    controllers: [AppController],
    providers: []
})
export class AppModule {}
