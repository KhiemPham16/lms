import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class ReorderLessonItemDto {
    @ApiProperty({ example: 'lesson-public-id' })
    @IsString()
    lessonId: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Min(1)
    orderIndex: number;
}

export class ReorderLessonsDto {
    @ApiProperty({ example: 'class-public-id' })
    @IsString()
    classId: string;

    @ApiProperty({ type: [ReorderLessonItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReorderLessonItemDto)
    items: ReorderLessonItemDto[];
}
