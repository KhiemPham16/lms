import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        example: 'example@gmail.com'
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        example: 'Lms@123'
    })
    @IsString()
    @IsNotEmpty()
    password: string;
}
