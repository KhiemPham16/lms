import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class PublishLessonDto {
    @ApiProperty({ example: true })
    @IsBoolean()
    isPublished: boolean;
}
