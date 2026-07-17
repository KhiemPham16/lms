import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
    @ApiProperty({ example: 'CNTT' })
    @IsString()
    @Length(2, 30)
    code: string;

    @ApiProperty({ example: 'Công nghệ thông tin' })
    @IsString()
    @Length(2, 150)
    name: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;
}
