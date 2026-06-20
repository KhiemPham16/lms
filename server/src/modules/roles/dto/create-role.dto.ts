import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
    @ApiProperty({ example: 'HR' })
    @IsString()
    @MaxLength(50)
    code: string;

    @ApiProperty({ example: 'HR' })
    @IsString()
    @MaxLength(255)
    name: string;

    @ApiPropertyOptional({ example: 'Nhân sự' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    isSystem?: boolean;
}
