import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalAction } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ApproveCourseDto {
    @ApiProperty({ enum: ApprovalAction, example: ApprovalAction.APPROVED })
    @IsEnum(ApprovalAction)
    action: ApprovalAction;

    @ApiPropertyOptional({ example: 'Đồng ý mở môn trong học kỳ tới' })
    @IsOptional()
    @IsString()
    note?: string;
}
