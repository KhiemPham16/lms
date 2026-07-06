import { ApiPropertyOptional } from '@nestjs/swagger';
import { LessonContentType, LessonStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class QueryLessonDto {
    @ApiPropertyOptional({ example: 'Java' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ example: 'class-public-id' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsString()
    classPublicId?: string;

    @ApiPropertyOptional({ example: 1 })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsInt()
    classId?: number;

    @ApiPropertyOptional({ example: 1 })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsInt()
    courseId?: number;

    @ApiPropertyOptional({ example: 1 })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsInt()
    departmentId?: number;

    @ApiPropertyOptional({ example: 1 })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsInt()
    lecturerId?: number;

    @ApiPropertyOptional({ enum: LessonStatus })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsEnum(LessonStatus)
    status?: LessonStatus;

    @ApiPropertyOptional({ enum: LessonContentType })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsEnum(LessonContentType)
    contentType?: LessonContentType;

    @ApiPropertyOptional({ example: true })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsBoolean()
    hasLinkedExam?: boolean;

    @ApiPropertyOptional({ example: true })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsBoolean()
    hasVideo?: boolean;

    @ApiPropertyOptional({ example: true })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsBoolean()
    hasAttachment?: boolean;

    @ApiPropertyOptional({ example: '2026-08-01' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsDateString()
    createdFrom?: string;

    @ApiPropertyOptional({ example: '2026-08-31' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsDateString()
    publishedFrom?: string;

    @ApiPropertyOptional({ example: 1 })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ example: 10 })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number = 10;
}
