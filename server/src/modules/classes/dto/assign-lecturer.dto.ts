import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AssignLecturerDto {
    @ApiProperty({ example: 6 })
    @IsInt()
    lecturerId: number;
}
