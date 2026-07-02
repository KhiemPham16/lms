import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class AssignClassHeadDto {
    @ApiProperty({ example: 5 })
    @IsInt()
    departmentHeadId: number;

    @ApiPropertyOptional({ example: '2026-08-01' })
    @IsOptional()
    @IsDateString()
    startsAt?: string;

    @ApiPropertyOptional({ example: 'Phân công quản lý lớp HK1' })
    @IsOptional()
    @IsString()
    note?: string;
}
