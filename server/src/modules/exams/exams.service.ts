import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
    AuditAction,
    ClassStatus,
    EnrollmentStatus,
    ExamAttemptStatus,
    ExamQuestionType,
    Prisma
} from '@prisma/client';

import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { NotificationsService } from '~/modules/notifications/notifications.service';
import { PrismaService } from '~/prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateExamQuestionDto } from './dto/create-exam-question.dto';
import { QueryExamDto } from './dto/query-exam.dto';
import { SaveAttemptAnswersDto } from './dto/save-attempt-answers.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { UpdateExamQuestionDto } from './dto/update-exam-question.dto';

const examSelect = () =>
    ({
        id: true,
        publicId: true,
        classId: true,
        sectionId: true,
        lessonId: true,
        title: true,
        description: true,
        durationMinutes: true,
        maxAttempts: true,
        passScore: true,
        isPublished: true,
        class: {
            select: {
                id: true,
                publicId: true,
                code: true,
                name: true,
                status: true,
                lecturerId: true,
                departmentHeadId: true
            }
        },
        section: {
            select: {
                publicId: true,
                title: true,
                sortOrder: true
            }
        },
        lesson: {
            select: {
                publicId: true,
                title: true,
                sortOrder: true
            }
        },
        questions: {
            orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
            select: {
                id: true,
                publicId: true,
                type: true,
                content: true,
                points: true,
                sortOrder: true,
                options: {
                    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
                    select: {
                        id: true,
                        publicId: true,
                        content: true,
                        isCorrect: true,
                        sortOrder: true
                    }
                }
            }
        },
        _count: {
            select: {
                attempts: true
            }
        },
        createdAt: true,
        updatedAt: true
    }) satisfies Prisma.ExamSelect;

const attemptSelect = () =>
    ({
        id: true,
        publicId: true,
        status: true,
        score: true,
        focusLostCount: true,
        violationCount: true,
        startedAt: true,
        submittedAt: true,
        student: {
            select: {
                publicId: true,
                code: true,
                fullName: true,
                email: true
            }
        },
        exam: {
            select: examSelect()
        },
        answers: {
            select: {
                question: {
                    select: {
                        publicId: true,
                        content: true
                    }
                },
                option: {
                    select: {
                        publicId: true,
                        content: true
                    }
                }
            }
        }
    }) satisfies Prisma.ExamAttemptSelect;

type ExamWithDetails = Prisma.ExamGetPayload<{ select: ReturnType<typeof examSelect> }>;
type AttemptWithDetails = Prisma.ExamAttemptGetPayload<{ select: ReturnType<typeof attemptSelect> }>;
type Actor = Awaited<ReturnType<ExamsService['findUserByPublicIdOrThrow']>>;
type ClassAccessRecord = ExamWithDetails['class'];

