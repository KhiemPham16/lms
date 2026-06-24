import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class BulkUserActionDto {
    @ApiProperty({ example: ['7d4bcefd-1e46-4ed7-9b90-ff4bb0df89ef'] })
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    userIds: string[];

    @ApiPropertyOptional({ example: 'Bulk action from Admin UI' })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    revokeSessions?: boolean;
}
