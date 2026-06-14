import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        example: 'example@gmail.com'
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        example: '123456'
    })
    @IsString()
    @IsNotEmpty()
    password: string;
}