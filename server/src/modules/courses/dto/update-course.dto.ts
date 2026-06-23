import { PartialType } from '@nestjs/mapped-types';
import { CreateCourseProposalDto } from './create-course-proposal.dto';

export class UpdateCourseDto extends PartialType(CreateCourseProposalDto) {}
