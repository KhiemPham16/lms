import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class BulkAssignRoleDto {
    @ApiProperty({ example: ['7d4bcefd-1e46-4ed7-9b90-ff4bb0df89ef'] })
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    userIds: string[];

    @ApiPropertyOptional({ example: 'STUDENT' })
    @IsOptional()
    @IsString()
    role?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    roleId?: number;
}
