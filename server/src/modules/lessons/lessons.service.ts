import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EnrollmentStatus, LessonType, Prisma } from '@prisma/client';

import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { NotificationsService } from '~/modules/notifications/notifications.service';
import { PrismaService } from '~/prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CodeFileDto, CodeTestDto, SubmitCodeLessonDto } from './dto/code-lesson.dto';
import { QueryLessonDto } from './dto/query-lesson.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

const lessonSelect = () =>
    ({
        id: true,
        publicId: true,
        classId: true,
        sectionId: true,
        title: true,
        description: true,
        type: true,
        content: true,
        resourceUrl: true,
        codeConfig: true,
        durationMinutes: true,
        sortOrder: true,
        isPublished: true,
        class: {
            select: {
                id: true,
                publicId: true,
                code: true,
                name: true,
                status: true,
                lecturerId: true,
                departmentHeadId: true,
                course: {
                    select: {
                        publicId: true,
                        code: true,
                        name: true,
                        departmentId: true
                    }
                }
            }
        },
        section: {
            select: {
                publicId: true,
                title: true,
                sortOrder: true,
                isPublished: true
            }
        },
        _count: {
            select: {
                progress: {
                    where: {
                        completedAt: {
                            not: null
                        }
                    }
                }
            }
        },
        createdAt: true,
        updatedAt: true
    }) satisfies Prisma.LessonSelect;

type LessonWithDetails = Prisma.LessonGetPayload<{ select: ReturnType<typeof lessonSelect> }>;
type Actor = Awaited<ReturnType<LessonsService['findUserByPublicIdOrThrow']>>;
type ClassAccessRecord = Awaited<ReturnType<LessonsService['findClassRecordOrThrow']>>;
type CodeTestResult = {
    name: string;
    type: CodeTestDto['type'];
    passed: boolean;
    message: string;
};

