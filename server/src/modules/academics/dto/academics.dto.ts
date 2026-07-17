import { ClassStatus, SubjectStatus, WeekDay } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class UpdateSubjectStatusDto { @IsEnum(SubjectStatus) status: SubjectStatus; }

export class CreateSubjectRestoreRequestDto {
    @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class CreateSubjectProposalDto {
    @IsString() @Matches(/^[A-Za-z][A-Za-z0-9]{1,29}$/) code: string;
    @IsString() @Length(2, 150) name: string;
    @IsOptional() @IsString() @MaxLength(3000) description?: string;
    @IsInt() @Min(1) @Max(10) credits: number;
    @IsNumber() @Min(0) @Max(100) assignmentWeight: number;
    @IsNumber() @Min(0) @Max(100) quizWeight: number;
    @IsNumber() @Min(0) @Max(100) midtermWeight: number;
    @IsNumber() @Min(0) @Max(100) finalWeight: number;
    @IsOptional() @IsNumber() @Min(0) @Max(10) passScore?: number;
}

export class ReviewProposalDto {
    @IsBoolean() approved: boolean;
    @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class CreateClassProposalDto {
    @IsUUID() subjectPublicId: string;
    @IsInt() @Min(1) @Max(20) requestedClassCount: number;
    @IsInt() @Min(1) @Max(500) maxStudentsPerClass: number;
    @IsDateString() registrationStart: string;
    @IsDateString() registrationEnd: string;
    @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class ScheduleDto {
    @IsEnum(WeekDay) weekDay: WeekDay;
    @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime: string;
    @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime: string;
    @IsOptional() @IsString() @MaxLength(100) room?: string;
}

export class UpdateClassDto {
    @IsOptional() @IsString() @Length(2, 150) name?: string;
    @IsOptional() @IsInt() @Min(1) @Max(500) maxStudents?: number;
    @IsOptional() @IsDateString() registrationStart?: string;
    @IsOptional() @IsDateString() registrationEnd?: string;
    @IsOptional() @IsEnum(ClassStatus) status?: ClassStatus;
    @IsOptional() @IsUUID() lecturerPublicId?: string;
    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ScheduleDto) schedules?: ScheduleDto[];
}

export class AddPrerequisiteDto { @IsUUID() prerequisitePublicId: string; }
