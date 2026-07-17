import { ApiProperty } from '@nestjs/swagger';
import { EmploymentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeEmploymentStatusDto {
    @ApiProperty({ enum: EmploymentStatus, example: EmploymentStatus.ON_LEAVE })
    @IsEnum(EmploymentStatus)
    status: EmploymentStatus;
}
