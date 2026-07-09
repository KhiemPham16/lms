import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ActivateAccountDto {
    @ApiProperty({ example: 'activation-token' })
    @IsString()
    @IsNotEmpty()
    token: string;
}
