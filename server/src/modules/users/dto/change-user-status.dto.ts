import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class ChangeUserStatusDto {
    @ApiProperty({
        enum: UserStatus,
        example: UserStatus.ACTIVE
    })
    @IsEnum(UserStatus)
    status: UserStatus;

    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;

    @IsOptional()
    @IsBoolean()
    revokeSessions?: boolean;

    @IsOptional()
    @IsBoolean()
    sendEmail?: boolean;
}
