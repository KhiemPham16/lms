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
    @MinLength(7)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
        message: 'Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt'
    })
    newPassword: string;
}
