import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { AvatarService } from './avatar.service';

@Controller('avatars')
export class AvatarController {
    constructor(private readonly avatars: AvatarService) {}

    @Get(':filename')
    async read(@Param('filename') filename: string, @Res({ passthrough: true }) response: Response) {
        const avatar = await this.avatars.open(filename);
        response.setHeader('Cache-Control', 'public, max-age=3600');
        response.setHeader('Last-Modified', avatar.updatedAt.toUTCString());
        return new StreamableFile(avatar.stream, { type: 'image/webp', length: avatar.size });
    }
}
