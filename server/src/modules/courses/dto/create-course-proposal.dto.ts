import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateCourseProposalDto {
    @ApiProperty({ example: 'JAVA101' })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({ example: 'Lập trình JavaScript cơ bản' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: 'Môn học nhập môn về JavaScript và OOP' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 3 })
    @IsInt()
    @Min(1)
    credits: number;

    @ApiProperty({ example: 2 })
    @IsInt()
    @Min(1)
    requestedClassCount: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    departmentId: number;
}