@Injectable()
export class ExamsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService,
        private readonly notificationsService: NotificationsService
    ) {}

    async create(classPublicId: string, dto: CreateExamDto, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        this.ensureCanManageClass(actor, classItem);
        this.ensureClassContentEditable(actor, classItem);
        const section = dto.sectionPublicId
            ? await this.findSectionInClassByPublicIdOrThrow(dto.sectionPublicId, classItem.id)
            : null;
        const lesson = dto.lessonPublicId
            ? await this.findLessonInClassByPublicIdOrThrow(dto.lessonPublicId, classItem.id)
            : null;
        if (section && lesson?.sectionId && lesson.sectionId !== section.id) {
            throw new BadRequestException('Bài học không thuộc section đã chọn');
        }

        const exam = await this.prisma.$transaction(async (tx) => {
            const created = await tx.exam.create({
                data: {
                    classId: classItem.id,
                    sectionId: section?.id,
                    lessonId: lesson?.id,
                    title: dto.title,
                    description: dto.description,
                    durationMinutes: dto.durationMinutes,
                    maxAttempts: dto.maxAttempts ?? 1,
                    passScore: dto.passScore ?? 5,
                    isPublished: dto.isPublished ?? false
                },
                select: this.examSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.CREATE,
                    module: 'exams',
                    targetType: 'Exam',
                    targetId: created.id,
                    targetPublicId: created.publicId,
                    newValue: this.auditExamValue(created)
                },
                tx
            );

            return created;
        });

        return this.formatExam(exam, true);
    }

    async findByClass(classPublicId: string, query: QueryExamDto, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        const canManage = this.canManageClass(actor, classItem);
        if (!canManage) await this.ensureCanStudyClass(actor, classItem.id);

        const exams = await this.prisma.exam.findMany({
            where: {
                classId: classItem.id,
                ...(query.keyword
                    ? {
                          OR: [{ title: { contains: query.keyword } }, { description: { contains: query.keyword } }]
                      }
                    : {}),
                ...(query.isPublished !== undefined ? { isPublished: query.isPublished } : {}),
                ...(!canManage ? { isPublished: true } : {})
            },
            orderBy: { createdAt: 'desc' },
            select: this.examSelect()
        });

        return exams.map((exam) => this.formatExam(exam, canManage));
    }

    async findOne(publicId: string, actorPublicId: string) {
        const [actor, exam] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findExamRecordOrThrow(publicId)
        ]);
        const canManage = this.canManageClass(actor, exam.class);
        if (!canManage) {
            if (!exam.isPublished) throw new ForbiddenException('Bài kiểm tra chưa được công bố');
            await this.ensureCanStudyClass(actor, exam.classId);
        }

        return this.formatExam(exam, canManage);
    }

    async update(publicId: string, dto: UpdateExamDto, actorPublicId: string) {
        const [actor, exam] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findExamRecordOrThrow(publicId)
        ]);
        this.ensureCanManageClass(actor, exam.class);
        this.ensureClassContentEditable(actor, exam.class);
        const section =
            dto.sectionPublicId === undefined
                ? undefined
                : await this.findSectionInClassByPublicIdOrThrow(dto.sectionPublicId, exam.classId);
        const lesson =
            dto.lessonPublicId === undefined
                ? undefined
                : await this.findLessonInClassByPublicIdOrThrow(dto.lessonPublicId, exam.classId);

        const updated = await this.prisma.$transaction(async (tx) => {
            const item = await tx.exam.update({
                where: { publicId },
                data: {
                    sectionId: section?.id,
                    lessonId: lesson?.id,
                    title: dto.title,
                    description: dto.description,
                    durationMinutes: dto.durationMinutes,
                    maxAttempts: dto.maxAttempts,
                    passScore: dto.passScore,
                    isPublished: dto.isPublished
                },
                select: this.examSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.UPDATE,
                    module: 'exams',
                    targetType: 'Exam',
                    targetId: item.id,
                    targetPublicId: item.publicId,
                    oldValue: this.auditExamValue(exam),
                    newValue: this.auditExamValue(item)
                },
                tx
            );

            return item;
        });

        return this.formatExam(updated, true);
    }

    async remove(publicId: string, actorPublicId: string) {
        const [actor, exam] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findExamRecordOrThrow(publicId)
        ]);
        this.ensureCanManageClass(actor, exam.class);
        this.ensureClassContentEditable(actor, exam.class);

        if ((exam._count.attempts ?? 0) > 0) {
            throw new BadRequestException('Bài kiểm tra đã có lượt làm nên không được xóa');
        }

        await this.prisma.$transaction(async (tx) => {
            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.DELETE,
                    module: 'exams',
                    targetType: 'Exam',
                    targetId: exam.id,
                    targetPublicId: exam.publicId,
                    oldValue: this.auditExamValue(exam)
                },
                tx
            );

            await tx.exam.delete({ where: { publicId } });
        });

        return { publicId, deleted: true };
    }

    async publish(publicId: string, isPublished: boolean, actorPublicId: string) {
        const [actor, exam] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findExamRecordOrThrow(publicId)
        ]);
        this.ensureCanManageClass(actor, exam.class);
        this.ensureClassContentEditable(actor, exam.class);

        if (isPublished && exam.questions.length === 0) {
            throw new BadRequestException('Phải có ít nhất một câu hỏi trước khi công bố bài kiểm tra');
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            const item = await tx.exam.update({
                where: { publicId },
                data: { isPublished },
                select: this.examSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.STATUS_CHANGE,
                    module: 'exams',
                    targetType: 'Exam',
                    targetId: item.id,
                    targetPublicId: item.publicId,
                    oldValue: { isPublished: exam.isPublished },
                    newValue: { isPublished: item.isPublished }
                },
                tx
            );

            if (isPublished && !exam.isPublished) {
                await this.notifyPublishedExam(item, actor.id, tx);
            }

            return item;
        });

        return this.formatExam(updated, true);
    }

    async createQuestion(examPublicId: string, dto: CreateExamQuestionDto, actorPublicId: string) {
        const [actor, exam] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findExamRecordOrThrow(examPublicId)
        ]);
        this.ensureCanManageClass(actor, exam.class);
        this.ensureClassContentEditable(actor, exam.class);
        this.ensureQuestionOptions(dto);
        const sortOrder = dto.sortOrder ?? (await this.nextQuestionSortOrder(exam.id));

        const question = await this.prisma.examQuestion.create({
            data: {
                examId: exam.id,
                type: dto.type ?? ExamQuestionType.SINGLE_CHOICE,
                content: dto.content,
                points: dto.points ?? 1,
                sortOrder,
                options: {
                    create: dto.options.map((option, index) => ({
                        content: option.content,
                        isCorrect: option.isCorrect,
                        sortOrder: option.sortOrder ?? index + 1
                    }))
                }
            },
            select: {
                publicId: true,
                type: true,
                content: true,
                points: true,
                sortOrder: true,
                options: {
                    orderBy: { sortOrder: 'asc' },
                    select: {
                        publicId: true,
                        content: true,
                        isCorrect: true,
                        sortOrder: true
                    }
                }
            }
        });

        await this.auditLogsService.create({
            actorId: actor.id,
            action: AuditAction.CREATE,
            module: 'exam_questions',
            targetType: 'ExamQuestion',
            targetPublicId: question.publicId,
            newValue: {
                examPublicId,
                content: question.content,
                points: question.points
            }
        });

        return question;
    }

    async updateQuestion(publicId: string, dto: UpdateExamQuestionDto, actorPublicId: string) {
        const [actor, question] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findQuestionRecordOrThrow(publicId)
        ]);
        this.ensureCanManageClass(actor, question.exam.class);
        this.ensureClassContentEditable(actor, question.exam.class);
        if (dto.options) this.ensureQuestionOptions({ ...question, ...dto, options: dto.options });

        const updated = await this.prisma.$transaction(async (tx) => {
            const item = await tx.examQuestion.update({
                where: { publicId },
                data: {
                    type: dto.type,
                    content: dto.content,
                    points: dto.points,
                    sortOrder: dto.sortOrder
                },
                select: {
                    id: true,
                    publicId: true,
                    type: true,
                    content: true,
                    points: true,
                    sortOrder: true
                }
            });

            if (dto.options) {
                await tx.examOption.deleteMany({ where: { questionId: item.id } });
                await tx.examOption.createMany({
                    data: dto.options.map((option, index) => ({
                        questionId: item.id,
                        content: option.content,
                        isCorrect: option.isCorrect,
                        sortOrder: option.sortOrder ?? index + 1
                    }))
                });
            }

            return tx.examQuestion.findUniqueOrThrow({
                where: { publicId },
                select: {
                    publicId: true,
                    type: true,
                    content: true,
                    points: true,
                    sortOrder: true,
                    options: {
                        orderBy: { sortOrder: 'asc' },
                        select: {
                            publicId: true,
                            content: true,
                            isCorrect: true,
                            sortOrder: true
                        }
                    }
                }
            });
        });

        await this.auditLogsService.create({
            actorId: actor.id,
            action: AuditAction.UPDATE,
            module: 'exam_questions',
            targetType: 'ExamQuestion',
            targetPublicId: updated.publicId,
            newValue: {
                content: updated.content,
                points: updated.points
            }
        });

        return updated;
    }

    async removeQuestion(publicId: string, actorPublicId: string) {
        const [actor, question] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findQuestionRecordOrThrow(publicId)
        ]);
        this.ensureCanManageClass(actor, question.exam.class);
        this.ensureClassContentEditable(actor, question.exam.class);

        await this.prisma.examQuestion.delete({ where: { publicId } });

        await this.auditLogsService.create({
            actorId: actor.id,
            action: AuditAction.DELETE,
            module: 'exam_questions',
            targetType: 'ExamQuestion',
            targetId: question.id,
            targetPublicId: question.publicId,
            oldValue: {
                content: question.content,
                examPublicId: question.exam.publicId
            }
        });

        return { publicId, deleted: true };
    }

    async startAttempt(examPublicId: string, actorPublicId: string) {
        const [actor, exam] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findExamRecordOrThrow(examPublicId)
        ]);
        if (!exam.isPublished) throw new ForbiddenException('bài kiểm tra chưa được công bố');
        await this.ensureCanStudyClass(actor, exam.classId);

        const attemptCount = await this.prisma.examAttempt.count({
            where: {
                examId: exam.id,
                studentId: actor.id,
                status: ExamAttemptStatus.SUBMITTED
            }
        });
        if (attemptCount >= exam.maxAttempts) {
            throw new BadRequestException('Đã hết số lần làm bài');
        }

        const existing = await this.prisma.examAttempt.findFirst({
            where: {
                examId: exam.id,
                studentId: actor.id,
                status: ExamAttemptStatus.IN_PROGRESS
            },
            select: this.attemptSelect()
        });

        if (existing) return this.formatAttempt(existing);

        const attempt = await this.prisma.examAttempt.create({
            data: {
                examId: exam.id,
                studentId: actor.id
            },
            select: this.attemptSelect()
        });

        return this.formatAttempt(attempt);
    }

    async findAttempt(publicId: string, actorPublicId: string) {
        const [actor, attempt] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findAttemptRecordOrThrow(publicId)
        ]);
        if (!this.canManageClass(actor, attempt.exam.class) && actor.publicId !== attempt.student.publicId) {
            throw new ForbiddenException('Bạn không có quyền truy cập lượt làm bài này');
        }

        return this.formatAttempt(attempt);
    }

    async saveAnswers(publicId: string, dto: SaveAttemptAnswersDto, actorPublicId: string) {
        const [actor, attempt] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findAttemptRecordOrThrow(publicId)
        ]);
        this.ensureOwnAttempt(actor, attempt);
        if (attempt.status !== ExamAttemptStatus.IN_PROGRESS) {
            throw new BadRequestException('Lượt làm bài đã nộp');
        }

        const selectedRows = await this.resolveAnswerRows(attempt.exam.id, dto.answers);
        await this.prisma.$transaction(async (tx) => {
            await tx.examAnswer.deleteMany({ where: { attemptId: attempt.id } });
            if (selectedRows.length > 0) {
                await tx.examAnswer.createMany({
                    data: selectedRows.map((row) => ({
                        attemptId: attempt.id,
                        questionId: row.questionId,
                        optionId: row.optionId
                    }))
                });
            }
            await tx.examAttempt.update({
                where: { id: attempt.id },
                data: {
                    focusLostCount: dto.focusLostCount,
                    violationCount: dto.violationCount
                }
            });
        });

        return this.findAttempt(publicId, actorPublicId);
    }

    async submitAttempt(publicId: string, actorPublicId: string) {
        const [actor, attempt] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findAttemptRecordOrThrow(publicId)
        ]);
        this.ensureOwnAttempt(actor, attempt);
        if (attempt.status !== ExamAttemptStatus.IN_PROGRESS) {
            throw new BadRequestException('Lượt làm bài đã nộp');
        }

        const score = this.calculateScore(attempt);
        const submitted = await this.prisma.examAttempt.update({
            where: { id: attempt.id },
            data: {
                status: ExamAttemptStatus.SUBMITTED,
                submittedAt: new Date(),
                score
            },
            select: this.attemptSelect()
        });

        await this.auditLogsService.create({
            actorId: actor.id,
            action: AuditAction.SUBMIT,
            module: 'exam_attempts',
            targetType: 'ExamAttempt',
            targetId: submitted.id,
            targetPublicId: submitted.publicId,
            newValue: {
                examPublicId: submitted.exam.publicId,
                score
            }
        });

        return this.formatAttempt(submitted);
    }

    private calculateScore(attempt: AttemptWithDetails) {
        const answersByQuestionPublicId = new Map<string, Set<string>>();
        for (const answer of attempt.answers) {
            const selected = answersByQuestionPublicId.get(answer.question.publicId) ?? new Set<string>();
            selected.add(answer.option.publicId);
            answersByQuestionPublicId.set(answer.question.publicId, selected);
        }

        return attempt.exam.questions.reduce((total, question) => {
            const selected = answersByQuestionPublicId.get(question.publicId) ?? new Set<string>();
            const correct = new Set(
                question.options.filter((option) => option.isCorrect).map((option) => option.publicId)
            );
            if (selected.size !== correct.size) return total;
            for (const optionPublicId of selected) {
                if (!correct.has(optionPublicId)) return total;
            }
            return total + question.points;
        }, 0);
    }

    private async resolveAnswerRows(examId: number, answers: SaveAttemptAnswersDto['answers']) {
        const questions = await this.prisma.examQuestion.findMany({
            where: {
                examId,
                publicId: {
                    in: answers.map((answer) => answer.questionPublicId)
                }
            },
            select: {
                id: true,
                publicId: true,
                type: true,
                options: {
                    select: {
                        id: true,
                        publicId: true
                    }
                }
            }
        });
        const questionByPublicId = new Map(questions.map((question) => [question.publicId, question]));
        const rows: { questionId: number; optionId: number }[] = [];

        for (const answer of answers) {
            const question = questionByPublicId.get(answer.questionPublicId);
            if (!question) throw new BadRequestException('Câu trả lời không hợp lệ với bài kiểm tra');
            if (question.type === ExamQuestionType.SINGLE_CHOICE && answer.optionPublicIds.length !== 1) {
                throw new BadRequestException('Câu hỏi một đáp án chỉ được chọn một option');
            }
            const optionByPublicId = new Map(question.options.map((option) => [option.publicId, option]));
            for (const optionPublicId of new Set(answer.optionPublicIds)) {
                const option = optionByPublicId.get(optionPublicId);
                if (!option) throw new BadRequestException('Đáp án không hợp lệ với câu hỏi');
                rows.push({ questionId: question.id, optionId: option.id });
            }
        }

        return rows;
    }

    private ensureQuestionOptions(dto: Pick<CreateExamQuestionDto, 'type' | 'options'>) {
        const correctCount = dto.options.filter((option) => option.isCorrect).length;
        if (correctCount === 0) throw new BadRequestException('Câu hỏi phải có ít nhất một đáp án đúng');
        if ((dto.type ?? ExamQuestionType.SINGLE_CHOICE) === ExamQuestionType.SINGLE_CHOICE && correctCount !== 1) {
            throw new BadRequestException('Câu hỏi một đáp án chỉ được chọn một option');
        }
        const sortOrders = dto.options.map((option, index) => option.sortOrder ?? index + 1);
        if (new Set(sortOrders).size !== sortOrders.length) {
            throw new BadRequestException('Thứ tự đáp án bị trùng');
        }
    }

    private ensureOwnAttempt(actor: Actor, attempt: AttemptWithDetails) {
        if (actor.publicId !== attempt.student.publicId) {
            throw new ForbiddenException('Chỉ sinh viên sở hữu lượt làm bài mới được thao tác');
        }
    }

    private async notifyPublishedExam(exam: ExamWithDetails, actorId: number, tx: Prisma.TransactionClient) {
        const enrollments = await tx.enrollment.findMany({
            where: {
                classId: exam.classId,
                status: EnrollmentStatus.APPROVED
            },
            select: { studentId: true }
        });

        await this.notificationsService.createMany(
            {
                recipientIds: enrollments.map((enrollment) => enrollment.studentId),
                actorId,
                type: 'EXAM_PUBLISHED',
                title: `Bài kiểm tra mới: ${exam.title}`,
                message: `${exam.class.name} vừa có bài kiểm tra mới.`,
                data: {
                    classPublicId: exam.class.publicId,
                    examPublicId: exam.publicId
                }
            },
            tx
        );
    }

    private canManageClass(actor: Actor, classItem: ClassAccessRecord) {
        if (['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code)) return true;
        if (actor.role.code === 'DEPARTMENT_HEAD' && actor.id === classItem.departmentHeadId) return true;
        if (actor.role.code === 'LECTURER' && actor.id === classItem.lecturerId) return true;
        return false;
    }

    private ensureCanManageClass(actor: Actor, classItem: ClassAccessRecord) {
        if (!this.canManageClass(actor, classItem)) {
            throw new ForbiddenException('Bạn không có quyền quản lý bài kiểm tra của lớp này');
        }
    }

    private ensureClassContentEditable(actor: Actor, classItem: Pick<ClassAccessRecord, 'status'>) {
        if (classItem.status === ClassStatus.COMPLETED && !['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code)) {
            throw new BadRequestException('Lớp đã hoàn thành, chỉ Admin hoặc PDT được sửa nội dung');
        }
    }

    private async ensureCanStudyClass(actor: Actor, classId: number) {
        if (actor.role.code !== 'STUDENT') {
            throw new ForbiddenException('Bạn không có quyền làm bài lớp này');
        }

        const enrollment = await this.prisma.enrollment.findFirst({
            where: {
                studentId: actor.id,
                classId,
                status: EnrollmentStatus.APPROVED
            },
            select: { id: true }
        });

        if (!enrollment) throw new ForbiddenException('Sinh viên chưa được ghi danh vào lớp này');
    }

    private async nextQuestionSortOrder(examId: number) {
        const last = await this.prisma.examQuestion.findFirst({
            where: { examId },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true }
        });

        return (last?.sortOrder ?? 0) + 1;
    }

    private async findUserByPublicIdOrThrow(publicId: string) {
        const user = await this.prisma.user.findFirst({
            where: { publicId, deletedAt: null },
            select: {
                id: true,
                publicId: true,
                fullName: true,
                role: { select: { code: true } }
            }
        });
        if (!user) throw new NotFoundException('Không tìm thấy người dùng');
        if (!user.role) throw new ForbiddenException('Người dùng chưa được gán vai trò');
        return { ...user, role: user.role };
    }

    private async findClassRecordOrThrow(publicId: string) {
        const classItem = await this.prisma.class.findUnique({
            where: { publicId },
            select: {
                id: true,
                publicId: true,
                code: true,
                name: true,
                status: true,
                lecturerId: true,
                departmentHeadId: true
            }
        });
        if (!classItem) throw new NotFoundException('Không tìm thấy lớp học');
        return classItem;
    }

    private async findSectionInClassByPublicIdOrThrow(publicId: string, classId: number) {
        const section = await this.prisma.lessonSection.findFirst({
            where: { publicId, classId },
            select: { id: true }
        });
        if (!section) throw new BadRequestException('Section không hợp lệ với lớp này');
        return section;
    }

    private async findLessonInClassByPublicIdOrThrow(publicId: string, classId: number) {
        const lesson = await this.prisma.lesson.findFirst({
            where: { publicId, classId },
            select: { id: true, sectionId: true }
        });
        if (!lesson) throw new BadRequestException('Bài học không hợp lệ với lớp này');
        return lesson;
    }

    private async findExamRecordOrThrow(publicId: string) {
        const exam = await this.prisma.exam.findUnique({
            where: { publicId },
            select: this.examSelect()
        });
        if (!exam) throw new NotFoundException('Không tìm thấy bài kiểm tra');
        return exam;
    }

    private async findQuestionRecordOrThrow(publicId: string) {
        const question = await this.prisma.examQuestion.findUnique({
            where: { publicId },
            select: {
                id: true,
                publicId: true,
                type: true,
                content: true,
                points: true,
                sortOrder: true,
                exam: {
                    select: this.examSelect()
                }
            }
        });
        if (!question) throw new NotFoundException('Không tìm thấy câu hỏi');
        return question;
    }

    private async findAttemptRecordOrThrow(publicId: string) {
        const attempt = await this.prisma.examAttempt.findUnique({
            where: { publicId },
            select: this.attemptSelect()
        });
        if (!attempt) throw new NotFoundException('Không tìm thấy lượt làm bài');
        return attempt;
    }

    private examSelect() {
        return examSelect();
    }

    private attemptSelect() {
        return attemptSelect();
    }

    private auditExamValue(exam: ExamWithDetails) {
        return {
            classId: exam.classId,
            sectionId: exam.sectionId,
            lessonId: exam.lessonId,
            title: exam.title,
            maxAttempts: exam.maxAttempts,
            passScore: exam.passScore,
            isPublished: exam.isPublished
        };
    }

    private formatExam(exam: ExamWithDetails, canManage: boolean) {
        const { id: _id, _count, questions, ...rest } = exam;
        void _id;

        return {
            ...rest,
            attemptCount: _count?.attempts ?? 0,
            questions: questions.map((question) => {
                const { id: _questionId, options, ...questionRest } = question;
                void _questionId;
                return {
                    ...questionRest,
                    options: options.map((option) => {
                        const { id: _optionId, isCorrect, ...optionRest } = option;
                        void _optionId;
                        return canManage ? { ...optionRest, isCorrect } : optionRest;
                    })
                };
            })
        };
    }

    private formatAttempt(attempt: AttemptWithDetails) {
        const { id: _id, exam, ...rest } = attempt;
        void _id;

        return {
            ...rest,
            exam: this.formatExam(exam, attempt.status === ExamAttemptStatus.SUBMITTED),
            answers: attempt.answers.map((answer) => ({
                question: answer.question,
                option: answer.option
            }))
        };
    }
}
