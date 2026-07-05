import { ApiPropertyOptional } from '@nestjs/swagger';
import { LessonType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryLessonDto {
    @ApiPropertyOptional({ example: 'section-public-id' })
    @IsOptional()
    @IsString()
    sectionPublicId?: string;

    @ApiPropertyOptional({ example: 'mo dau' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ enum: LessonType })
    @IsOptional()
    @IsEnum(LessonType)
    type?: LessonType;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    isPublished?: boolean;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ example: 20 })
    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number;
}
