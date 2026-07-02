import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export enum ClassTeacherRole {
    PRIMARY = 'PRIMARY',
    ASSISTANT = 'ASSISTANT'
}

export class AssignLecturerDto {
    @ApiProperty({ example: 6 })
    @IsInt()
    lecturerId: number;

    @ApiProperty({ enum: ClassTeacherRole, example: ClassTeacherRole.PRIMARY })
    @IsEnum(ClassTeacherRole)
    role: ClassTeacherRole = ClassTeacherRole.PRIMARY;

    @ApiProperty({ example: '2026-08-01' })
    @IsOptional()
    @IsDateString()
    startsAt?: string;

    @ApiProperty({ example: 'Giảng viên chính của lớp' })
    @IsOptional()
    @IsString()
    note?: string;
}
