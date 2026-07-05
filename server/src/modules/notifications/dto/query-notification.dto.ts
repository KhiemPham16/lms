import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryNotificationDto {
    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ example: 20 })
    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsInt()
    @Min(1)
    limit?: number;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    unreadOnly?: boolean;

    @ApiPropertyOptional({ example: 'LESSON_PUBLISHED' })
    @IsOptional()
    @IsString()
    type?: string;
}
