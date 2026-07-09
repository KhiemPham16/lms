import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMediaDto {
    @ApiPropertyOptional({ example: 'Slide bai hoc Java' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    alt?: string;

    @ApiPropertyOptional({ example: 'lessons' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    folder?: string;
}
