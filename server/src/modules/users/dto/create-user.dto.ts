import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, UserRole } from '@prisma/client';
import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

export class CreateUserDto {
    @ApiProperty({ example: 'Nguyễn Văn An' })
    @IsString()
    @Length(2, 150)
    fullName: string;

    @ApiProperty({ example: 'an@example.com' })
    @IsEmail()
    email: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @Matches(/^0[35789]\d{8}$/, {
        message: 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09'
    })
    phone?: string;

    @ApiProperty({ enum: UserRole })
    @IsEnum(UserRole)
    role: UserRole;

    @ApiPropertyOptional({ nullable: true })
    @IsOptional()
    @IsUUID()
    departmentPublicId?: string | null;

    @ApiPropertyOptional({ enum: Gender })
    @IsOptional()
    @IsEnum(Gender)
    gender?: Gender;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    dateOfBirth?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;
}
