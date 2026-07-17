import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Res,
    StreamableFile,
    UploadedFile,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaType, UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Roles } from '~/common/decorators/roles.decorator';
import { JwtAuthGuard } from '~/common/guards/jwt-auth.guard';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import { BulkMediaDto, BulkMoveMediaDto, QueryMediaDto, UpdateMediaDto, UploadMediaDto } from './dto/media.dto';
import { MediaService, type UploadedMediaFile } from './media.service';

const MEDIA_MANAGER_ROLES = [UserRole.TRAINING_OFFICER, UserRole.DEPARTMENT_HEAD, UserRole.LECTURER];
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

@Controller('media')
export class MediaController {
    constructor(private readonly media: MediaService) {}

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...MEDIA_MANAGER_ROLES)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
    upload(
        @UploadedFile() file: UploadedMediaFile | undefined,
        @Body() dto: UploadMediaDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.media.uploadMedia(file, dto, user.sub);
    }

    @Post('images')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...MEDIA_MANAGER_ROLES)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
    uploadImage(@UploadedFile() file: UploadedMediaFile | undefined, @CurrentUser() user: JwtPayload) {
        return this.media.uploadImage(file, user.sub);
    }

    @Post('pdfs')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...MEDIA_MANAGER_ROLES)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
    uploadPdf(@UploadedFile() file: UploadedMediaFile | undefined, @CurrentUser() user: JwtPayload) {
        return this.media.uploadPdf(file, user.sub);
    }

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...MEDIA_MANAGER_ROLES)
    list(@Query() query: QueryMediaDto) {
        return this.media.list(query);
    }

    @Get('folders')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...MEDIA_MANAGER_ROLES)
    folders() {
        return this.media.folders();
    }

    @Post('bulk-delete')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...MEDIA_MANAGER_ROLES)
    bulkDelete(@Body() dto: BulkMediaDto, @CurrentUser() user: JwtPayload) {
        return this.media.bulkRemove(dto.publicIds, user);
    }

    @Patch('bulk-folder')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...MEDIA_MANAGER_ROLES)
    bulkFolder(@Body() dto: BulkMoveMediaDto, @CurrentUser() user: JwtPayload) {
        return this.media.bulkMove(dto, user);
    }

    @Get(':publicId/details')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...MEDIA_MANAGER_ROLES)
    details(@Param('publicId') publicId: string) {
        return this.media.details(publicId);
    }

    @Get(':publicId/usage')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...MEDIA_MANAGER_ROLES)
    usage(@Param('publicId') publicId: string) {
        return this.media.usage(publicId);
    }

    @Patch(':publicId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...MEDIA_MANAGER_ROLES)
    update(
        @Param('publicId') publicId: string,
        @Body() dto: UpdateMediaDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.media.update(publicId, dto, user);
    }

    @Post(':publicId/replace')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...MEDIA_MANAGER_ROLES)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
    replace(
        @Param('publicId') publicId: string,
        @UploadedFile() file: UploadedMediaFile | undefined,
        @CurrentUser() user: JwtPayload
    ) {
        return this.media.replace(publicId, file, user);
    }

    @Delete(':publicId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...MEDIA_MANAGER_ROLES)
    remove(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.media.remove(publicId, user);
    }

    @Get(':publicId')
    async read(@Param('publicId') publicId: string, @Res({ passthrough: true }) response: Response) {
        const media = await this.media.open(publicId);
        const disposition = media.type === MediaType.DOCUMENT ? 'attachment' : 'inline';
        response.setHeader('Cache-Control', 'public, max-age=3600');
        response.setHeader('Last-Modified', media.updatedAt.toUTCString());
        response.setHeader(
            'Content-Disposition',
            `${disposition}; filename*=UTF-8''${encodeURIComponent(media.originalName)}`
        );
        return new StreamableFile(media.stream, { type: media.mimeType, length: media.size });
    }
}
