import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

const codeLanguages = ['html', 'css', 'javascript', 'jsx', 'typescript', 'python', 'java', 'csharp', 'json'] as const;
const codeTestTypes = ['TEXT_CONTAINS', 'TEXT_NOT_CONTAINS', 'REGEX_MATCH', 'FILE_EXISTS'] as const;

export class CodeFileDto {
    @ApiProperty({ example: 'index.html' })
    @IsString()
    @IsNotEmpty()
    path: string;

    @ApiProperty({ enum: codeLanguages, example: 'html' })
    @IsIn(codeLanguages)
    language: (typeof codeLanguages)[number];

    @ApiPropertyOptional({ example: '<h1>Hello</h1>' })
    @IsOptional()
    @IsString()
    content?: string;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    readonly?: boolean;
}

export class CodeTestDto {
    @ApiProperty({ example: 'Co noi dung chao mung' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ enum: codeTestTypes, example: 'TEXT_CONTAINS' })
    @IsIn(codeTestTypes)
    type: (typeof codeTestTypes)[number];

    @ApiPropertyOptional({ example: 'index.html' })
    @IsOptional()
    @IsString()
    file?: string;

    @ApiPropertyOptional({ example: 'CHAO MUNG' })
    @IsOptional()
    @IsString()
    expected?: string;
}

export class CodeConfigDto {
    @ApiPropertyOptional({ example: 'HTML_CSS_JS' })
    @IsOptional()
    @IsString()
    template?: string;

    @ApiPropertyOptional({ example: 'Tao trang gioi thieu ban than' })
    @IsOptional()
    @IsString()
    instructions?: string;

    @ApiProperty({ type: [CodeFileDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CodeFileDto)
    files: CodeFileDto[];

    @ApiPropertyOptional({ type: [CodeTestDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CodeTestDto)
    tests?: CodeTestDto[];
}

export class SubmitCodeLessonDto {
    @ApiProperty({ type: [CodeFileDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CodeFileDto)
    files: CodeFileDto[];
}
