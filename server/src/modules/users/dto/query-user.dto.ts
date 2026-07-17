import { EmploymentStatus, StudentStatus, UserRole, UserStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryUserDto {
    @IsOptional() @IsString() search?: string;
    @IsOptional() @IsEnum(UserRole) role?: UserRole;
    @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
    @IsOptional() @IsEnum(StudentStatus) studentStatus?: StudentStatus;
    @IsOptional() @IsEnum(EmploymentStatus) employmentStatus?: EmploymentStatus;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 100;
}
