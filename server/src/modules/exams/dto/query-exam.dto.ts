import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

const toBoolean = (value: unknown) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
};

export class QueryExamDto {
    @ApiPropertyOptional({ example: 'quiz' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @Transform(({ value }) => toBoolean(value))
    @IsBoolean()
    isPublished?: boolean;
}
