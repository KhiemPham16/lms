import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateRolePermissionsDto {
    @ApiPropertyOptional({ example: ['users.read', 'users.create'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    permissionCodes?: string[];

    @ApiPropertyOptional({ example: [1, 2] })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    permissionIds?: number[];
}
