import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength
} from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({
        example: 'example@gmail.com'
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        example: '770686'
    })
    @IsString()
    @IsNotEmpty()
    otp: string;

    @ApiProperty({
        example: '12345678'
    })
    @IsString()
    @MinLength(6)
    newPassword: string;
}