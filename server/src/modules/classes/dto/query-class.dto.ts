import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class QueryClassDto {
    @ApiPropertyOptional({ example: 'JAVA101' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ enum: ClassStatus })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsEnum(ClassStatus)
    status?: ClassStatus;

    @ApiPropertyOptional({ example: 1 })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsInt()
    courseId?: number;

    @ApiPropertyOptional({ example: 1 })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsInt()
    lecturerId?: number;

    @ApiPropertyOptional({ example: 1 })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsInt()
    departmentId?: number;

    @ApiPropertyOptional({ example: 1 })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsInt()
    departmentHeadId?: number;

    @ApiPropertyOptional({ example: 'HK1' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsString()
    semester?: string;

    @ApiPropertyOptional({ example: '2026-2027' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsString()
    academicYear?: string;

    @ApiPropertyOptional({ example: true })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsBoolean()
    hasAvailableSlots?: boolean;

    @ApiPropertyOptional({ example: true })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsBoolean()
    isFull?: boolean;

    @ApiPropertyOptional({ example: 'open' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsString()
    registrationStatus?: string;

    @ApiPropertyOptional({ example: '2026-08-01' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsDateString()
    startFrom?: string;

    @ApiPropertyOptional({ example: '2026-12-15' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsDateString()
    endTo?: string;

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
