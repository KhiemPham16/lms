import { PartialType } from '@nestjs/mapped-types';
import { CreateExamQuestionDto } from './create-exam-question.dto';

export class UpdateExamQuestionDto extends PartialType(CreateExamQuestionDto) {}
