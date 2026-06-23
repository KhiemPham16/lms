import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryAuditLogDto {
    @ApiPropertyOptional({ enum: AuditAction })
    @IsOptional()
    @IsEnum(AuditAction)
    action?: AuditAction;

    @ApiPropertyOptional({ example: 'courses' })
    @IsOptional()
    @IsString()
    module?: string;

    @ApiPropertyOptional({ example: 'Course' })
    @IsOptional()
    @IsString()
    targetType?: string;

    @ApiPropertyOptional({ example: 'c9cbbd39-9e0f-42f5-9ec5-6c512c5e96b1' })
    @IsOptional()
    @IsString()
    targetPublicId?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    actorId?: number;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ example: 20 })
    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number = 20;
}
