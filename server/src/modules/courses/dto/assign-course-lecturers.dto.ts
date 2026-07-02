import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class AssignCourseLecturersDto {
    @ApiProperty({ example: [6, 7], type: [Number] })
    @IsArray()
    @ArrayMinSize(1)
    @IsInt({ each: true })
    lecturerIds: number[];
}
