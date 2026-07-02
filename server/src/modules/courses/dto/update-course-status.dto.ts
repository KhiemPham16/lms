import { ApiProperty } from '@nestjs/swagger';
import { CourseStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateCourseStatusDto {
    @ApiProperty({ enum: [CourseStatus.ACTIVE, CourseStatus.INACTIVE], example: CourseStatus.ACTIVE })
    @IsEnum(CourseStatus)
    status: CourseStatus;
}
