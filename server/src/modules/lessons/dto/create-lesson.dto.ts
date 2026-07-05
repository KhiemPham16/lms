import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { CodeConfigDto } from './code-lesson.dto';

export class CreateLessonDto {
    @ApiPropertyOptional({ example: 'section-public-id' })
    @IsOptional()
    @IsString()
    sectionPublicId?: string;

    @ApiProperty({ example: 'Gioi thieu tong quan' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ example: 'Noi dung nen hoc truoc khi vao chuong 1' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ enum: LessonType, example: LessonType.TEXT })
    @IsOptional()
    @IsEnum(LessonType)
    type?: LessonType;

    @ApiPropertyOptional({ example: 'Noi dung bai hoc...' })
    @IsOptional()
    @IsString()
    content?: string;

    @ApiPropertyOptional({ example: 'https://example.com/video.mp4' })
    @IsOptional()
    @IsString()
    resourceUrl?: string;

    @ApiPropertyOptional({ type: CodeConfigDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => CodeConfigDto)
    codeConfig?: CodeConfigDto;

    @ApiPropertyOptional({ example: 45 })
    @IsOptional()
    @IsInt()
    @Min(1)
    durationMinutes?: number;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    sortOrder?: number;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;
}
