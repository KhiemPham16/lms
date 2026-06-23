import { ApiPropertyOptional } from '@nestjs/swagger';
import { CourseStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryCourseDto {
    @ApiPropertyOptional({ example: 'Java' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ enum: CourseStatus })
    @IsOptional()
    @IsEnum(CourseStatus)
    status?: CourseStatus;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    departmentId?: number;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ example: 10 })
    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number = 10;
}
