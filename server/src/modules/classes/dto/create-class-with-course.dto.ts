import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

import { CreateClassDto } from './create-class.dto';

export class CreateClassWithCourseDto extends CreateClassDto {
    @ApiProperty({ example: 'course-public-id' })
    @IsString()
    @IsNotEmpty()
    coursePublicId: string;
}
