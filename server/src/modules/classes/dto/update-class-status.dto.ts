import { ApiProperty } from '@nestjs/swagger';
import { ClassStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateClassStatusDto {
    @ApiProperty({ enum: ClassStatus, example: ClassStatus.OPEN_REGISTRATION })
    @IsEnum(ClassStatus)
    status: ClassStatus;
}
