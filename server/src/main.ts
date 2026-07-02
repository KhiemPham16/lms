import { NestFactory } from '@nestjs/core';
import { AppModule } from '~/app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { RequestHandler } from 'express';
import { AppHealthService } from './app-health.service';

const helmetMiddleware = helmet as () => RequestHandler;
const cookieParserMiddleware = cookieParser as () => RequestHandler;

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    const port = configService.get<number>('app.port') || 3500;
    const corsOrigin = configService.get<string>('app.frontendUrl');

    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
            transformOptions: {
                enableImplicitConversion: true
            }
        })
    );

    app.use(helmetMiddleware());

    app.use(cookieParserMiddleware());

    app.enableCors({
        origin: corsOrigin,
        credentials: true
    });

    const swaggerConfig = new DocumentBuilder().setTitle('LMS API').setVersion('1.0').addBearerAuth().build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    const apiCount = Object.values(document.paths).reduce((total, pathItem) => {
        const methodCount = Object.keys(pathItem).filter((key) =>
            ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(key)
        ).length;

        return total + methodCount;
    }, 0);

    app.get(AppHealthService).setApiCount(apiCount);

    SwaggerModule.setup('api/docs', app, document);

    await app.listen(port);

    console.log(`🚀 LMS API running at http://localhost:${port}/api/v1`);
    console.log(`📚 Swagger running at http://localhost:${port}/api/docs`);
}

void bootstrap();
