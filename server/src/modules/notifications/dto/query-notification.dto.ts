import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryNotificationDto {
    @IsOptional() @Type(() => Boolean) @IsBoolean() unreadOnly?: boolean;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
