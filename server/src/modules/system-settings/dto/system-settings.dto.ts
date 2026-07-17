import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateTokenPolicyDto {
    @ApiPropertyOptional({ example: 15 }) @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(1440) accessTokenMinutes?: number;
    @ApiPropertyOptional({ example: 7 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) refreshTokenDays?: number;
    @ApiPropertyOptional({ example: 5 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) maxActiveSessions?: number;
}

export class UpdateUploadPolicyDto {
    @ApiPropertyOptional({ example: 10 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) imageMaxMb?: number;
    @ApiPropertyOptional({ example: 25 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pdfMaxMb?: number;
    @ApiPropertyOptional({ example: 25 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) documentMaxMb?: number;
    @ApiPropertyOptional({ example: 82 }) @IsOptional() @Type(() => Number) @IsInt() @Min(40) @Max(100) webpQuality?: number;
}

export class UpdateMailSettingsDto {
    @ApiPropertyOptional({ example: 'smtp.gmail.com' }) @IsOptional() @IsString() @MaxLength(255) host?: string;
    @ApiPropertyOptional({ example: 587 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) port?: number;
    @ApiPropertyOptional({ example: false }) @IsOptional() @IsBoolean() secure?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) user?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) from?: string;
}

export class TestMailDto {
    @ApiProperty({ example: 'admin@example.com' }) @IsEmail() recipient: string;
}

export class UpdateRedisSettingsDto {
    @ApiPropertyOptional({ example: 'localhost' }) @IsOptional() @IsString() @MaxLength(255) host?: string;
    @ApiPropertyOptional({ example: 6379 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) port?: number;
    @ApiPropertyOptional({ example: false }) @IsOptional() @IsBoolean() tls?: boolean;
}

export class UpdateGradingPolicyDto {
    @ApiPropertyOptional({ example: 5 }) @IsOptional() @Type(() => Number) @Min(0) @Max(10) defaultPassScore?: number;
    @ApiPropertyOptional({ example: 5 }) @IsOptional() @Type(() => Number) @Min(0) @Max(10) finalEligibilityScore?: number;
    @ApiPropertyOptional({ example: 10 }) @IsOptional() @Type(() => Number) @Min(1) @Max(100) scoreScale?: number;
}

export class UpdateMaintenanceDto {
    @ApiProperty({ example: true }) @IsBoolean() enabled: boolean;
    @ApiPropertyOptional({ example: 'Hệ thống đang bảo trì, vui lòng quay lại sau.' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    message?: string;
}
