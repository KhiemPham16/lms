import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
    AssessmentCategory,
    AttemptStatus,
    ClassStatus,
    EnrollmentStatus,
    JudgeStatus,
    LessonType,
    MediaType,
    QuestionType,
    ScorePolicy,
    UserRole
} from '@prisma/client';
import { PrismaService } from '~/prisma/prisma.service';
import {
    CreateAssessmentDto,
    CreateLessonDto,
    CreateQuestionDto,
    CreateSectionDto,
    GradeAnswerDto,
    QuestionConfigDto,
    ReplaceAssessmentQuestionsDto,
    ReorderContentDto,
    RecordViolationDto,
    SaveAnswerDto,
    UpdateAssessmentDto,
    UpdateLessonDto,
    UpdateSectionDto
} from './dto/learning.dto';
import { SUPPORTED_JUDGE_LANGUAGES } from './judge0.service';
import { MediaService } from '../media/media.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class LearningService {
    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue('code-grading') private readonly gradingQueue: Queue<{ answerId: number }>,
        private readonly media: MediaService,
        private readonly settings: SystemSettingsService
    ) {}

    supportedLanguages() {
        return [
            { id: 0, name: 'HTML/CSS (Preview)', questionType: QuestionType.HTML_CSS, judgeEnabled: false },
            { id: 50, name: 'C (GCC 9.2.0)' },
            { id: 54, name: 'C++ (GCC 9.2.0)' },
            { id: 51, name: 'C# (Mono 6.6.0.161)' },
            { id: 62, name: 'Java (OpenJDK 13.0.1)' },
            { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
            { id: 71, name: 'Python (3.8.1)' }
        ];
    }

    async classAssessments(classPublicId: string, user: { sub: string; role: UserRole }) {
        const courseClass = await this.prisma.class.findUnique({ where: { publicId: classPublicId } });
        if (!courseClass) throw new NotFoundException('Không tìm thấy lớp học');
        let studentId: number | null = null;
        if (user.role === UserRole.STUDENT) {
            this.assertStudentLearningAccess(courseClass.status);
            studentId = (await this.requireEnrollment(courseClass.id, user.sub)).id;
        }
        const assessments = await this.prisma.assessment.findMany({
            where: { classId: courseClass.id, isPublished: user.role === UserRole.STUDENT ? true : undefined },
            orderBy: { openAt: 'asc' },
            include: { _count: { select: { questions: true, attempts: true } } }
        });
        if (studentId === null) return assessments;
        const curriculum = await this.studentCurriculumState(courseClass.id, studentId);
        return assessments.map((assessment) => ({
            ...assessment,
            ...(curriculum.assessments.get(assessment.id) ?? { isCompleted: false, isLocked: true })
        }));
    }

    async assessmentAttempts(assessmentPublicId: string, lecturerPublicId: string) {
        const assessment = await this.prisma.assessment.findUnique({
            where: { publicId: assessmentPublicId },
            include: { class: true }
        });
        if (!assessment) throw new NotFoundException('Không tìm thấy bài kiểm tra');
        await this.requireTeachingClass(assessment.class.publicId, lecturerPublicId);
        return this.prisma.assessmentAttempt.findMany({
            where: { assessmentId: assessment.id },
            orderBy: [{ submittedAt: 'desc' }, { startedAt: 'desc' }],
            include: {
                student: { select: { publicId: true, code: true, fullName: true } },
                answers: {
                    include: {
                        question: { select: { publicId: true, type: true, content: true, points: true } },
                        selectedOptions: { include: { option: true } }
                    }
                },
                violations: { orderBy: { createdAt: 'asc' } }
            }
        });
    }

    async attemptResult(attemptPublicId: string, studentPublicId: string) {
        const attempt = await this.prisma.assessmentAttempt.findFirst({
            where: { publicId: attemptPublicId, student: { publicId: studentPublicId } },
            include: {
                assessment: { select: { publicId: true, title: true, category: true } },
                answers: {
                    include: { question: { select: { publicId: true, type: true, content: true, points: true } } }
                }
            }
        });
        if (!attempt) throw new NotFoundException('Không tìm thấy kết quả bài làm');
        if (attempt.status === AttemptStatus.IN_PROGRESS) throw new BadRequestException('Bài làm chưa được nộp');
        return attempt;
    }

    async classContent(classPublicId: string, user: { sub: string; role: UserRole }) {
        const courseClass = await this.prisma.class.findUnique({ where: { publicId: classPublicId } });
        if (!courseClass) throw new NotFoundException('Không tìm thấy lớp học');
        let studentId: number | null = null;
        if (user.role === UserRole.STUDENT) {
            this.assertStudentLearningAccess(courseClass.status);
            studentId = (await this.requireEnrollment(courseClass.id, user.sub)).id;
        }
        const sections = await this.prisma.lessonSection.findMany({
            where: { classId: courseClass.id, isPublished: user.role === UserRole.STUDENT ? true : undefined },
            orderBy: { sortOrder: 'asc' },
            include: {
                lessons: {
                    where: user.role === UserRole.STUDENT ? { isPublished: true } : undefined,
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        media: {
                            select: {
                                publicId: true,
                                type: true,
                                title: true,
                                altText: true,
                                caption: true,
                                originalName: true,
                                mimeType: true,
                                size: true,
                                width: true,
                                height: true
                            }
                        }
                    }
                }
            }
        });
        if (studentId === null) return sections;
        const curriculum = await this.studentCurriculumState(courseClass.id, studentId);
        return sections.map((section) => ({
            ...section,
            lessons: section.lessons.map((lesson) => {
                const state = curriculum.lessons.get(lesson.id) ?? { isCompleted: false, isLocked: true };
                return {
                    ...lesson,
                    ...state,
                    content: state.isLocked ? null : lesson.content,
                    resourceUrl: state.isLocked ? null : lesson.resourceUrl,
                    media: state.isLocked ? null : lesson.media
                };
            })
        }));
    }

    async createSection(dto: CreateSectionDto, lecturerPublicId: string) {
        const courseClass = await this.requireTeachingClass(dto.classPublicId, lecturerPublicId);
        this.assertClassWritable(courseClass.status);
        return this.prisma.lessonSection.create({
            data: { classId: courseClass.id, title: dto.title, sortOrder: dto.sortOrder ?? 0, isPublished: dto.isPublished ?? true }
        });
    }

    async updateSection(sectionPublicId: string, dto: UpdateSectionDto, lecturerPublicId: string) {
        const section = await this.requireEditableSection(sectionPublicId, lecturerPublicId);
        return this.prisma.lessonSection.update({
            where: { id: section.id },
            data: { title: dto.title, sortOrder: dto.sortOrder, isPublished: dto.isPublished }
        });
    }

    async deleteSection(sectionPublicId: string, lecturerPublicId: string) {
        const section = await this.requireEditableSection(sectionPublicId, lecturerPublicId);
        await this.prisma.lessonSection.delete({ where: { id: section.id } });
        return { message: 'Đã xóa chương bài học' };
    }

    async createLesson(dto: CreateLessonDto, lecturerPublicId: string) {
        const section = await this.prisma.lessonSection.findUnique({
            where: { publicId: dto.sectionPublicId },
            include: { class: true }
        });
        if (!section) throw new NotFoundException('Không tìm thấy chương bài học');
        const courseClass = await this.requireTeachingClass(section.class.publicId, lecturerPublicId);
        this.assertClassWritable(courseClass.status);
        const supportedLessonTypes: LessonType[] = [LessonType.TEXT, LessonType.VIDEO, LessonType.PDF];
        if (!supportedLessonTypes.includes(dto.type))
            throw new BadRequestException('Bài giảng chỉ hỗ trợ văn bản, video YouTube hoặc PDF');
        let content: string | undefined;
        let resourceUrl: string | undefined;
        let mediaId: number | undefined;
        if (dto.type === LessonType.TEXT) {
            content = dto.content?.trim();
            if (!content) throw new BadRequestException('Bài giảng văn bản phải có nội dung');
        } else if (dto.type === LessonType.VIDEO) {
            const videoId = this.youtubeVideoId(dto.youtubeVideoId ?? dto.resourceUrl ?? '');
            resourceUrl = `https://www.youtube.com/embed/${videoId}`;
        } else {
            if (!dto.mediaPublicId) throw new BadRequestException('Bài giảng PDF phải chọn một tệp đã tải lên');
            const media = await this.media.requireMedia(dto.mediaPublicId, MediaType.PDF);
            mediaId = media.id;
            resourceUrl = `/api/v1/media/${media.publicId}`;
        }
        return this.prisma.lesson.create({
            data: {
                sectionId: section.id,
                title: dto.title,
                type: dto.type,
                content,
                resourceUrl,
                mediaId,
                sortOrder: dto.sortOrder ?? 0,
                isPublished: dto.isPublished ?? false
            },
            include: { media: true }
        });
    }

    async updateLesson(lessonPublicId: string, dto: UpdateLessonDto, lecturerPublicId: string) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { publicId: lessonPublicId },
            include: { section: { include: { class: true } } }
        });
        if (!lesson) throw new NotFoundException('Không tìm thấy bài học');
        await this.requireTeachingClass(lesson.section.class.publicId, lecturerPublicId);
        this.assertClassWritable(lesson.section.class.status);

        let sectionId: number | undefined;
        if (dto.sectionPublicId && dto.sectionPublicId !== lesson.section.publicId) {
            const target = await this.prisma.lessonSection.findUnique({
                where: { publicId: dto.sectionPublicId },
                include: { class: true }
            });
            if (!target || target.classId !== lesson.section.classId)
                throw new BadRequestException('Chương đích không thuộc cùng lớp học');
            sectionId = target.id;
        }

        const type = dto.type ?? lesson.type;
        let content = lesson.content ?? undefined;
        let resourceUrl = lesson.resourceUrl ?? undefined;
        let mediaId = lesson.mediaId ?? undefined;
        if (dto.type || dto.content !== undefined || dto.resourceUrl !== undefined || dto.youtubeVideoId !== undefined || dto.mediaPublicId !== undefined) {
            ({ content, resourceUrl, mediaId } = await this.resolveLessonResource(type, dto));
        }
        return this.prisma.lesson.update({
            where: { id: lesson.id },
            data: { sectionId, title: dto.title, type, content, resourceUrl, mediaId, sortOrder: dto.sortOrder, isPublished: dto.isPublished },
            include: { media: true }
        });
    }

    async deleteLesson(lessonPublicId: string, lecturerPublicId: string) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { publicId: lessonPublicId },
            include: { section: { include: { class: true } } }
        });
        if (!lesson) throw new NotFoundException('Không tìm thấy bài học');
        await this.requireTeachingClass(lesson.section.class.publicId, lecturerPublicId);
        this.assertClassWritable(lesson.section.class.status);
        await this.prisma.lesson.delete({ where: { id: lesson.id } });
        return { message: 'Đã xóa bài học' };
    }

    async reorderContent(classPublicId: string, dto: ReorderContentDto, lecturerPublicId: string) {
        const courseClass = await this.requireTeachingClass(classPublicId, lecturerPublicId);
        this.assertClassWritable(courseClass.status);
        const sectionIds = dto.sections.map((item) => item.publicId);
        if (new Set(sectionIds).size !== sectionIds.length) throw new BadRequestException('Danh sách chương bị trùng');
        const lessonIds = dto.sections.flatMap((section) => section.lessons?.map((item) => item.publicId) ?? []);
        if (new Set(lessonIds).size !== lessonIds.length) throw new BadRequestException('Danh sách bài học bị trùng');
        const [sections, lessons] = await Promise.all([
            this.prisma.lessonSection.findMany({ where: { publicId: { in: sectionIds }, classId: courseClass.id }, select: { id: true, publicId: true } }),
            this.prisma.lesson.findMany({ where: { publicId: { in: lessonIds }, section: { classId: courseClass.id } }, select: { id: true, publicId: true } })
        ]);
        if (sections.length !== sectionIds.length || lessons.length !== lessonIds.length)
            throw new BadRequestException('Chương hoặc bài học không thuộc lớp học');
        const sectionMap = new Map(sections.map((item) => [item.publicId, item.id]));
        const lessonMap = new Map(lessons.map((item) => [item.publicId, item.id]));
        await this.prisma.$transaction(dto.sections.flatMap((section) => [
            this.prisma.lessonSection.update({ where: { id: sectionMap.get(section.publicId)! }, data: { sortOrder: section.sortOrder } }),
            ...(section.lessons ?? []).map((lesson) => this.prisma.lesson.update({
                where: { id: lessonMap.get(lesson.publicId)! },
                data: { sectionId: sectionMap.get(section.publicId)!, sortOrder: lesson.sortOrder }
            }))
        ]));
        return this.classContent(classPublicId, { sub: lecturerPublicId, role: UserRole.LECTURER });
    }

    async completeLesson(lessonPublicId: string, studentPublicId: string) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { publicId: lessonPublicId },
            include: { section: true }
        });
        if (!lesson?.isPublished) throw new NotFoundException('Không tìm thấy bài học');
        await this.requireStudentLearningClass(lesson.section.classId);
        const student = await this.requireEnrollment(lesson.section.classId, studentPublicId);
        const curriculum = await this.studentCurriculumState(lesson.section.classId, student.id);
        if (curriculum.lessons.get(lesson.id)?.isLocked) {
            throw new ForbiddenException('Bạn phải hoàn thành nội dung trước khi học bài này');
        }
        await this.prisma.lessonProgress.upsert({
            where: { lessonId_studentId: { lessonId: lesson.id, studentId: student.id } },
            create: { lessonId: lesson.id, studentId: student.id },
            update: { completedAt: new Date() }
        });
        return { message: 'Đã hoàn thành bài học' };
    }

    async createAssessment(dto: CreateAssessmentDto, lecturerPublicId: string) {
        const courseClass = await this.requireTeachingClass(dto.classPublicId, lecturerPublicId);
        this.assertClassWritable(courseClass.status);
        const openAt = new Date(dto.openAt),
            closeAt = new Date(dto.closeAt);
        if (openAt >= closeAt) throw new BadRequestException('Thời gian mở phải trước thời gian đóng');
        this.validateAssessmentDuration(dto.category, dto.durationMinutes);
        let lessonId: number | undefined;
        if (dto.lessonPublicId) {
            const lesson = await this.prisma.lesson.findUnique({
                where: { publicId: dto.lessonPublicId },
                include: { section: true }
            });
            if (!lesson || lesson.section.classId !== courseClass.id)
                throw new BadRequestException('Bài học không thuộc lớp');
            lessonId = lesson.id;
        }
        return this.prisma.assessment.create({
            data: {
                classId: courseClass.id,
                lessonId,
                title: dto.title,
                description: dto.description,
                category: dto.category,
                openAt,
                closeAt,
                durationMinutes: dto.durationMinutes,
                maxAttempts: dto.maxAttempts ?? 1,
                scorePolicy: dto.scorePolicy,
                maxViolations: dto.maxViolations ?? 3,
                isPublished: dto.isPublished ?? false
            }
        });
    }

    async assessmentDetail(assessmentPublicId: string, lecturerPublicId: string) {
        const assessment = await this.prisma.assessment.findUnique({
            where: { publicId: assessmentPublicId },
            include: {
                class: { select: { publicId: true, code: true, status: true } },
                lesson: { select: { publicId: true, title: true } },
                questions: {
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        options: { orderBy: { sortOrder: 'asc' } },
                        testCases: { orderBy: { sortOrder: 'asc' } }
                    }
                },
                _count: { select: { attempts: true, questions: true } }
            }
        });
        if (!assessment) throw new NotFoundException('Không tìm thấy bài đánh giá');
        await this.requireTeachingClass(assessment.class.publicId, lecturerPublicId);
        return assessment;
    }

    async updateAssessment(assessmentPublicId: string, dto: UpdateAssessmentDto, lecturerPublicId: string) {
        const assessment = await this.requireEditableAssessment(assessmentPublicId, lecturerPublicId);
        const category = dto.category ?? assessment.category;
        const openAt = dto.openAt ? new Date(dto.openAt) : assessment.openAt;
        const closeAt = dto.closeAt ? new Date(dto.closeAt) : assessment.closeAt;
        if (openAt >= closeAt) throw new BadRequestException('Thời gian mở phải trước thời gian đóng');
        const durationMinutes = category === AssessmentCategory.ASSIGNMENT
            ? undefined
            : (dto.durationMinutes ?? assessment.durationMinutes ?? undefined);
        this.validateAssessmentDuration(category, durationMinutes);

        await this.prisma.assessment.update({
            where: { id: assessment.id },
            data: {
                title: dto.title,
                description: dto.description,
                category,
                openAt,
                closeAt,
                durationMinutes: category === AssessmentCategory.ASSIGNMENT ? null : durationMinutes,
                maxAttempts: dto.maxAttempts,
                scorePolicy: dto.scorePolicy,
                maxViolations: dto.maxViolations
            }
        });
        return this.assessmentDetail(assessmentPublicId, lecturerPublicId);
    }

    async replaceAssessmentQuestions(
        assessmentPublicId: string,
        dto: ReplaceAssessmentQuestionsDto,
        lecturerPublicId: string
    ) {
        const assessment = await this.requireEditableAssessment(assessmentPublicId, lecturerPublicId);
        dto.questions.forEach((question) => this.validateQuestionConfig(question));

        await this.prisma.$transaction(async (tx) => {
            await tx.assessmentQuestion.deleteMany({ where: { assessmentId: assessment.id } });
            for (const question of dto.questions) {
                await tx.assessmentQuestion.create({
                    data: {
                        assessmentId: assessment.id,
                        type: question.type,
                        content: question.content,
                        points: question.points,
                        sortOrder: question.sortOrder ?? 0,
                        judgeLanguageId: question.type === QuestionType.CODE ? question.judgeLanguageId : null,
                        starterCode: question.starterCode,
                        options: {
                            create: question.options?.map((option) => ({
                                ...option,
                                sortOrder: option.sortOrder ?? 0
                            })) ?? []
                        },
                        testCases: {
                            create: (question.type === QuestionType.CODE ? question.testCases : [])?.map((testCase) => ({
                                ...testCase,
                                isHidden: testCase.isHidden ?? true,
                                sortOrder: testCase.sortOrder ?? 0
                            })) ?? []
                        }
                    }
                });
            }
        });
        return this.assessmentDetail(assessmentPublicId, lecturerPublicId);
    }

    async publishAssessment(assessmentPublicId: string, isPublished: boolean, lecturerPublicId: string) {
        const assessment = await this.prisma.assessment.findUnique({
            where: { publicId: assessmentPublicId },
            include: { class: true }
        });
        if (!assessment) throw new NotFoundException('Không tìm thấy bài kiểm tra');
        await this.requireTeachingClass(assessment.class.publicId, lecturerPublicId);
        this.assertClassWritable(assessment.class.status);
        return this.prisma.assessment.update({
            where: { id: assessment.id },
            data: { isPublished }
        });
    }

    async deleteAssessment(assessmentPublicId: string, lecturerPublicId: string) {
        const assessment = await this.prisma.assessment.findUnique({
            where: { publicId: assessmentPublicId },
            include: { class: true, _count: { select: { attempts: true } } }
        });
        if (!assessment) throw new NotFoundException('Không tìm thấy bài đánh giá');
        await this.requireTeachingClass(assessment.class.publicId, lecturerPublicId);
        this.assertClassWritable(assessment.class.status);
        if (assessment.isPublished) throw new BadRequestException('Chỉ được xóa bài đánh giá chưa công bố');
        if (assessment._count.attempts > 0) throw new BadRequestException('Không thể xóa bài đánh giá đã có người làm bài');

        const deleted = await this.prisma.assessment.deleteMany({
            where: { id: assessment.id, isPublished: false, attempts: { none: {} } }
        });
        if (!deleted.count)
            throw new BadRequestException('Bài đánh giá vừa thay đổi trạng thái hoặc đã có người làm bài');
        return { message: 'Đã xóa bài đánh giá' };
    }

    async createQuestion(dto: CreateQuestionDto, lecturerPublicId: string) {
        const assessment = await this.requireEditableAssessment(dto.assessmentPublicId, lecturerPublicId);
        this.validateQuestionConfig(dto);
        return this.prisma.assessmentQuestion.create({
            data: {
                assessmentId: assessment.id,
                type: dto.type,
                content: dto.content,
                points: dto.points,
                sortOrder: dto.sortOrder ?? 0,
                judgeLanguageId: dto.type === QuestionType.CODE ? dto.judgeLanguageId : null,
                starterCode: dto.starterCode,
                options: { create: dto.options?.map((item) => ({ ...item, sortOrder: item.sortOrder ?? 0 })) ?? [] },
                testCases: {
                    create:
                        (dto.type === QuestionType.CODE ? dto.testCases : [])?.map((item) => ({
                            ...item,
                            isHidden: item.isHidden ?? true,
                            sortOrder: item.sortOrder ?? 0
                        })) ?? []
                }
            },
            include: { options: true, testCases: true }
        });
    }

    async startAttempt(assessmentPublicId: string, studentPublicId: string) {
        const assessment = await this.prisma.assessment.findUnique({
            where: { publicId: assessmentPublicId },
            include: {
                questions: { orderBy: { sortOrder: 'asc' }, include: { options: { orderBy: { sortOrder: 'asc' } } } }
            }
        });
        if (!assessment?.isPublished) throw new NotFoundException('Không tìm thấy bài kiểm tra');
        await this.requireStudentLearningClass(assessment.classId);
        const student = await this.requireEnrollment(assessment.classId, studentPublicId);
        const curriculum = await this.studentCurriculumState(assessment.classId, student.id);
        if (curriculum.assessments.get(assessment.id)?.isLocked) {
            throw new ForbiddenException('Bạn phải hoàn thành nội dung trước khi làm bài đánh giá này');
        }
        const now = new Date();
        if (now < assessment.openAt || now > assessment.closeAt)
            throw new BadRequestException('Bài kiểm tra chưa mở hoặc đã đóng');
        if (assessment.category === AssessmentCategory.FINAL)
            await this.assertFinalExamEligibility(assessment.classId, student.id);
        const count = await this.prisma.assessmentAttempt.count({
            where: { assessmentId: assessment.id, studentId: student.id }
        });
        if (count >= assessment.maxAttempts) throw new BadRequestException('Bạn đã dùng hết số lượt làm bài');
        const deadlineAt = assessment.durationMinutes
            ? new Date(Math.min(assessment.closeAt.getTime(), now.getTime() + assessment.durationMinutes * 60000))
            : assessment.closeAt;
        const attempt = await this.prisma.assessmentAttempt.create({
            data: { assessmentId: assessment.id, studentId: student.id, attemptNumber: count + 1, deadlineAt }
        });
        return {
            ...attempt,
            questions: assessment.questions.map((question) => ({
                ...question,
                options: question.options.map((option) => ({
                    id: option.id,
                    publicId: option.publicId,
                    questionId: option.questionId,
                    content: option.content,
                    sortOrder: option.sortOrder
                }))
            }))
        };
    }

    async saveAnswer(attemptPublicId: string, dto: SaveAnswerDto, studentPublicId: string) {
        const attempt = await this.requireActiveAttempt(attemptPublicId, studentPublicId);
        const question = await this.prisma.assessmentQuestion.findFirst({
            where: { publicId: dto.questionPublicId, assessmentId: attempt.assessmentId },
            include: { options: true }
        });
        if (!question) throw new NotFoundException('Không tìm thấy câu hỏi');
        if (dto.languageId && question.judgeLanguageId && dto.languageId !== question.judgeLanguageId)
            throw new BadRequestException('Ngôn ngữ nộp bài không đúng yêu cầu');
        const selected = dto.selectedOptionPublicIds?.length
            ? question.options.filter((item) => dto.selectedOptionPublicIds!.includes(item.publicId))
            : [];
        if (selected.length !== (dto.selectedOptionPublicIds?.length ?? 0))
            throw new BadRequestException('Đáp án lựa chọn không hợp lệ');
        const answer = await this.prisma.attemptAnswer.upsert({
            where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
            create: {
                attemptId: attempt.id,
                questionId: question.id,
                textAnswer: dto.textAnswer,
                sourceCode: dto.sourceCode,
                languageId: dto.languageId
            },
            update: { textAnswer: dto.textAnswer, sourceCode: dto.sourceCode, languageId: dto.languageId }
        });
        await this.prisma.attemptAnswerOption.deleteMany({ where: { answerId: answer.id } });
        if (selected.length)
            await this.prisma.attemptAnswerOption.createMany({
                data: selected.map((option) => ({ answerId: answer.id, optionId: option.id }))
            });
        return { message: 'Đã lưu câu trả lời' };
    }

    async submitAttempt(attemptPublicId: string, studentPublicId: string, auto = false) {
        const attempt = await this.requireAttemptOwner(attemptPublicId, studentPublicId);
        if (attempt.status !== AttemptStatus.IN_PROGRESS) throw new BadRequestException('Bài làm đã được nộp');
        return this.gradeSubmittedAttempt(attempt.id, auto);
    }

    async autoSubmitExpiredAttempts(classPublicId: string) {
        const attempts = await this.prisma.assessmentAttempt.findMany({
            where: {
                status: AttemptStatus.IN_PROGRESS,
                deadlineAt: { lte: new Date() },
                assessment: { class: { publicId: classPublicId } },
                student: {
                    enrollments: {
                        some: { status: EnrollmentStatus.ACTIVE, class: { publicId: classPublicId } }
                    }
                }
            },
            select: { id: true }
        });
        for (const attempt of attempts) await this.gradeSubmittedAttempt(attempt.id, true);
        return attempts.length;
    }

    async recordViolation(attemptPublicId: string, dto: RecordViolationDto, studentPublicId: string) {
        const attempt = await this.requireActiveAttempt(attemptPublicId, studentPublicId);
        const updated = await this.prisma.assessmentAttempt.update({
            where: { id: attempt.id },
            data: { violationCount: { increment: 1 }, violations: { create: { type: dto.type } } },
            include: { assessment: true }
        });
        if (updated.violationCount >= updated.assessment.maxViolations)
            return this.gradeSubmittedAttempt(updated.id, true);
        return {
            message: 'Đã ghi nhận vi phạm',
            violationCount: updated.violationCount,
            remaining: updated.assessment.maxViolations - updated.violationCount
        };
    }

    async gradeAnswer(answerId: number, dto: GradeAnswerDto, lecturerPublicId: string) {
        const answer = await this.prisma.attemptAnswer.findUnique({
            where: { id: answerId },
            include: { question: true, attempt: { include: { assessment: { include: { class: true } } } } }
        });
        if (!answer) throw new NotFoundException('Không tìm thấy câu trả lời');
        const courseClass = await this.requireTeachingClass(answer.attempt.assessment.class.publicId, lecturerPublicId);
        this.assertClassWritable(courseClass.status);
        if (dto.awardedPoints > Number(answer.question.points))
            throw new BadRequestException('Điểm chấm vượt quá điểm tối đa');
        const lecturer = await this.prisma.user.findUniqueOrThrow({ where: { publicId: lecturerPublicId } });
        await this.prisma.attemptAnswer.update({
            where: { id: answer.id },
            data: {
                awardedPoints: dto.awardedPoints,
                feedback: dto.feedback,
                gradedById: lecturer.id,
                gradedAt: new Date()
            }
        });
        await this.finalizeManualAttempt(answer.attemptId);
        return { message: 'Đã chấm câu trả lời' };
    }

    private async gradeSubmittedAttempt(attemptId: number, auto: boolean) {
        const attempt = await this.prisma.assessmentAttempt.findUniqueOrThrow({
            where: { id: attemptId },
            include: {
                assessment: { include: { questions: { include: { options: true } } } },
                answers: { include: { selectedOptions: true } }
            }
        });
        const byQuestion = new Map(attempt.answers.map((item) => [item.questionId, item]));
        let hasCode = false,
            hasManual = false;
        for (const question of attempt.assessment.questions) {
            const existingAnswer = byQuestion.get(question.id);
            const answer =
                existingAnswer ??
                (await this.prisma.attemptAnswer.create({
                    data: { attemptId, questionId: question.id },
                    include: { selectedOptions: true }
                }));
            if (question.type === QuestionType.SINGLE_CHOICE || question.type === QuestionType.MULTIPLE_CHOICE) {
                const selectedIds = new Set(answer.selectedOptions.map((item) => item.optionId));
                const correctIds = new Set(question.options.filter((item) => item.isCorrect).map((item) => item.id));
                const correct =
                    selectedIds.size === correctIds.size && [...selectedIds].every((id) => correctIds.has(id));
                await this.prisma.attemptAnswer.update({
                    where: { id: answer.id },
                    data: { awardedPoints: correct ? question.points : 0 }
                });
            } else if (question.type === QuestionType.CODE && answer.sourceCode && answer.languageId) {
                hasCode = true;
                await this.prisma.attemptAnswer.update({
                    where: { id: answer.id },
                    data: { judgeStatus: JudgeStatus.QUEUED }
                });
                await this.gradingQueue.add(
                    'grade-code',
                    { answerId: answer.id },
                    {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 3000 },
                        removeOnComplete: 100,
                        removeOnFail: 100
                    }
                );
            } else if (question.type === QuestionType.ESSAY || question.type === QuestionType.HTML_CSS)
                hasManual = true;
        }
        const score = await this.answerScore(attemptId);
        const status = hasCode || hasManual ? AttemptStatus.PENDING_GRADING : AttemptStatus.GRADED;
        return this.prisma.assessmentAttempt.update({
            where: { id: attemptId },
            data: {
                status: auto && status !== AttemptStatus.GRADED ? AttemptStatus.AUTO_SUBMITTED : status,
                score,
                submittedAt: new Date(),
                gradedAt: status === AttemptStatus.GRADED ? new Date() : null
            }
        });
    }

    private async finalizeManualAttempt(attemptId: number) {
        const answers = await this.prisma.attemptAnswer.findMany({ where: { attemptId }, include: { question: true } });
        const pending =
            answers.some(
                (item) =>
                    (item.question.type === QuestionType.ESSAY || item.question.type === QuestionType.HTML_CSS) &&
                    item.awardedPoints === null
            ) ||
            answers.some(
                (item) => item.judgeStatus === JudgeStatus.QUEUED || item.judgeStatus === JudgeStatus.PROCESSING
            );
        const score = answers.reduce((sum, item) => sum + Number(item.awardedPoints ?? 0), 0);
        await this.prisma.assessmentAttempt.update({
            where: { id: attemptId },
            data: {
                score,
                status: pending ? AttemptStatus.PENDING_GRADING : AttemptStatus.GRADED,
                gradedAt: pending ? null : new Date()
            }
        });
    }

    private async answerScore(attemptId: number) {
        const result = await this.prisma.attemptAnswer.aggregate({
            where: { attemptId },
            _sum: { awardedPoints: true }
        });
        return Number(result._sum.awardedPoints ?? 0);
    }

    private async requireEditableAssessment(assessmentPublicId: string, lecturerPublicId: string) {
        const assessment = await this.prisma.assessment.findUnique({
            where: { publicId: assessmentPublicId },
            include: { class: true, _count: { select: { attempts: true } } }
        });
        if (!assessment) throw new NotFoundException('Không tìm thấy bài đánh giá');
        const courseClass = await this.requireTeachingClass(assessment.class.publicId, lecturerPublicId);
        this.assertClassWritable(courseClass.status);
        if (assessment.isPublished) throw new BadRequestException('Cần ẩn bài đánh giá trước khi cấu hình lại');
        if (assessment._count.attempts > 0) throw new BadRequestException('Không thể cấu hình lại bài đánh giá đã có lượt làm');
        return assessment;
    }

    private validateQuestionConfig(dto: QuestionConfigDto) {
        const supportedQuestionTypes: QuestionType[] = [
            QuestionType.SINGLE_CHOICE,
            QuestionType.MULTIPLE_CHOICE,
            QuestionType.ESSAY,
            QuestionType.CODE,
            QuestionType.HTML_CSS
        ];
        if (!supportedQuestionTypes.includes(dto.type))
            throw new BadRequestException('Bài tập và bài kiểm tra chỉ hỗ trợ trắc nghiệm, tự luận, lập trình hoặc HTML/CSS');
        if (
            dto.type === QuestionType.CODE &&
            (!dto.judgeLanguageId || !SUPPORTED_JUDGE_LANGUAGES.includes(dto.judgeLanguageId as never))
        )
            throw new BadRequestException('Ngôn ngữ chấm mã không được hỗ trợ');
        if (
            (dto.type === QuestionType.SINGLE_CHOICE || dto.type === QuestionType.MULTIPLE_CHOICE) &&
            (!dto.options?.length || !dto.options.some((item) => item.isCorrect))
        )
            throw new BadRequestException('Câu trắc nghiệm phải có đáp án đúng');
        if (dto.type === QuestionType.CODE && !dto.testCases?.length)
            throw new BadRequestException('Câu lập trình phải có ca kiểm thử');
        if (dto.type === QuestionType.HTML_CSS && dto.testCases?.length)
            throw new BadRequestException('Bài HTML/CSS dùng chế độ preview và chấm thủ công, không sử dụng ca kiểm thử Judge0');
    }

    private validateAssessmentDuration(category: AssessmentCategory, durationMinutes?: number) {
        const allowed: Partial<Record<AssessmentCategory, number[]>> = {
            QUIZ: [15, 45],
            MIDTERM: [45, 60],
            FINAL: [45, 60, 120]
        };
        if (category === AssessmentCategory.ASSIGNMENT) {
            if (durationMinutes !== undefined)
                throw new BadRequestException('Bài tập không dùng mốc thời lượng cố định');
            return;
        }
        if (!durationMinutes || !allowed[category]?.includes(durationMinutes)) {
            const values = allowed[category]?.join(', ') ?? '';
            throw new BadRequestException(`Thời lượng hợp lệ cho loại bài này là: ${values} phút`);
        }
    }

    private youtubeVideoId(value: string) {
        const input = value.trim();
        if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
        try {
            const url = new URL(input);
            const host = url.hostname.toLowerCase().replace(/^www\./, '');
            let id = '';
            if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] ?? '';
            else if (host === 'youtube.com' || host === 'm.youtube.com') {
                id = url.searchParams.get('v') ?? '';
                if (!id) {
                    const parts = url.pathname.split('/').filter(Boolean);
                    if (['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1] ?? '';
                }
            }
            if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
        } catch {
            // Thông báo thống nhất ở bên dưới.
        }
        throw new BadRequestException('Mã hoặc đường dẫn video YouTube không hợp lệ');
    }

    private async assertFinalExamEligibility(classId: number, studentId: number) {
        const courseClass = await this.prisma.class.findUniqueOrThrow({
            where: { id: classId },
            include: {
                subject: true,
                assessments: {
                    where: {
                        isPublished: true,
                        category: { in: [AssessmentCategory.ASSIGNMENT, AssessmentCategory.QUIZ, AssessmentCategory.MIDTERM] }
                    },
                    include: {
                        questions: { select: { points: true } },
                        attempts: { where: { studentId } }
                    }
                }
            }
        });
        if (
            courseClass.assessments.some((assessment) =>
                assessment.attempts.some((attempt) => attempt.status !== AttemptStatus.GRADED)
            )
        )
            throw new BadRequestException('Điểm quá trình chưa được chấm hoàn tất');

        const weights: Record<AssessmentCategory, number> = {
            ASSIGNMENT: Number(courseClass.subject.assignmentWeight),
            QUIZ: Number(courseClass.subject.quizWeight),
            MIDTERM: Number(courseClass.subject.midtermWeight),
            FINAL: 0
        };
        const processCategories = [AssessmentCategory.ASSIGNMENT, AssessmentCategory.QUIZ, AssessmentCategory.MIDTERM];
        const totalWeight = processCategories.reduce((sum, category) => sum + weights[category], 0);
        const weightedScore = processCategories.reduce((sum, category) => {
            const assessments = courseClass.assessments.filter((assessment) => assessment.category === category);
            if (!assessments.length) return sum;
            const categoryScore =
                assessments.reduce((assessmentSum, assessment) => {
                    const maxPoints = assessment.questions.reduce(
                        (questionSum, question) => questionSum + Number(question.points),
                        0
                    );
                    const graded = assessment.attempts.filter(
                        (attempt) => attempt.status === AttemptStatus.GRADED && attempt.score !== null
                    );
                    if (!graded.length || maxPoints <= 0) return assessmentSum;
                    const selected =
                        assessment.scorePolicy === ScorePolicy.LATEST
                            ? graded.sort((a, b) => b.attemptNumber - a.attemptNumber)[0]
                            : graded.sort(
                                  (a, b) => Number(b.score ?? 0) - Number(a.score ?? 0) || b.attemptNumber - a.attemptNumber
                              )[0];
                    return assessmentSum + Math.min(10, Math.max(0, (Number(selected.score) / maxPoints) * 10));
                }, 0) / assessments.length;
            return sum + categoryScore * weights[category];
        }, 0);
        const processAverage = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) / 100 : 0;
        const gradingPolicy = await this.settings.gradingPolicy();
        if (processAverage < gradingPolicy.finalEligibilityScore)
            throw new ForbiddenException({
                code: 'FINAL_EXAM_NOT_ELIGIBLE',
                message: `Điểm trung bình quá trình dưới ${gradingPolicy.finalEligibilityScore} nên không đủ điều kiện thi cuối kỳ`,
                processAverage,
                requiredAverage: gradingPolicy.finalEligibilityScore
            });
    }

    private async requireTeachingClass(publicId: string, userPublicId: string) {
        const [courseClass, user] = await Promise.all([
            this.prisma.class.findUnique({ where: { publicId } }),
            this.prisma.user.findUnique({ where: { publicId: userPublicId }, select: { id: true, role: true, departmentId: true } })
        ]);
        if (!courseClass || !user) throw new ForbiddenException('Bạn không phụ trách lớp học này');
        const isAssignedLecturer = user.role === UserRole.LECTURER && courseClass.lecturerId === user.id;
        const isCurrentDepartmentHead = user.role === UserRole.DEPARTMENT_HEAD
            && user.departmentId !== null
            && courseClass.departmentId === user.departmentId;
        if (!isAssignedLecturer && !isCurrentDepartmentHead) throw new ForbiddenException('Bạn không phụ trách lớp học này');
        return courseClass;
    }
    private async requireEditableSection(publicId: string, userPublicId: string) {
        const section = await this.prisma.lessonSection.findUnique({
            where: { publicId },
            include: { class: true }
        });
        if (!section) throw new NotFoundException('Không tìm thấy chương bài học');
        await this.requireTeachingClass(section.class.publicId, userPublicId);
        this.assertClassWritable(section.class.status);
        return section;
    }
    private async resolveLessonResource(type: LessonType, dto: UpdateLessonDto) {
        const supportedLessonTypes: LessonType[] = [LessonType.TEXT, LessonType.VIDEO, LessonType.PDF];
        if (!supportedLessonTypes.includes(type))
            throw new BadRequestException('Bài giảng chỉ hỗ trợ văn bản, video YouTube hoặc PDF');
        if (type === LessonType.TEXT) {
            const content = dto.content?.trim();
            if (!content) throw new BadRequestException('Bài giảng văn bản phải có nội dung');
            return { content, resourceUrl: undefined, mediaId: undefined };
        }
        if (type === LessonType.VIDEO) {
            const videoId = this.youtubeVideoId(dto.youtubeVideoId ?? dto.resourceUrl ?? '');
            return { content: undefined, resourceUrl: `https://www.youtube.com/embed/${videoId}`, mediaId: undefined };
        }
        if (!dto.mediaPublicId) throw new BadRequestException('Bài giảng PDF phải chọn một tệp đã tải lên');
        const media = await this.media.requireMedia(dto.mediaPublicId, MediaType.PDF);
        return { content: undefined, resourceUrl: `/api/v1/media/${media.publicId}`, mediaId: media.id };
    }
    private async requireWritableClass(classId: number) {
        const courseClass = await this.prisma.class.findUnique({ where: { id: classId }, select: { status: true } });
        if (!courseClass) throw new NotFoundException('Không tìm thấy lớp học phần');
        this.assertClassWritable(courseClass.status);
    }
    private assertClassWritable(status: ClassStatus) {
        if (status === ClassStatus.COMPLETED) throw new BadRequestException('Lớp học phần đã hoàn thành và chỉ được phép xem dữ liệu');
    }
    private async studentCurriculumState(classId: number, studentId: number) {
        const [sections, progress, assessments] = await Promise.all([
            this.prisma.lessonSection.findMany({
                where: { classId, isPublished: true },
                orderBy: { sortOrder: 'asc' },
                select: {
                    lessons: {
                        where: { isPublished: true },
                        orderBy: { sortOrder: 'asc' },
                        select: { id: true }
                    }
                }
            }),
            this.prisma.lessonProgress.findMany({
                where: { studentId, lesson: { isPublished: true, section: { classId, isPublished: true } } },
                select: { lessonId: true }
            }),
            this.prisma.assessment.findMany({
                where: { classId, isPublished: true },
                orderBy: [{ openAt: 'asc' }, { id: 'asc' }],
                select: {
                    id: true,
                    lessonId: true,
                    attempts: { where: { studentId }, select: { status: true } }
                }
            })
        ]);

        const completedLessonIds = new Set(progress.map((item) => item.lessonId));
        const assessmentsByLesson = new Map<number, typeof assessments>();
        const unlinkedAssessments: typeof assessments = [];
        for (const assessment of assessments) {
            if (assessment.lessonId === null) {
                unlinkedAssessments.push(assessment);
                continue;
            }
            const linked = assessmentsByLesson.get(assessment.lessonId) ?? [];
            linked.push(assessment);
            assessmentsByLesson.set(assessment.lessonId, linked);
        }

        const lessonStates = new Map<number, { isCompleted: boolean; isLocked: boolean }>();
        const assessmentStates = new Map<number, { isCompleted: boolean; isLocked: boolean }>();
        let sequenceOpen = true;
        const applyAssessmentState = (assessment: (typeof assessments)[number]) => {
            const isCompleted = assessment.attempts.some((attempt) => attempt.status !== AttemptStatus.IN_PROGRESS);
            assessmentStates.set(assessment.id, { isCompleted, isLocked: !sequenceOpen });
            if (!isCompleted) sequenceOpen = false;
        };

        for (const section of sections) {
            for (const lesson of section.lessons) {
                const isCompleted = completedLessonIds.has(lesson.id);
                lessonStates.set(lesson.id, { isCompleted, isLocked: !sequenceOpen });
                if (!isCompleted) sequenceOpen = false;
                for (const assessment of assessmentsByLesson.get(lesson.id) ?? []) {
                    applyAssessmentState(assessment);
                }
            }
        }
        for (const assessment of unlinkedAssessments) applyAssessmentState(assessment);

        return { lessons: lessonStates, assessments: assessmentStates };
    }
    private async requireStudentLearningClass(classId: number) {
        const courseClass = await this.prisma.class.findUnique({ where: { id: classId }, select: { status: true } });
        if (!courseClass) throw new NotFoundException('Không tìm thấy lớp học phần');
        this.assertStudentLearningAccess(courseClass.status);
    }
    private assertStudentLearningAccess(status: ClassStatus) {
        if (status !== ClassStatus.IN_PROGRESS) {
            throw new ForbiddenException('Sinh viên chỉ được truy cập Module học khi lớp đang học');
        }
    }
    private async requireEnrollment(classId: number, studentPublicId: string) {
        const student = await this.prisma.user.findUnique({ where: { publicId: studentPublicId } });
        if (!student || student.role !== UserRole.STUDENT)
            throw new ForbiddenException('Chỉ sinh viên được thực hiện thao tác này');
        const enrollment = await this.prisma.enrollment.findFirst({
            where: { classId, studentId: student.id, status: EnrollmentStatus.ACTIVE }
        });
        if (!enrollment) throw new ForbiddenException('Bạn chưa tham gia lớp học');
        return student;
    }
    private async requireAttemptOwner(publicId: string, studentPublicId: string) {
        const value = await this.prisma.assessmentAttempt.findFirst({
            where: { publicId, student: { publicId: studentPublicId } },
            include: { assessment: { select: { class: { select: { status: true } } } } }
        });
        if (!value) throw new NotFoundException('Không tìm thấy lượt làm bài');
        this.assertClassWritable(value.assessment.class.status);
        return value;
    }
    private async requireActiveAttempt(publicId: string, studentPublicId: string) {
        const value = await this.requireAttemptOwner(publicId, studentPublicId);
        if (value.status !== AttemptStatus.IN_PROGRESS || new Date() > value.deadlineAt)
            throw new BadRequestException('Lượt làm bài đã kết thúc');
        return value;
    }
}
