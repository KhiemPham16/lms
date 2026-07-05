import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class LessonSectionOrderItemDto {
    @ApiProperty({ example: 'section-public-id' })
    @IsString()
    publicId: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Min(1)
    sortOrder: number;
}

export class ReorderLessonSectionsDto {
    @ApiProperty({ type: [LessonSectionOrderItemDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => LessonSectionOrderItemDto)
    items: LessonSectionOrderItemDto[];
}
