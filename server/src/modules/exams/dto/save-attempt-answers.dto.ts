import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class SaveAttemptAnswerItemDto {
    @ApiProperty({ example: 'question-public-id' })
    @IsString()
    questionPublicId: string;

    @ApiProperty({ example: ['option-public-id'] })
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    optionPublicIds: string[];
}

export class SaveAttemptAnswersDto {
    @ApiProperty({ type: [SaveAttemptAnswerItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SaveAttemptAnswerItemDto)
    answers: SaveAttemptAnswerItemDto[];

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    @Min(0)
    focusLostCount?: number;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    violationCount?: number;
}