@Injectable()
export class LessonsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService,
        private readonly notificationsService: NotificationsService
    ) {}

    async create(classPublicId: string, dto: CreateLessonDto, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        this.ensureCanManageClass(actor, classItem);
        this.ensureClassContentEditable(actor, classItem);
        const section = dto.sectionPublicId
            ? await this.findSectionInClassByPublicIdOrThrow(dto.sectionPublicId, classItem.id)
            : null;
        await this.ensureLessonOrderAvailable(classItem.id, section?.id ?? null, dto.sortOrder);

        const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(classItem.id, section?.id ?? null));
        const lesson = await this.prisma.$transaction(async (tx) => {
            const created = await tx.lesson.create({
                data: {
                    classId: classItem.id,
                    sectionId: section?.id,
                    title: dto.title,
                    description: dto.description,
                    type: dto.type ?? LessonType.TEXT,
                    content: dto.content,
                    resourceUrl: dto.resourceUrl,
                    codeConfig: dto.codeConfig === undefined ? undefined : this.toJsonInput(dto.codeConfig),
                    durationMinutes: dto.durationMinutes,
                    sortOrder,
                    isPublished: dto.isPublished ?? false
                },
                select: this.lessonSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.CREATE,
                    module: 'lessons',
                    targetType: 'Lesson',
                    targetId: created.id,
                    targetPublicId: created.publicId,
                    newValue: this.auditLessonValue(created)
                },
                tx
            );

            return created;
        });

        return this.formatLesson(lesson);
    }

    async createInSection(sectionPublicId: string, dto: CreateLessonDto, actorPublicId: string) {
        const section = await this.prisma.lessonSection.findUnique({
            where: { publicId: sectionPublicId },
            select: {
                publicId: true,
                class: {
                    select: {
                        publicId: true
                    }
                }
            }
        });

        if (!section) {
            throw new NotFoundException('Không tìm thấy section');
        }

        return this.create(section.class.publicId, { ...dto, sectionPublicId: section.publicId }, actorPublicId);
    }

    async findByClass(classPublicId: string, query: QueryLessonDto, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        const canManage = this.canManageClass(actor, classItem);
        if (!canManage) await this.ensureCanStudyClass(actor, classItem.id);

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const andConditions: Prisma.LessonWhereInput[] = [
            ...(query.keyword
                ? [
                      {
                          OR: [{ title: { contains: query.keyword } }, { description: { contains: query.keyword } }]
                      }
                  ]
                : []),
            ...(!canManage ? [{ OR: [{ sectionId: null }, { section: { isPublished: true } }] }] : [])
        ];
        const where: Prisma.LessonWhereInput = {
            classId: classItem.id,
            ...(query.type ? { type: query.type } : {}),
            ...(query.sectionPublicId ? { section: { publicId: query.sectionPublicId } } : {}),
            ...(query.isPublished !== undefined ? { isPublished: query.isPublished } : {}),
            ...(!canManage ? { isPublished: true } : {}),
            ...(andConditions.length > 0 ? { AND: andConditions } : {})
        };

        const [items, total, progressItems] = await Promise.all([
            this.prisma.lesson.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                select: this.lessonSelect()
            }),
            this.prisma.lesson.count({ where }),
            this.prisma.lessonProgress.findMany({
                where: {
                    studentId: actor.id,
                    lesson: {
                        classId: classItem.id
                    }
                },
                select: {
                    lessonId: true,
                    completedAt: true,
                    lastViewedAt: true
                }
            })
        ]);
        const progressByLessonId = new Map(progressItems.map((item) => [item.lessonId, item]));

        return {
            items: items.map((lesson) => this.formatLesson(lesson, progressByLessonId.get(lesson.id))),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async findOne(publicId: string, actorPublicId: string) {
        const [actor, lesson] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findLessonRecordOrThrow(publicId)
        ]);
        const canManage = this.canManageClass(actor, lesson.class);
        if (!canManage) {
            if (!lesson.isPublished) throw new ForbiddenException('Bài học chưa công bố');
            await this.ensureCanStudyClass(actor, lesson.classId);
        }

        const progress = await this.prisma.lessonProgress.findUnique({
            where: {
                lessonId_studentId: {
                    lessonId: lesson.id,
                    studentId: actor.id
                }
            },
            select: {
                completedAt: true,
                lastViewedAt: true
            }
        });

        return this.formatLesson(lesson, progress ?? undefined);
    }

    async update(publicId: string, dto: UpdateLessonDto, actorPublicId: string) {
        const [actor, lesson] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findLessonRecordOrThrow(publicId)
        ]);
        this.ensureCanManageClass(actor, lesson.class);
        this.ensureClassContentEditable(actor, lesson.class);
        const section =
            dto.sectionPublicId === undefined
                ? undefined
                : await this.findSectionInClassByPublicIdOrThrow(dto.sectionPublicId, lesson.classId);
        await this.ensureLessonOrderAvailable(
            lesson.classId,
            section?.id ?? lesson.sectionId,
            dto.sortOrder,
            lesson.id
        );

        const updated = await this.prisma.$transaction(async (tx) => {
            const item = await tx.lesson.update({
                where: { publicId },
                data: {
                    sectionId: section?.id,
                    title: dto.title,
                    description: dto.description,
                    type: dto.type,
                    content: dto.content,
                    resourceUrl: dto.resourceUrl,
                    codeConfig: dto.codeConfig === undefined ? undefined : this.toJsonInput(dto.codeConfig),
                    durationMinutes: dto.durationMinutes,
                    sortOrder: dto.sortOrder,
                    isPublished: dto.isPublished
                },
                select: this.lessonSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.UPDATE,
                    module: 'lessons',
                    targetType: 'Lesson',
                    targetId: item.id,
                    targetPublicId: item.publicId,
                    oldValue: this.auditLessonValue(lesson),
                    newValue: this.auditLessonValue(item)
                },
                tx
            );

            return item;
        });

        return this.formatLesson(updated);
    }

    async remove(publicId: string, actorPublicId: string) {
        const [actor, lesson] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findLessonRecordOrThrow(publicId)
        ]);
        this.ensureCanManageClass(actor, lesson.class);
        this.ensureClassContentEditable(actor, lesson.class);

        await this.prisma.$transaction(async (tx) => {
            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.DELETE,
                    module: 'lessons',
                    targetType: 'Lesson',
                    targetId: lesson.id,
                    targetPublicId: lesson.publicId,
                    oldValue: this.auditLessonValue(lesson)
                },
                tx
            );

            await tx.lesson.delete({ where: { publicId } });
        });

        return { publicId, deleted: true };
    }

    async publish(publicId: string, isPublished: boolean, actorPublicId: string) {
        const [actor, lesson] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findLessonRecordOrThrow(publicId)
        ]);
        this.ensureCanManageClass(actor, lesson.class);
        this.ensureClassContentEditable(actor, lesson.class);

        const updated = await this.prisma.$transaction(async (tx) => {
            const item = await tx.lesson.update({
                where: { publicId },
                data: { isPublished },
                select: this.lessonSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.STATUS_CHANGE,
                    module: 'lessons',
                    targetType: 'Lesson',
                    targetId: item.id,
                    targetPublicId: item.publicId,
                    oldValue: { isPublished: lesson.isPublished },
                    newValue: { isPublished: item.isPublished }
                },
                tx
            );

            if (isPublished && !lesson.isPublished) {
                await this.notifyPublishedLesson(item, actor.id, tx);
            }

            return item;
        });

        return this.formatLesson(updated);
    }

    async reorder(classPublicId: string, dto: ReorderLessonsDto, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        this.ensureCanManageClass(actor, classItem);
        this.ensureClassContentEditable(actor, classItem);
        this.ensureUniqueOrderPayload(dto);

        const lessons = await this.prisma.lesson.findMany({
            where: {
                classId: classItem.id,
                publicId: {
                    in: dto.items.map((item) => item.publicId)
                }
            },
            select: { id: true, publicId: true }
        });

        if (lessons.length !== dto.items.length) {
            throw new BadRequestException('Danh sách bài học không hợp lệ với lớp này');
        }

        const orderByPublicId = new Map(dto.items.map((item) => [item.publicId, item.sortOrder]));
        await this.prisma.$transaction(async (tx) => {
            for (const lesson of lessons) {
                await tx.lesson.update({
                    where: { id: lesson.id },
                    data: { sortOrder: -lesson.id }
                });
            }

            for (const lesson of lessons) {
                await tx.lesson.update({
                    where: { id: lesson.id },
                    data: { sortOrder: orderByPublicId.get(lesson.publicId) }
                });
            }

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.UPDATE,
                    module: 'lessons',
                    targetType: 'Class',
                    targetId: classItem.id,
                    targetPublicId: classItem.publicId,
                    newValue: {
                        order: dto.items.map((item) => ({
                            publicId: item.publicId,
                            sortOrder: item.sortOrder
                        }))
                    }
                },
                tx
            );
        });

        return this.findByClass(classPublicId, {}, actorPublicId);
    }

    async complete(publicId: string, actorPublicId: string) {
        return this.setCompletion(publicId, actorPublicId, true);
    }

    async uncomplete(publicId: string, actorPublicId: string) {
        return this.setCompletion(publicId, actorPublicId, false);
    }

    async checkCode(publicId: string, dto: SubmitCodeLessonDto, actorPublicId: string) {
        const [actor, lesson] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findLessonRecordOrThrow(publicId)
        ]);
        await this.ensureCodeLessonCanSubmit(actor, lesson);

        const files = this.normalizeCodeFiles(dto.files);
        const result = this.runCodeTests(lesson.codeConfig, files);

        return {
            lessonPublicId: lesson.publicId,
            ...result
        };
    }

    async submitCode(publicId: string, dto: SubmitCodeLessonDto, actorPublicId: string) {
        const [actor, lesson] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findLessonRecordOrThrow(publicId)
        ]);
        await this.ensureCodeLessonCanSubmit(actor, lesson);

        const files = this.normalizeCodeFiles(dto.files);
        const result = this.runCodeTests(lesson.codeConfig, files);
        const submission = await this.prisma.$transaction(async (tx) => {
            const created = await tx.codeSubmission.create({
                data: {
                    lessonId: lesson.id,
                    studentId: actor.id,
                    files: this.toJsonInput(files),
                    results: this.toJsonInput(result.results),
                    passed: result.passed,
                    score: result.score
                },
                select: this.codeSubmissionSelect()
            });

            if (result.passed) {
                await tx.lessonProgress.upsert({
                    where: {
                        lessonId_studentId: {
                            lessonId: lesson.id,
                            studentId: actor.id
                        }
                    },
                    update: {
                        completedAt: new Date(),
                        lastViewedAt: new Date()
                    },
                    create: {
                        lessonId: lesson.id,
                        studentId: actor.id,
                        completedAt: new Date()
                    }
                });
            }

            return created;
        });

        return submission;
    }

    async myCodeSubmissions(publicId: string, actorPublicId: string) {
        const [actor, lesson] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findLessonRecordOrThrow(publicId)
        ]);
        await this.ensureCodeLessonCanSubmit(actor, lesson);

        return this.prisma.codeSubmission.findMany({
            where: {
                lessonId: lesson.id,
                studentId: actor.id
            },
            orderBy: { submittedAt: 'desc' },
            select: this.codeSubmissionSelect()
        });
    }

    async codeSubmissions(publicId: string, actorPublicId: string) {
        const [actor, lesson] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findLessonRecordOrThrow(publicId)
        ]);
        this.ensureCanManageClass(actor, lesson.class);
        if (lesson.type !== LessonType.CODE) throw new BadRequestException('Bài học nay không phải CODE');

        return this.prisma.codeSubmission.findMany({
            where: { lessonId: lesson.id },
            orderBy: { submittedAt: 'desc' },
            select: this.codeSubmissionSelect()
        });
    }

    async myProgress(classPublicId: string, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        await this.ensureCanStudyClass(actor, classItem.id);

        return this.buildStudentProgress(classItem.id, actor.id);
    }

    async classProgress(classPublicId: string, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        this.ensureCanManageClass(actor, classItem);

        const [lessonCount, enrollments] = await Promise.all([
            this.prisma.lesson.count({
                where: {
                    classId: classItem.id,
                    isPublished: true
                }
            }),
            this.prisma.enrollment.findMany({
                where: {
                    classId: classItem.id,
                    status: EnrollmentStatus.APPROVED
                },
                orderBy: {
                    enrolledAt: 'desc'
                },
                select: {
                    student: {
                        select: {
                            id: true,
                            publicId: true,
                            code: true,
                            fullName: true,
                            email: true
                        }
                    }
                }
            })
        ]);

        const rows = await Promise.all(
            enrollments.map(async (enrollment) => {
                const progress = await this.buildStudentProgress(classItem.id, enrollment.student.id);
                return {
                    student: {
                        publicId: enrollment.student.publicId,
                        code: enrollment.student.code,
                        fullName: enrollment.student.fullName,
                        email: enrollment.student.email
                    },
                    ...progress
                };
            })
        );

        return {
            classPublicId,
            lessonCount,
            students: rows
        };
    }

    private async setCompletion(publicId: string, actorPublicId: string, completed: boolean) {
        const [actor, lesson] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findLessonRecordOrThrow(publicId)
        ]);
        if (!lesson.isPublished) throw new ForbiddenException('Bài học chưa được công bố');
        await this.ensureCanStudyClass(actor, lesson.classId);
        if (completed && lesson.type === LessonType.CODE) {
            const passedSubmission = await this.prisma.codeSubmission.findFirst({
                where: {
                    lessonId: lesson.id,
                    studentId: actor.id,
                    passed: true
                },
                select: { id: true }
            });

            if (!passedSubmission) {
                throw new BadRequestException('Cần nộp code và đạt bài kiểm tra trước khi hoàn thành bài CODE');
            }
        }

        const progress = await this.prisma.lessonProgress.upsert({
            where: {
                lessonId_studentId: {
                    lessonId: lesson.id,
                    studentId: actor.id
                }
            },
            update: {
                completedAt: completed ? new Date() : null,
                lastViewedAt: new Date()
            },
            create: {
                lessonId: lesson.id,
                studentId: actor.id,
                completedAt: completed ? new Date() : null
            },
            select: {
                completedAt: true,
                lastViewedAt: true,
                lesson: {
                    select: this.lessonSelect()
                }
            }
        });

        return this.formatLesson(progress.lesson, progress);
    }

    private ensureCodeLessonCanSubmit(actor: Actor, lesson: LessonWithDetails) {
        if (lesson.type !== LessonType.CODE) throw new BadRequestException('Bài học nay không phải CODE');
        if (!lesson.isPublished) throw new ForbiddenException('Bài học chưa được công bố');
        return this.ensureCanStudyClass(actor, lesson.classId);
    }

    private normalizeCodeFiles(files: CodeFileDto[]) {
        if (files.length === 0) throw new BadRequestException('Cần có ít nhất một file code');
        const seenPaths = new Set<string>();
        return files.map((file) => {
            const path = file.path.trim();
            if (!path) throw new BadRequestException('Đường dẫn file không hợp lệ');
            if (seenPaths.has(path)) throw new BadRequestException(`File ${path} bị trùng`);
            seenPaths.add(path);

            return {
                path,
                language: file.language,
                content: file.content ?? '',
                readonly: file.readonly ?? false
            };
        });
    }

    private runCodeTests(codeConfig: Prisma.JsonValue, files: CodeFileDto[]) {
        const tests = this.extractCodeTests(codeConfig);
        const results = tests.map((test) => this.runCodeTest(test, files));
        const passed = results.every((result) => result.passed);
        const score =
            results.length > 0
                ? Math.round((results.filter((result) => result.passed).length / results.length) * 100)
                : 100;

        return {
            passed,
            score,
            results
        };
    }

    private runCodeTest(test: CodeTestDto, files: CodeFileDto[]): CodeTestResult {
        const targetFile = test.file ? files.find((file) => file.path === test.file) : undefined;

        if (test.type === 'FILE_EXISTS') {
            return {
                name: test.name,
                type: test.type,
                passed: Boolean(targetFile),
                message: targetFile ? 'File tồn tại' : `Không tìm thấy file ${test.file ?? ''}`
            };
        }

        if (!targetFile) {
            return {
                name: test.name,
                type: test.type,
                passed: false,
                message: `Không tìm thấy file ${test.file ?? ''}`
            };
        }

        const expected = test.expected ?? '';
        const content = targetFile.content ?? '';
        if (test.type === 'TEXT_CONTAINS') {
            const passed = content.includes(expected);
            return {
                name: test.name,
                type: test.type,
                passed,
                message: passed ? 'Đạt' : `File không chứa: ${expected}`
            };
        }

        if (test.type === 'TEXT_NOT_CONTAINS') {
            const passed = !content.includes(expected);
            return {
                name: test.name,
                type: test.type,
                passed,
                message: passed ? 'Đạt' : `File đang chứa nội dung cấm: ${expected}`
            };
        }

        try {
            const regex = new RegExp(expected);
            const passed = regex.test(content);
            return {
                name: test.name,
                type: test.type,
                passed,
                message: passed ? 'Dat' : `Không khớp regex: ${expected}`
            };
        } catch {
            return {
                name: test.name,
                type: test.type,
                passed: false,
                message: `Regex không hợp lệ: ${expected}`
            };
        }
    }

    private extractCodeTests(codeConfig: Prisma.JsonValue): CodeTestDto[] {
        if (!codeConfig || typeof codeConfig !== 'object' || Array.isArray(codeConfig)) return [];
        const tests = codeConfig.tests;
        if (!Array.isArray(tests)) return [];

        return tests.flatMap((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
            const name = typeof item.name === 'string' ? item.name : null;
            const type = typeof item.type === 'string' ? item.type : null;
            if (!name || !this.isCodeTestType(type)) return [];
            return [
                {
                    name,
                    type,
                    file: typeof item.file === 'string' ? item.file : undefined,
                    expected: typeof item.expected === 'string' ? item.expected : undefined
                }
            ];
        });
    }

    private isCodeTestType(value: string | null): value is CodeTestDto['type'] {
        return (
            value === 'TEXT_CONTAINS' ||
            value === 'TEXT_NOT_CONTAINS' ||
            value === 'REGEX_MATCH' ||
            value === 'FILE_EXISTS'
        );
    }

    private toJsonInput(value: unknown): Prisma.InputJsonValue {
        return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    }

    private codeSubmissionSelect() {
        return {
            publicId: true,
            files: true,
            results: true,
            passed: true,
            score: true,
            submittedAt: true,
            student: {
                select: {
                    publicId: true,
                    code: true,
                    fullName: true,
                    email: true
                }
            },
            lesson: {
                select: {
                    publicId: true,
                    title: true
                }
            }
        } satisfies Prisma.CodeSubmissionSelect;
    }

    private async buildStudentProgress(classId: number, studentId: number) {
        const [lessonCount, completedCount, progressItems] = await Promise.all([
            this.prisma.lesson.count({
                where: {
                    classId,
                    isPublished: true
                }
            }),
            this.prisma.lessonProgress.count({
                where: {
                    studentId,
                    completedAt: {
                        not: null
                    },
                    lesson: {
                        classId,
                        isPublished: true
                    }
                }
            }),
            this.prisma.lessonProgress.findMany({
                where: {
                    studentId,
                    lesson: {
                        classId,
                        isPublished: true
                    }
                },
                select: {
                    completedAt: true,
                    lastViewedAt: true,
                    lesson: {
                        select: {
                            publicId: true,
                            section: {
                                select: {
                                    publicId: true,
                                    title: true,
                                    sortOrder: true
                                }
                            },
                            title: true,
                            sortOrder: true
                        }
                    }
                },
                orderBy: {
                    lesson: {
                        sortOrder: 'asc'
                    }
                }
            })
        ]);

        return {
            lessonCount,
            completedCount,
            completionRate: lessonCount > 0 ? Math.round((completedCount / lessonCount) * 100) : 0,
            lessons: progressItems.map((item) => ({
                publicId: item.lesson.publicId,
                title: item.lesson.title,
                section: item.lesson.section,
                sortOrder: item.lesson.sortOrder,
                completedAt: item.completedAt,
                lastViewedAt: item.lastViewedAt,
                isCompleted: Boolean(item.completedAt)
            }))
        };
    }

    private async notifyPublishedLesson(lesson: LessonWithDetails, actorId: number, tx: Prisma.TransactionClient) {
        const enrollments = await tx.enrollment.findMany({
            where: {
                classId: lesson.classId,
                status: EnrollmentStatus.APPROVED
            },
            select: { studentId: true }
        });

        await this.notificationsService.createMany(
            {
                recipientIds: enrollments.map((enrollment) => enrollment.studentId),
                actorId,
                type: 'LESSON_PUBLISHED',
                title: `Bài học mới: ${lesson.title}`,
                message: `${lesson.class.name} vừa có bài học mới.`,
                data: {
                    classPublicId: lesson.class.publicId,
                    coursePublicId: lesson.class.course.publicId,
                    lessonPublicId: lesson.publicId
                }
            },
            tx
        );
    }

    private canManageClass(actor: Actor, classItem: ClassAccessRecord | LessonWithDetails['class']) {
        if (['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code)) return true;
        if (actor.role.code === 'DEPARTMENT_HEAD' && actor.id === classItem.departmentHeadId) return true;
        if (actor.role.code === 'LECTURER' && actor.id === classItem.lecturerId) return true;
        return false;
    }

    private ensureCanManageClass(actor: Actor, classItem: ClassAccessRecord | LessonWithDetails['class']) {
        if (!this.canManageClass(actor, classItem)) {
            throw new ForbiddenException('Bạn không có quyền quản lý bài học của lớp này');
        }
    }

    private ensureClassContentEditable(actor: Actor, classItem: { status?: string | null }) {
        if (classItem.status === 'COMPLETED' && !['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code)) {
            throw new BadRequestException(
                'Lớp đã hoàn thành, chỉ Admin và Phòng Đào Tạo mới có thể chỉnh sửa nội dung'
            );
        }
    }

    private async ensureCanStudyClass(actor: Actor, classId: number) {
        if (actor.role.code !== 'STUDENT') {
            throw new ForbiddenException('Bạn không có quyền học lớp này');
        }

        const enrollment = await this.prisma.enrollment.findFirst({
            where: {
                studentId: actor.id,
                classId,
                status: EnrollmentStatus.APPROVED
            },
            select: { id: true }
        });

        if (!enrollment) {
            throw new ForbiddenException('Sinh viên chưa được ghi danh vào lớp này');
        }
    }

    private async ensureLessonOrderAvailable(
        classId: number,
        sectionId: number | null,
        sortOrder?: number,
        exceptLessonId?: number
    ) {
        if (sortOrder === undefined) return;

        const duplicate = await this.prisma.lesson.findFirst({
            where: {
                classId,
                sectionId,
                sortOrder,
                ...(exceptLessonId ? { id: { not: exceptLessonId } } : {})
            },
            select: { id: true }
        });

        if (duplicate) throw new BadRequestException('Thu tu bai hoc da ton tai trong lop nay');
    }

    private ensureUniqueOrderPayload(dto: ReorderLessonsDto) {
        const publicIds = new Set(dto.items.map((item) => item.publicId));
        const sortOrders = new Set(dto.items.map((item) => item.sortOrder));
        if (publicIds.size !== dto.items.length || sortOrders.size !== dto.items.length) {
            throw new BadRequestException('Danh sách sắp xếp bị trung bài học hoặc thứ tự');
        }
        if (dto.items.some((item) => item.sortOrder < 1)) {
            throw new BadRequestException('Thứ tự bài học phải lớn hơn 0');
        }
    }

    private async nextSortOrder(classId: number, sectionId: number | null) {
        const last = await this.prisma.lesson.findFirst({
            where: { classId, sectionId },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true }
        });

        return (last?.sortOrder ?? 0) + 1;
    }

    private async findSectionInClassByPublicIdOrThrow(publicId: string, classId: number) {
        const section = await this.prisma.lessonSection.findFirst({
            where: {
                publicId,
                classId
            },
            select: {
                id: true,
                publicId: true,
                classId: true
            }
        });

        if (!section) {
            throw new BadRequestException('Section không hợp lệ với lớp này');
        }

        return section;
    }

    private async findUserByPublicIdOrThrow(publicId: string) {
        const user = await this.prisma.user.findFirst({
            where: { publicId, deletedAt: null },
            select: {
                id: true,
                publicId: true,
                fullName: true,
                role: {
                    select: {
                        code: true
                    }
                }
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
                departmentHeadId: true,
                course: {
                    select: {
                        departmentId: true
                    }
                }
            }
        });
        if (!classItem) throw new NotFoundException('Không tìm thấy lớp học');
        return classItem;
    }

    private async findLessonRecordOrThrow(publicId: string) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { publicId },
            select: this.lessonSelect()
        });
        if (!lesson) throw new NotFoundException('Không tìm thấy bài học');
        return lesson;
    }

    private lessonSelect() {
        return lessonSelect();
    }

    private auditLessonValue(lesson: LessonWithDetails) {
        return {
            classId: lesson.classId,
            sectionId: lesson.sectionId,
            title: lesson.title,
            type: lesson.type,
            resourceUrl: lesson.resourceUrl,
            durationMinutes: lesson.durationMinutes,
            sortOrder: lesson.sortOrder,
            isPublished: lesson.isPublished
        };
    }

    private formatLesson(lesson: LessonWithDetails, progress?: { completedAt: Date | null; lastViewedAt: Date }) {
        const { id: _id, _count, ...rest } = lesson;
        void _id;

        return {
            ...rest,
            completedCount: _count?.progress ?? 0,
            progress: progress
                ? {
                      completedAt: progress.completedAt,
                      lastViewedAt: progress.lastViewedAt,
                      isCompleted: Boolean(progress.completedAt)
                  }
                : null
        };
    }
}
