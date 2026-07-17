import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MediaType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsDateString,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min
} from 'class-validator';

export class UploadMediaDto {
    @ApiPropertyOptional({ example: 'Ảnh lễ khai giảng' })
    @IsOptional()
    @IsString()
    @MaxLength(191)
    title?: string;

    @ApiPropertyOptional({ example: 'Sinh viên tham dự lễ khai giảng' })
    @IsOptional()
    @IsString()
    @MaxLength(191)
    altText?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    caption?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @ApiPropertyOptional({ example: 'bai-giang/java-201' })
    @IsOptional()
    @IsString()
    @MaxLength(191)
    folder?: string;
}

export class UpdateMediaDto extends PartialType(UploadMediaDto) {}

export class QueryMediaDto {
    @IsOptional() @IsString() @MaxLength(191) search?: string;
    @IsOptional() @IsEnum(MediaType) type?: MediaType;
    @IsOptional() @IsString() @MaxLength(191) folder?: string;
    @IsOptional() @IsUUID() uploaderPublicId?: string;
    @IsOptional() @IsDateString() from?: string;
    @IsOptional() @IsDateString() to?: string;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 24;
}

export class BulkMediaDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(100)
    @ArrayUnique()
    @IsUUID(undefined, { each: true })
    publicIds: string[];
}

export class BulkMoveMediaDto extends BulkMediaDto {
    @ApiProperty({ example: 'thong-bao/ngay-le' })
    @IsString()
    @MaxLength(191)
    folder: string;
}
