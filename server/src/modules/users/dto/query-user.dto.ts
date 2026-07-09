import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

const toBoolean = (value: unknown) => {
    if (value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
};

const toStringArray = (value: unknown) => {
    if (value === '') return undefined;
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
    if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
    return value;
};

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

export class QueryUserDto {
    @ApiPropertyOptional({ example: 'student1' })
    @IsOptional()
    @Transform(({ value }) => emptyToUndefined(value))
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ example: 'STUDENT' })
    @IsOptional()
    @Transform(({ value }) => emptyToUndefined(value))
    @IsString()
    role?: string;

    @ApiPropertyOptional({ example: ['LECTURER', 'DEPARTMENT_HEAD'] })
    @IsOptional()
    @Transform(({ value }) => toStringArray(value))
    @IsArray()
    @IsString({ each: true })
    roles?: string[];

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    roleId?: number;

    @ApiPropertyOptional({ enum: UserStatus })
    @IsOptional()
    @Transform(({ value }) => emptyToUndefined(value))
    @IsEnum(UserStatus)
    status?: UserStatus;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    departmentId?: number;

    @ApiPropertyOptional({ example: '2026-06-01' })
    @IsOptional()
    @Transform(({ value }) => emptyToUndefined(value))
    @IsDateString()
    createdFrom?: string;

    @ApiPropertyOptional({ example: '2026-06-30' })
    @IsOptional()
    @Transform(({ value }) => emptyToUndefined(value))
    @IsDateString()
    createdTo?: string;

    @ApiPropertyOptional({ example: 'hr01' })
    @IsOptional()
    @Transform(({ value }) => emptyToUndefined(value))
    @IsString()
    createdBy?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @Transform(({ value }) => toBoolean(value))
    @IsBoolean()
    emailVerified?: boolean;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @Transform(({ value }) => toBoolean(value))
    @IsBoolean()
    roleAssigned?: boolean;

    @ApiPropertyOptional({ example: ['7d4bcefd-1e46-4ed7-9b90-ff4bb0df89ef'] })
    @IsOptional()
    @Transform(({ value }) => toStringArray(value))
    @IsArray()
    @IsString({ each: true })
    publicIds?: string[];

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ example: 10 })
    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number = 10;
}
