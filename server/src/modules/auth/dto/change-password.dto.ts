import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty({ example: 'MatKhauCu@123' })
    @IsString()
    @MinLength(7)
    currentPassword: string;

    @ApiProperty({ example: 'MatKhauMoi@456' })
    @IsString()
    @MinLength(7)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
        message: 'Mật khẩu mới phải có chữ hoa, chữ thường, số và ký tự đặc biệt'
    })
    newPassword: string;
}
