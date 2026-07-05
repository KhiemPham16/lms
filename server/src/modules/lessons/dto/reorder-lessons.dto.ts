import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, ValidateNested } from 'class-validator';

class LessonOrderItemDto {
    @ApiProperty({ example: 'lesson-public-id' })
    @IsString()
    publicId: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    sortOrder: number;
}

export class ReorderLessonsDto {
    @ApiProperty({ type: [LessonOrderItemDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => LessonOrderItemDto)
    items: LessonOrderItemDto[];
}
