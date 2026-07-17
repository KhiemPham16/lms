import { AssessmentCategory, LessonType, QuestionType, ScorePolicy, ViolationType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    ValidateNested
} from 'class-validator';

export class CreateSectionDto {
    @IsUUID() classPublicId: string;
    @IsString() @MaxLength(200) title: string;
    @IsOptional() @IsInt() sortOrder?: number;
    @IsOptional() @IsBoolean() isPublished?: boolean;
}
export class CreateLessonDto {
    @IsUUID() sectionPublicId: string;
    @IsString() @MaxLength(200) title: string;
    @IsEnum(LessonType) type: LessonType;
    @IsOptional() @IsString() content?: string;
    @IsOptional() @IsString() resourceUrl?: string;
    @IsOptional() @IsString() @MaxLength(200) youtubeVideoId?: string;
    @IsOptional() @IsUUID() mediaPublicId?: string;
    @IsOptional() @IsInt() sortOrder?: number;
    @IsOptional() @IsBoolean() isPublished?: boolean;
}
export class UpdateSectionDto {
    @IsOptional() @IsString() @MaxLength(200) title?: string;
    @IsOptional() @IsInt() sortOrder?: number;
    @IsOptional() @IsBoolean() isPublished?: boolean;
}
export class UpdateLessonDto {
    @IsOptional() @IsUUID() sectionPublicId?: string;
    @IsOptional() @IsString() @MaxLength(200) title?: string;
    @IsOptional() @IsEnum(LessonType) type?: LessonType;
    @IsOptional() @IsString() content?: string;
    @IsOptional() @IsString() resourceUrl?: string;
    @IsOptional() @IsString() @MaxLength(200) youtubeVideoId?: string;
    @IsOptional() @IsUUID() mediaPublicId?: string;
    @IsOptional() @IsInt() sortOrder?: number;
    @IsOptional() @IsBoolean() isPublished?: boolean;
}
export class PublishContentDto {
    @IsBoolean() isPublished: boolean;
}
export class ReorderLessonDto {
    @IsUUID() publicId: string;
    @IsInt() @Min(0) sortOrder: number;
}
export class ReorderSectionDto {
    @IsUUID() publicId: string;
    @IsInt() @Min(0) sortOrder: number;
    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReorderLessonDto) lessons?: ReorderLessonDto[];
}
export class ReorderContentDto {
    @IsArray() @ValidateNested({ each: true }) @Type(() => ReorderSectionDto) sections: ReorderSectionDto[];
}
export class CreateAssessmentDto {
    @IsUUID() classPublicId: string;
    @IsOptional() @IsUUID() lessonPublicId?: string;
    @IsString() title: string;
    @IsOptional() @IsString() description?: string;
    @IsEnum(AssessmentCategory) category: AssessmentCategory;
    @IsDateString() openAt: string;
    @IsDateString() closeAt: string;
    @IsOptional() @IsInt() @Min(1) durationMinutes?: number;
    @IsOptional() @IsInt() @Min(1) @Max(20) maxAttempts?: number;
    @IsOptional() @IsEnum(ScorePolicy) scorePolicy?: ScorePolicy;
    @IsOptional() @IsInt() @Min(1) @Max(20) maxViolations?: number;
    @IsOptional() @IsBoolean() isPublished?: boolean;
}
export class UpdateAssessmentDto {
    @IsOptional() @IsString() title?: string;
    @IsOptional() @IsString() description?: string;
    @IsOptional() @IsEnum(AssessmentCategory) category?: AssessmentCategory;
    @IsOptional() @IsDateString() openAt?: string;
    @IsOptional() @IsDateString() closeAt?: string;
    @IsOptional() @IsInt() @Min(1) durationMinutes?: number;
    @IsOptional() @IsInt() @Min(1) @Max(20) maxAttempts?: number;
    @IsOptional() @IsEnum(ScorePolicy) scorePolicy?: ScorePolicy;
    @IsOptional() @IsInt() @Min(1) @Max(20) maxViolations?: number;
}
export class OptionDto {
    @IsString() content: string;
    @IsBoolean() isCorrect: boolean;
    @IsOptional() @IsInt() sortOrder?: number;
}
export class TestCaseDto {
    @IsOptional() @IsString() input?: string;
    @IsString() expectedOutput: string;
    @IsOptional() @IsBoolean() isHidden?: boolean;
    @IsOptional() @IsInt() sortOrder?: number;
}
export class QuestionConfigDto {
    @IsEnum(QuestionType) type: QuestionType;
    @IsString() content: string;
    @IsNumber() @Min(0.01) points: number;
    @IsOptional() @IsInt() sortOrder?: number;
    @IsOptional() @IsInt() judgeLanguageId?: number;
    @IsOptional() @IsString() starterCode?: string;
    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OptionDto) options?: OptionDto[];
    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TestCaseDto) testCases?: TestCaseDto[];
}
export class CreateQuestionDto extends QuestionConfigDto {
    @IsUUID() assessmentPublicId: string;
}
export class ReplaceAssessmentQuestionsDto {
    @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => QuestionConfigDto)
    questions: QuestionConfigDto[];
}
export class SaveAnswerDto {
    @IsUUID() questionPublicId: string;
    @IsOptional() @IsString() textAnswer?: string;
    @IsOptional() @IsString() sourceCode?: string;
    @IsOptional() @IsInt() languageId?: number;
    @IsOptional() @IsArray() @IsUUID('4', { each: true }) selectedOptionPublicIds?: string[];
}
export class RecordViolationDto {
    @IsEnum(ViolationType) type: ViolationType;
}
export class GradeAnswerDto {
    @IsNumber() @Min(0) awardedPoints: number;
    @IsOptional() @IsString() @MaxLength(3000) feedback?: string;
}
