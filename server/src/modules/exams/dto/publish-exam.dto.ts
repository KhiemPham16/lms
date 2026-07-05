import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class PublishExamDto {
    @ApiProperty({ example: true })
    @IsBoolean()
    isPublished: boolean;
}
