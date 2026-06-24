import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class UserStatusActionDto {
    @ApiPropertyOptional({ example: 'Vi phạm chính sách bảo mật' })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiPropertyOptional({ example: '2026-07-01T09:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    expiresAt?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    revokeSessions?: boolean;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    sendEmail?: boolean;
}
