import { PartialType } from '@nestjs/mapped-types';
import { CreateLessonSectionDto } from './create-lesson-section.dto';

export class UpdateLessonSectionDto extends PartialType(CreateLessonSectionDto) {}
