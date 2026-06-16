import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
    @ApiProperty({ example: 'CNTT' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    code: string;

    @ApiProperty({ example: 'Khoa Công Nghệ Thông Tin' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;
}
