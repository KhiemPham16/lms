import { AuditAction } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryAuditDto {
    @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
    @IsOptional() @IsString() module?: string;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
