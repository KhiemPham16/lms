import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AssignCourseDepartmentHeadDto {
    @ApiProperty({ example: 5 })
    @IsInt()
    departmentHeadId: number;
}
