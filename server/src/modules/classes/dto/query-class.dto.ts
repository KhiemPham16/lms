import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryClassDto {
    @ApiPropertyOptional({ example: 'JAVA101' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ enum: ClassStatus })
    @IsOptional()
    @IsEnum(ClassStatus)
    status?: ClassStatus;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    courseId?: number;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    lecturerId?: number;

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
