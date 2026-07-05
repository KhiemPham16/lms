import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class AssignLecturerDto {
    @ApiProperty({ example: 6 })
    @IsInt()
    lecturerId: number;

    @ApiProperty({ example: '2026-08-01' })
    @IsOptional()
    @IsDateString()
    startsAt?: string;

    @ApiProperty({ example: 'Giảng viên chính của lớp' })
    @IsOptional()
    @IsString()
    note?: string;
}
