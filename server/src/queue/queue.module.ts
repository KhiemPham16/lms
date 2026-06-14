import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                connection: {
                    host: config.get<string>('redis.host'),
                    port: config.get<number>('redis.port') ?? 6379,
                    password: config.get<string>('redis.password'),
                    tls: config.get<boolean>('redis.tls') ? {} : undefined,
                    lazyConnect: true,
                    maxRetriesPerRequest: null
                }
            })
        })
    ],
    exports: [BullModule]
})
export class QueueModule {}
