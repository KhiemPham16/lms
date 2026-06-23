import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateClassDto {
    @ApiProperty({ example: 'JAVA101-01' })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({ example: 'Lớp Java 01' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 6 })
    @IsInt()
    lecturerId: number;

    @ApiProperty({ example: 40 })
    @IsInt()
    @Min(1)
    maxStudents: number;

    @ApiProperty({ example: '2026-08-01' })
    @IsDateString()
    startDate: string;

    @ApiProperty({ example: '2026-12-15' })
    @IsDateString()
    endDate: string;

    @ApiPropertyOptional({ enum: ClassStatus, example: ClassStatus.OPEN })
    @IsOptional()
    @IsEnum(ClassStatus)
    status?: ClassStatus;
}
