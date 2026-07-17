import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    AnnouncementAudience,
    AnnouncementCategory,
    AnnouncementStatus,
    UserRole
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Max,
    Min
} from 'class-validator';

export class CreateAnnouncementDto {
    @ApiProperty({ example: 'Thông báo lịch nghỉ Quốc khánh' })
    @IsString()
    @Length(3, 200)
    title: string;

    @ApiProperty({ example: 'Nhà trường thông báo lịch nghỉ lễ...' })
    @IsString()
    @Length(3, 5000)
    message: string;

    @ApiPropertyOptional({ enum: AnnouncementCategory, default: AnnouncementCategory.GENERAL })
    @IsOptional()
    @IsEnum(AnnouncementCategory)
    category?: AnnouncementCategory;

    @ApiPropertyOptional({ enum: AnnouncementAudience, default: AnnouncementAudience.ALL })
    @IsOptional()
    @IsEnum(AnnouncementAudience)
    audience?: AnnouncementAudience;

    @ApiPropertyOptional({ enum: UserRole, isArray: true })
    @IsOptional()
    @IsArray()
    @IsEnum(UserRole, { each: true })
    targetRoles?: UserRole[];

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsUUID(undefined, { each: true })
    targetDepartmentPublicIds?: string[];

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    isPinned?: boolean;

    @ApiPropertyOptional({ example: '2026-09-03T23:59:59+07:00' })
    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}

export class UpdateAnnouncementDto extends PartialType(CreateAnnouncementDto) {}

export class ScheduleAnnouncementDto {
    @ApiProperty({ example: '2026-09-01T08:00:00+07:00' })
    @IsDateString()
    scheduledAt: string;
}

export class QueryAnnouncementDto {
    @IsOptional() @IsString() search?: string;
    @IsOptional() @IsEnum(AnnouncementStatus) status?: AnnouncementStatus;
    @IsOptional() @IsEnum(AnnouncementCategory) category?: AnnouncementCategory;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
