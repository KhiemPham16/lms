import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonContentType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class LessonBlockDto {
    @ApiProperty({ enum: LessonContentType, example: LessonContentType.TEXT })
    @IsEnum(LessonContentType)
    type: LessonContentType;

    @ApiPropertyOptional({ example: 'Mục tiêu bài học' })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional({ example: 'Nội dung chi tiết của block' })
    @IsOptional()
    @IsString()
    content?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/file.pdf' })
    @IsOptional()
    @IsString()
    fileUrl?: string;

    @ApiPropertyOptional({ example: 'tailieu.pdf' })
    @IsOptional()
    @IsString()
    fileName?: string;

    @ApiPropertyOptional({ example: 102400 })
    @IsOptional()
    @IsInt()
    @Min(0)
    fileSize?: number;

    @ApiPropertyOptional({ example: 'application/pdf' })
    @IsOptional()
    @IsString()
    mimeType?: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Min(1)
    orderIndex: number;
}
