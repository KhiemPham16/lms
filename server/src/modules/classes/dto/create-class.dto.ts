import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateClassDto {
    @ApiProperty({ example: 'JAVA101-01' })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({ example: 'Lớp Java 01' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: 'Lớp dành cho sinh viên năm 2' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: 'HK1' })
    @IsOptional()
    @IsString()
    semester?: string;

    @ApiPropertyOptional({ example: '2026-2027' })
    @IsOptional()
    @IsString()
    academicYear?: string;

    @ApiPropertyOptional({ example: 5 })
    @IsOptional()
    @IsInt()
    departmentHeadId?: number;

    @ApiPropertyOptional({ example: 6 })
    @IsOptional()
    @IsInt()
    lecturerId?: number;

    @ApiPropertyOptional({ example: 7 })
    @IsOptional()
    @IsInt()
    assistantId?: number;

    @ApiProperty({ example: 40 })
    @IsInt()
    @Min(1)
    maxStudents: number;

    @ApiPropertyOptional({ example: 15 })
    @IsOptional()
    @IsInt()
    @Min(0)
    minStudents?: number;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    allowWaitlist?: boolean;

    @ApiProperty({ example: '2026-08-01' })
    @IsDateString()
    startDate: string;

    @ApiProperty({ example: '2026-12-15' })
    @IsDateString()
    endDate: string;

    @ApiPropertyOptional({ example: 'Thứ 2, Thứ 4' })
    @IsOptional()
    @IsString()
    weeklySchedule?: string;

    @ApiPropertyOptional({ example: 'Ca sáng' })
    @IsOptional()
    @IsString()
    studyShift?: string;

    @ApiPropertyOptional({ example: 'A203' })
    @IsOptional()
    @IsString()
    room?: string;

    @ApiPropertyOptional({ example: 'https://meet.example/class' })
    @IsOptional()
    @IsString()
    onlineUrl?: string;

    @ApiPropertyOptional({ example: '2026-07-01' })
    @IsOptional()
    @IsDateString()
    registrationStartDate?: string;

    @ApiPropertyOptional({ example: '2026-07-20' })
    @IsOptional()
    @IsDateString()
    registrationEndDate?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    allowStudentDrop?: boolean;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    checkScheduleConflict?: boolean;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    autoCloseWhenFull?: boolean;

    @ApiPropertyOptional({ enum: ClassStatus, example: ClassStatus.DRAFT })
    @IsOptional()
    @IsEnum(ClassStatus)
    status?: ClassStatus;
}
