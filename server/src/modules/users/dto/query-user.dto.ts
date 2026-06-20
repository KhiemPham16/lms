import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryUserDto {
    @ApiPropertyOptional({ example: 'student1' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ example: 'STUDENT' })
    @IsOptional()
    @IsString()
    role?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    roleId?: number;

    @ApiPropertyOptional({ enum: UserStatus })
    @IsOptional()
    @IsEnum(UserStatus)
    status?: UserStatus;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    departmentId?: number;

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
