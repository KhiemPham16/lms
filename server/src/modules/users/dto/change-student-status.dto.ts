import { ApiProperty } from '@nestjs/swagger';
import { StudentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeStudentStatusDto {
    @ApiProperty({ enum: StudentStatus, example: StudentStatus.RESERVED })
    @IsEnum(StudentStatus)
    status: StudentStatus;
}
