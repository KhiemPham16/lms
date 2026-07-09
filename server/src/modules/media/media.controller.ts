import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';

import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { Permissions } from '~/common/decorators/permissions.decorator';
import { JwtAuthGuard, type JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/common/guards/permissions.guard';
import { QueryMediaDto } from './dto/query-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import {
    MAX_MEDIA_SIZE,
    mediaDestination,
    mediaFileFilter,
    mediaFileName
} from './media-upload.util';
import { MediaService, type UploadedMediaFile } from './media.service';

@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('media')
export class MediaController {
    constructor(private readonly mediaService: MediaService) {}

    @Post('upload')
    @Permissions('media.create')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: mediaDestination,
                filename: mediaFileName
            }),
            fileFilter: mediaFileFilter,
            limits: {
                fileSize: MAX_MEDIA_SIZE
            }
        })
    )
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
                alt: { type: 'string' },
                folder: { type: 'string', example: 'lessons' }
            },
            required: ['file']
        }
    })
    @ApiOperation({ summary: 'Upload media' })
    upload(
        @UploadedFile() file: UploadedMediaFile | undefined,
        @Body() dto: UpdateMediaDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.mediaService.upload(user.sub, file, dto);
    }

    @Get()
    @Permissions('media.read')
    @ApiOperation({ summary: 'Danh sach media' })
    findAll(@Query() query: QueryMediaDto, @CurrentUser() user: JwtPayload) {
        return this.mediaService.findAll(query, user.sub);
    }

    @Get(':publicId')
    @Permissions('media.read')
    @ApiOperation({ summary: 'Chi tiet media' })
    findOne(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.mediaService.findOne(publicId, user.sub);
    }

    @Patch(':publicId')
    @Permissions('media.create')
    @ApiOperation({ summary: 'Cap nhat media' })
    update(@Param('publicId') publicId: string, @Body() dto: UpdateMediaDto, @CurrentUser() user: JwtPayload) {
        return this.mediaService.update(publicId, dto, user.sub);
    }

    @Delete(':publicId')
    @Permissions('media.create')
    @ApiOperation({ summary: 'Xoa media' })
    remove(@Param('publicId') publicId: string, @CurrentUser() user: JwtPayload) {
        return this.mediaService.remove(publicId, user.sub);
    }
}
