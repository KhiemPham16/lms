import { UserStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeUserStatusDto {
    @IsEnum(UserStatus)
    status: UserStatus;
}
