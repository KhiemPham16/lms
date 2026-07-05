import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateCourseDto {
    @ApiProperty({ example: 'JAVA101' })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({ example: 'Lap trinh Java co ban' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: 'Mon hoc co san trong giao trinh' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 3 })
    @IsInt()
    @Min(1)
    credits: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    departmentId: number;

    @ApiPropertyOptional({ example: 5 })
    @IsOptional()
    @IsInt()
    departmentHeadId?: number;

    @ApiPropertyOptional({ example: 2 })
    @IsOptional()
    @IsInt()
    @Min(0)
    requestedClassCount?: number;
}
