import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateExamDto {
    @ApiPropertyOptional({ example: 'section-public-id' })
    @IsOptional()
    @IsString()
    sectionPublicId?: string;

    @ApiPropertyOptional({ example: 'lesson-public-id' })
    @IsOptional()
    @IsString()
    lessonPublicId?: string;

    @ApiProperty({ example: 'Quiz chuong 1' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ example: 'Bai kiem tra trac nghiem sau chuong 1' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: 45 })
    @IsOptional()
    @IsInt()
    @Min(1)
    durationMinutes?: number;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    maxAttempts?: number;

    @ApiPropertyOptional({ example: 5 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(10)
    passScore?: number;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;
}
