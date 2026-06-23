import {
    IsDateString,
    IsEmail,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    Min,
    MinLength
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, UserStatus } from '@prisma/client';

export class CreateUserDto {
    @ApiPropertyOptional({ example: '922210001', description: 'Bỏ trống để hệ thống tự sinh mã theo role và năm khóa' })
    @IsOptional()
    @IsString()
    code?: string;

    @ApiProperty({ example: 'Student One' })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ example: 'student1@lms.com' })
    @IsEmail()
    email: string;

    @ApiPropertyOptional({ example: '0901234567' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: '123456' })
    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    @ApiPropertyOptional({ example: 'STUDENT' })
    @IsOptional()
    @IsString()
    role?: string;

    @ApiPropertyOptional({ example: 4 })
    @IsOptional()
    @IsInt()
    roleId?: number;

    @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.ACTIVE })
    @IsOptional()
    @IsEnum(UserStatus)
    status?: UserStatus;

    @ApiPropertyOptional({ enum: Gender, example: Gender.MALE })
    @IsOptional()
    @IsEnum(Gender)
    gender?: Gender;

    @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
    @IsOptional()
    @IsString()
    avatarUrl?: string;

    @ApiPropertyOptional({ example: '2004-01-01' })
    @IsOptional()
    @IsDateString()
    dateOfBirth?: string;

    @ApiPropertyOptional({ example: 'TP. Hồ Chí Minh' })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    departmentId?: number;

    @ApiPropertyOptional({ example: 2022, description: 'Năm khóa/năm định danh để sinh mã người dùng' })
    @IsOptional()
    @IsInt()
    @Min(2000)
    @Max(2099)
    cohortYear?: number;
}
