import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExamQuestionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateNested
} from 'class-validator';

export class CreateExamOptionDto {
    @ApiProperty({ example: 'Dap an A' })
    @IsString()
    @IsNotEmpty()
    content: string;

    @ApiProperty({ example: true })
    @IsBoolean()
    isCorrect: boolean;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    sortOrder?: number;
}

export class CreateExamQuestionDto {
    @ApiPropertyOptional({ enum: ExamQuestionType, example: ExamQuestionType.SINGLE_CHOICE })
    @IsOptional()
    @IsEnum(ExamQuestionType)
    type?: ExamQuestionType;

    @ApiProperty({ example: 'Java la ngon ngu lap trinh huong doi tuong?' })
    @IsString()
    @IsNotEmpty()
    content: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    points?: number;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    sortOrder?: number;

    @ApiProperty({ type: [CreateExamOptionDto] })
    @IsArray()
    @ArrayMinSize(2)
    @ValidateNested({ each: true })
    @Type(() => CreateExamOptionDto)
    options: CreateExamOptionDto[];
}
