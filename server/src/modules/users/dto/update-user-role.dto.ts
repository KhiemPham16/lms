import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateUserRoleDto {
    @ApiPropertyOptional({ example: 'STUDENT' })
    @IsOptional()
    @IsString()
    role?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    roleId?: number;
}
