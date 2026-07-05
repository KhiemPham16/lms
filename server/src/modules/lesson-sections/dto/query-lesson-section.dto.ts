import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QueryLessonSectionDto {
    @ApiPropertyOptional({ example: 'chuong 1' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    isPublished?: boolean;
}
