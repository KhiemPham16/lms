import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateLessonSectionDto {
    @ApiProperty({ example: 'Chuong 1: Nhap mon' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ example: 'Cac bai hoc nen hoc dau tien' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    sortOrder?: number;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;
}
