import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    Matches,
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
        example: 'Lms@123'
    })
    @IsString()
    @MinLength(6)
    @Matches(/[A-Z]/, { message: 'Mat khau phai co it nhat 1 chu hoa' })
    @Matches(/[^A-Za-z0-9]/, { message: 'Mat khau phai co it nhat 1 ky tu dac biet' })
    newPassword: string;
}
