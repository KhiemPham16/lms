import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonContentType, LessonStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { LessonBlockDto } from './lesson-block.dto';

export class CreateLessonDto {
    @ApiProperty({ example: 'class-public-id' })
    @IsString()
    @IsNotEmpty()
    classPublicId: string;

    @ApiProperty({ example: 'Giới thiệu Java căn bản' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ example: 'Tổng quan về ngôn ngữ Java' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: 'Tuần 1' })
    @IsOptional()
    @IsString()
    chapter?: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Min(1)
    orderIndex: number;

    @ApiPropertyOptional({ example: 45 })
    @IsOptional()
    @IsInt()
    @Min(0)
    durationMinutes?: number;

    @ApiPropertyOptional({ enum: LessonStatus, example: LessonStatus.DRAFT })
    @IsOptional()
    @IsEnum(LessonStatus)
    status?: LessonStatus;

    @ApiPropertyOptional({ enum: LessonContentType, example: LessonContentType.TEXT })
    @IsOptional()
    @IsEnum(LessonContentType)
    primaryContentType?: LessonContentType;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    allowStudentView?: boolean;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    allowDownload?: boolean;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    requirePreviousCompletion?: boolean;

    @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    availableFrom?: string;

    @ApiPropertyOptional({ example: '2026-12-01T00:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    availableUntil?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    trackProgress?: boolean;

    @ApiPropertyOptional({ type: [LessonBlockDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LessonBlockDto)
    blocks?: LessonBlockDto[];
}
