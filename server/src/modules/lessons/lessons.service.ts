import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EnrollmentStatus, LessonContentType, LessonProgressStatus, LessonStatus, Prisma } from '@prisma/client';

import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { PrismaService } from '~/prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { HideLessonDto } from './dto/hide-lesson.dto';
import { QueryLessonDto } from './dto/query-lesson.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

const lessonSelect = (includeDetails = false) =>
    ({
        id: true,
        publicId: true,
        classId: true,
        title: true,
        description: true,
        chapter: true,
        orderIndex: true,
        durationMinutes: true,
        status: true,
        primaryContentType: true,
        allowStudentView: true,
        allowDownload: true,
        requirePreviousCompletion: true,
        availableFrom: true,
        availableUntil: true,
        trackProgress: true,
        hasVideo: true,
        hasAttachment: true,
        hasLinkedExam: true,
        publishedAt: true,
        hiddenAt: true,
        hiddenReason: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        class: {
            select: {
                id: true,
                publicId: true,
                code: true,
                name: true,
                lecturerId: true,
                assistantId: true,
                departmentHeadId: true,
                course: {
                    select: {
                        id: true,
                        publicId: true,
                        code: true,
                        name: true,
                        departmentId: true,
                        department: { select: { id: true, publicId: true, code: true, name: true } }
                    }
                },
                lecturer: { select: { id: true, publicId: true, code: true, fullName: true, email: true } },
                departmentHead: { select: { id: true, publicId: true, code: true, fullName: true, email: true } }
            }
        },
        createdBy: { select: { id: true, publicId: true, code: true, fullName: true, email: true } },
        publishedBy: { select: { id: true, publicId: true, code: true, fullName: true } },
        hiddenBy: { select: { id: true, publicId: true, code: true, fullName: true } },
        blocks: includeDetails
            ? { orderBy: { orderIndex: 'asc' as const } }
            : {
                  take: 3,
                  orderBy: { orderIndex: 'asc' as const },
                  select: { publicId: true, type: true, title: true, orderIndex: true, fileName: true, fileUrl: true }
              },
        attachments: includeDetails ? { orderBy: { uploadedAt: 'desc' as const } } : false,
        progresses: includeDetails
            ? {
                  orderBy: { updatedAt: 'desc' as const },
                  select: {
                      publicId: true,
                      status: true,
                      progressPercent: true,
                      lastViewedAt: true,
                      completedAt: true,
                      student: { select: { publicId: true, code: true, fullName: true, email: true } }
                  }
              }
            : false,
        _count: { select: { blocks: true, attachments: true, progresses: true } }
    }) satisfies Prisma.LessonSelect;

type LessonWithDetails = Prisma.LessonGetPayload<{ select: ReturnType<typeof lessonSelect> }>;

@Injectable()
export class LessonsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService
    ) {}

    async summary(query: QueryLessonDto, actorPublicId: string) {
        const actor = await this.findActor(actorPublicId);
        const where = await this.buildWhere(query, actor);
        const [
            total,
            draft,
            published,
            hidden,
            withVideo,
            withExam,
            completedCount,
            progressAggregate
        ] = await Promise.all([
            this.prisma.lesson.count({ where }),
            this.prisma.lesson.count({ where: { ...where, status: LessonStatus.DRAFT } }),
            this.prisma.lesson.count({ where: { ...where, status: LessonStatus.PUBLISHED } }),
            this.prisma.lesson.count({ where: { ...where, status: LessonStatus.HIDDEN } }),
            this.prisma.lesson.count({ where: { ...where, hasVideo: true } }),
            this.prisma.lesson.count({ where: { ...where, hasLinkedExam: true } }),
            this.prisma.lessonProgress.count({ where: { status: LessonProgressStatus.COMPLETED, lesson: where } }),
            this.prisma.lessonProgress.aggregate({
                where: { lesson: where },
                _avg: { progressPercent: true }
            })
        ]);

        return {
            total,
            draft,
            published,
            hidden,
            withVideo,
            withExam,
            completedCount,
            averageCompletionRate: Math.round(progressAggregate._avg.progressPercent ?? 0),
            trends: {
                total: total ? '100%' : '0%',
                draft: this.percent(draft, total),
                published: this.percent(published, total),
                hidden: this.percent(hidden, total),
                withVideo: this.percent(withVideo, total),
                withExam: this.percent(withExam, total),
                completedCount: `${completedCount.toLocaleString('vi-VN')}`,
                averageCompletionRate: `${Math.round(progressAggregate._avg.progressPercent ?? 0)}%`
            }
        };
    }

    async findAll(query: QueryLessonDto, actorPublicId: string) {
        const actor = await this.findActor(actorPublicId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;
        const where = await this.buildWhere(query, actor);

        const [items, total] = await Promise.all([
            this.prisma.lesson.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ classId: 'asc' }, { orderIndex: 'asc' }],
                select: lessonSelect(false)
            }),
            this.prisma.lesson.count({ where })
        ]);

        return {
            items: items.map((item) => this.formatLesson(item)),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
        };
    }

    async findOne(publicId: string, actorPublicId: string) {
        const actor = await this.findActor(actorPublicId);
        const lesson = await this.findLessonOrThrow(publicId, true);
        this.ensureCanReadLesson(actor, lesson);
        return this.formatLesson(lesson);
    }

    async create(dto: CreateLessonDto, actorPublicId: string) {
        const actor = await this.findActor(actorPublicId);
        this.ensureCanWriteLessons(actor);
        const classItem = await this.findClassOrThrow(dto.classPublicId);
        this.ensureCanManageClassLessons(actor, classItem);
        await this.ensureOrderAvailable(classItem.id, dto.orderIndex);
        this.ensureVisibilityDates(dto.availableFrom, dto.availableUntil);
        this.ensurePublishablePayload(dto.status, dto.blocks);

        const flags = this.extractBlockFlags(dto.blocks ?? []);
        const created = await this.prisma.$transaction(async (tx) => {
            const lesson = await tx.lesson.create({
                data: {
                    classId: classItem.id,
                    title: dto.title,
                    description: dto.description,
                    chapter: dto.chapter,
                    orderIndex: dto.orderIndex,
                    durationMinutes: dto.durationMinutes,
                    status: dto.status ?? LessonStatus.DRAFT,
                    primaryContentType: dto.primaryContentType ?? dto.blocks?.[0]?.type ?? LessonContentType.TEXT,
                    allowStudentView: dto.allowStudentView ?? true,
                    allowDownload: dto.allowDownload ?? true,
                    requirePreviousCompletion: dto.requirePreviousCompletion ?? false,
                    availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
                    availableUntil: dto.availableUntil ? new Date(dto.availableUntil) : null,
                    trackProgress: dto.trackProgress ?? true,
                    ...flags,
                    publishedAt: dto.status === LessonStatus.PUBLISHED ? new Date() : null,
                    publishedById: dto.status === LessonStatus.PUBLISHED ? actor.id : null,
                    createdById: actor.id,
                    blocks: { create: this.toBlockCreateData(dto.blocks ?? []) },
                    attachments: { create: this.toAttachmentCreateData(dto.blocks ?? [], actor.id) }
                },
                select: lessonSelect(true)
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.CREATE,
                    module: 'lessons',
                    targetType: 'Lesson',
                    targetId: lesson.id,
                    targetPublicId: lesson.publicId,
                    newValue: this.auditLessonValue(lesson)
                },
                tx
            );

            return lesson;
        });

        return this.formatLesson(created);
    }

    async update(publicId: string, dto: UpdateLessonDto, actorPublicId: string) {
        const actor = await this.findActor(actorPublicId);
        this.ensureCanWriteLessons(actor);
        const current = await this.findLessonOrThrow(publicId, true);
        this.ensureCanManageClassLessons(actor, current.class);
        const classItem = dto.classPublicId ? await this.findClassOrThrow(dto.classPublicId) : current.class;
        this.ensureCanManageClassLessons(actor, classItem);
        if (dto.orderIndex && (dto.orderIndex !== current.orderIndex || classItem.id !== current.classId)) {
            await this.ensureOrderAvailable(classItem.id, dto.orderIndex, publicId);
        }
        this.ensureVisibilityDates(dto.availableFrom, dto.availableUntil);
        this.ensurePublishablePayload(dto.status, dto.blocks);
        const nextBlocks = dto.blocks ?? current.blocks;
        const flags = this.extractBlockFlags(nextBlocks as any[]);

        const updated = await this.prisma.$transaction(async (tx) => {
            if (dto.blocks) {
                await tx.lessonAttachment.deleteMany({ where: { lessonId: current.id } });
                await tx.lessonContentBlock.deleteMany({ where: { lessonId: current.id } });
            }

            const lesson = await tx.lesson.update({
                where: { publicId },
                data: {
                    ...(dto.classPublicId ? { classId: classItem.id } : {}),
                    title: dto.title,
                    description: dto.description,
                    chapter: dto.chapter,
                    orderIndex: dto.orderIndex,
                    durationMinutes: dto.durationMinutes,
                    status: dto.status,
                    primaryContentType: dto.primaryContentType,
                    allowStudentView: dto.allowStudentView,
                    allowDownload: dto.allowDownload,
                    requirePreviousCompletion: dto.requirePreviousCompletion,
                    availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : undefined,
                    availableUntil: dto.availableUntil ? new Date(dto.availableUntil) : undefined,
                    trackProgress: dto.trackProgress,
                    ...flags,
                    ...(dto.status === LessonStatus.PUBLISHED && current.status !== LessonStatus.PUBLISHED
                        ? { publishedAt: new Date(), publishedById: actor.id }
                        : {}),
                    ...(dto.blocks
                        ? {
                              blocks: { create: this.toBlockCreateData(dto.blocks) },
                              attachments: { create: this.toAttachmentCreateData(dto.blocks, actor.id) }
                          }
                        : {})
                },
                select: lessonSelect(true)
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.UPDATE,
                    module: 'lessons',
                    targetType: 'Lesson',
                    targetId: lesson.id,
                    targetPublicId: lesson.publicId,
                    oldValue: this.auditLessonValue(current),
                    newValue: this.auditLessonValue(lesson)
                },
                tx
            );
            return lesson;
        });

        return this.formatLesson(updated);
    }

    async publish(publicId: string, actorPublicId: string) {
        const actor = await this.findActor(actorPublicId);
        this.ensureHasPermission(actor, 'lessons.publish');
        const current = await this.findLessonOrThrow(publicId, true);
        this.ensureCanManageClassLessons(actor, current.class);
        const publishableStatuses: LessonStatus[] = [LessonStatus.DRAFT, LessonStatus.HIDDEN];
        if (!publishableStatuses.includes(current.status)) {
            throw new BadRequestException('Chi bai hoc nhap hoac dang an moi duoc xuat ban');
        }
        if (!current.blocks.length) throw new BadRequestException('Bai hoc phai co it nhat mot block noi dung');

        return this.updateStatusInTransaction(current, actor, {
            status: LessonStatus.PUBLISHED,
            publishedAt: new Date(),
            publishedById: actor.id,
            hiddenAt: null,
            hiddenById: null,
            hiddenReason: null
        });
    }

    async hide(publicId: string, dto: HideLessonDto, actorPublicId: string) {
        const actor = await this.findActor(actorPublicId);
        this.ensureHasPermission(actor, 'lessons.publish');
        const current = await this.findLessonOrThrow(publicId, true);
        this.ensureCanManageClassLessons(actor, current.class);
        return this.updateStatusInTransaction(current, actor, {
            status: LessonStatus.HIDDEN,
            hiddenAt: new Date(),
            hiddenById: actor.id,
            hiddenReason: dto.reason
        });
    }

    async archive(publicId: string, actorPublicId: string) {
        const actor = await this.findActor(actorPublicId);
        this.ensureHasPermission(actor, 'lessons.update');
        const current = await this.findLessonOrThrow(publicId, true);
        this.ensureCanManageClassLessons(actor, current.class);
        return this.updateStatusInTransaction(current, actor, { status: LessonStatus.ARCHIVED });
    }

    async remove(publicId: string, actorPublicId: string) {
        const actor = await this.findActor(actorPublicId);
        this.ensureHasPermission(actor, 'lessons.delete');
        const current = await this.findLessonOrThrow(publicId, true);
        this.ensureCanManageClassLessons(actor, current.class);

        return this.prisma.$transaction(async (tx) => {
            if (current._count.progresses > 0) {
                const lesson = await tx.lesson.update({
                    where: { publicId },
                    data: { deletedAt: new Date(), status: LessonStatus.ARCHIVED },
                    select: lessonSelect(true)
                });
                await this.auditLogsService.create(
                    {
                        actorId: actor.id,
                        action: AuditAction.DELETE,
                        module: 'lessons',
                        targetType: 'Lesson',
                        targetId: lesson.id,
                        targetPublicId: lesson.publicId,
                        oldValue: this.auditLessonValue(current),
                    newValue: { deletedAt: lesson.deletedAt?.toISOString(), status: lesson.status }
                    },
                    tx
                );
                return this.formatLesson(lesson);
            }

            await tx.lesson.delete({ where: { publicId } });
            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.DELETE,
                    module: 'lessons',
                    targetType: 'Lesson',
                    targetId: current.id,
                    targetPublicId: current.publicId,
                    oldValue: this.auditLessonValue(current)
                },
                tx
            );
            return { publicId, deleted: true };
        });
    }

    async duplicate(publicId: string, actorPublicId: string) {
        const actor = await this.findActor(actorPublicId);
        this.ensureCanWriteLessons(actor);
        const current = await this.findLessonOrThrow(publicId, true);
        this.ensureCanManageClassLessons(actor, current.class);
        const nextOrder = await this.nextOrderIndex(current.classId);

        const created = await this.prisma.$transaction(async (tx) => {
            const lesson = await tx.lesson.create({
                data: {
                    classId: current.classId,
                    title: `${current.title} (Bản sao)`,
                    description: current.description,
                    chapter: current.chapter,
                    orderIndex: nextOrder,
                    durationMinutes: current.durationMinutes,
                    status: LessonStatus.DRAFT,
                    primaryContentType: current.primaryContentType,
                    allowStudentView: current.allowStudentView,
                    allowDownload: current.allowDownload,
                    requirePreviousCompletion: current.requirePreviousCompletion,
                    availableFrom: current.availableFrom,
                    availableUntil: current.availableUntil,
                    trackProgress: current.trackProgress,
                    hasVideo: current.hasVideo,
                    hasAttachment: current.hasAttachment,
                    hasLinkedExam: current.hasLinkedExam,
                    createdById: actor.id,
                    blocks: { create: this.toBlockCreateData(current.blocks as any[]) },
                    attachments: { create: this.toAttachmentCreateData(current.blocks as any[], actor.id) }
                },
                select: lessonSelect(true)
            });
            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.CREATE,
                    module: 'lessons',
                    targetType: 'Lesson',
                    targetId: lesson.id,
                    targetPublicId: lesson.publicId,
                    oldValue: { duplicatedFrom: current.publicId },
                    newValue: this.auditLessonValue(lesson)
                },
                tx
            );
            return lesson;
        });

        return this.formatLesson(created);
    }

    async reorder(dto: ReorderLessonsDto, actorPublicId: string) {
        const actor = await this.findActor(actorPublicId);
        this.ensureHasPermission(actor, 'lessons.update');
        const classItem = await this.findClassOrThrow(dto.classId);
        this.ensureCanManageClassLessons(actor, classItem);
        if (new Set(dto.items.map((item) => item.orderIndex)).size !== dto.items.length) {
            throw new ConflictException('Thu tu bai hoc khong duoc trung');
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.lesson.updateMany({ where: { classId: classItem.id }, data: { orderIndex: { increment: 10000 } } });
            for (const item of dto.items) {
                await tx.lesson.update({
                    where: { publicId: item.lessonId },
                    data: { orderIndex: item.orderIndex }
                });
            }
            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.UPDATE,
                    module: 'lessons',
                    targetType: 'Lesson',
                    targetPublicId: classItem.publicId,
                    newValue: { reorder: dto.items.map((item) => ({ lessonId: item.lessonId, orderIndex: item.orderIndex })) }
                },
                tx
            );
            return { success: true };
        });
    }

    async findStudentClassLessons(classPublicId: string, studentPublicId: string) {
        const actor = await this.findActor(studentPublicId);
        this.ensureStudent(actor);
        const classItem = await this.findClassOrThrow(classPublicId);
        await this.ensureStudentEnrolled(actor.id, classItem.id);
        const lessons = await this.prisma.lesson.findMany({
            where: {
                classId: classItem.id,
                status: LessonStatus.PUBLISHED,
                allowStudentView: true,
                deletedAt: null
            },
            orderBy: { orderIndex: 'asc' },
            select: lessonSelect(false)
        });
        return lessons.map((lesson) => this.formatLesson(lesson));
    }

    async findStudentLesson(publicId: string, studentPublicId: string) {
        const actor = await this.findActor(studentPublicId);
        this.ensureStudent(actor);
        const lesson = await this.findLessonOrThrow(publicId, true);
        await this.ensureStudentCanOpenLesson(actor.id, lesson);
        return this.formatLesson(lesson);
    }

    async startStudentLesson(publicId: string, studentPublicId: string) {
        const actor = await this.findActor(studentPublicId);
        this.ensureStudent(actor);
        const lesson = await this.findLessonOrThrow(publicId, true);
        await this.ensureStudentCanOpenLesson(actor.id, lesson);
        const progress = await this.prisma.lessonProgress.upsert({
            where: { lessonId_studentId: { lessonId: lesson.id, studentId: actor.id } },
            update: { status: LessonProgressStatus.IN_PROGRESS, lastViewedAt: new Date() },
            create: {
                lessonId: lesson.id,
                studentId: actor.id,
                status: LessonProgressStatus.IN_PROGRESS,
                progressPercent: 1,
                lastViewedAt: new Date()
            }
        });
        return progress;
    }

    async completeStudentLesson(publicId: string, studentPublicId: string) {
        const actor = await this.findActor(studentPublicId);
        this.ensureStudent(actor);
        const lesson = await this.findLessonOrThrow(publicId, true);
        await this.ensureStudentCanOpenLesson(actor.id, lesson);
        return this.prisma.lessonProgress.upsert({
            where: { lessonId_studentId: { lessonId: lesson.id, studentId: actor.id } },
            update: {
                status: LessonProgressStatus.COMPLETED,
                progressPercent: 100,
                lastViewedAt: new Date(),
                completedAt: new Date()
            },
            create: {
                lessonId: lesson.id,
                studentId: actor.id,
                status: LessonProgressStatus.COMPLETED,
                progressPercent: 100,
                lastViewedAt: new Date(),
                completedAt: new Date()
            }
        });
    }

    private async updateStatusInTransaction(current: LessonWithDetails, actor: any, data: Prisma.LessonUncheckedUpdateInput) {
        const updated = await this.prisma.$transaction(async (tx) => {
            const lesson = await tx.lesson.update({
                where: { publicId: current.publicId },
                data,
                select: lessonSelect(true)
            });
            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.STATUS_CHANGE,
                    module: 'lessons',
                    targetType: 'Lesson',
                    targetId: lesson.id,
                    targetPublicId: lesson.publicId,
                    oldValue: { status: current.status },
                    newValue: { status: lesson.status, hiddenReason: lesson.hiddenReason }
                },
                tx
            );
            return lesson;
        });
        return this.formatLesson(updated);
    }

    private async buildWhere(query: QueryLessonDto, actor: any): Promise<Prisma.LessonWhereInput> {
        return {
            deletedAt: null,
            ...this.accessWhere(actor),
            ...(query.keyword
                ? {
                      OR: [
                          { title: { contains: query.keyword } },
                          { class: { code: { contains: query.keyword } } },
                          { class: { name: { contains: query.keyword } } },
                          { class: { course: { code: { contains: query.keyword } } } },
                          { class: { course: { name: { contains: query.keyword } } } },
                          { class: { lecturer: { fullName: { contains: query.keyword } } } }
                      ]
                  }
                : {}),
            ...(query.classPublicId ? { class: { publicId: query.classPublicId } } : {}),
            ...(query.classId ? { classId: query.classId } : {}),
            ...(query.courseId ? { class: { courseId: query.courseId } } : {}),
            ...(query.departmentId ? { class: { course: { departmentId: query.departmentId } } } : {}),
            ...(query.lecturerId ? { class: { lecturerId: query.lecturerId } } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.contentType ? { primaryContentType: query.contentType } : {}),
            ...(query.hasLinkedExam !== undefined ? { hasLinkedExam: query.hasLinkedExam } : {}),
            ...(query.hasVideo !== undefined ? { hasVideo: query.hasVideo } : {}),
            ...(query.hasAttachment !== undefined ? { hasAttachment: query.hasAttachment } : {}),
            ...(query.createdFrom ? { createdAt: { gte: new Date(query.createdFrom) } } : {}),
            ...(query.publishedFrom ? { publishedAt: { gte: new Date(query.publishedFrom) } } : {})
        };
    }

    private accessWhere(actor: any): Prisma.LessonWhereInput {
        if (['ADMIN', 'PRINCIPAL', 'TRAINING_OFFICER'].includes(actor.role.code)) return {};
        if (actor.role.code === 'DEPARTMENT_HEAD') return { class: { departmentHeadId: actor.id } };
        if (actor.role.code === 'LECTURER') return { class: { OR: [{ lecturerId: actor.id }, { assistantId: actor.id }] } };
        if (actor.role.code === 'STUDENT') {
            return {
                status: LessonStatus.PUBLISHED,
                allowStudentView: true,
                class: { enrollments: { some: { studentId: actor.id, status: EnrollmentStatus.APPROVED } } }
            };
        }
        return { id: -1 };
    }

    private ensureCanReadLesson(actor: any, lesson: LessonWithDetails) {
        if (['ADMIN', 'PRINCIPAL', 'TRAINING_OFFICER'].includes(actor.role.code)) return;
        if (actor.role.code === 'DEPARTMENT_HEAD' && lesson.class.departmentHeadId === actor.id) return;
        if (actor.role.code === 'LECTURER' && [lesson.class.lecturerId, lesson.class.assistantId].includes(actor.id)) return;
        if (actor.role.code === 'STUDENT' && lesson.status === LessonStatus.PUBLISHED && lesson.allowStudentView) return;
        throw new ForbiddenException('Ban khong co quyen xem bai hoc nay');
    }

    private ensureCanWriteLessons(actor: any) {
        this.ensureHasPermission(actor, 'lessons.create');
    }

    private ensureHasPermission(actor: any, permission: string) {
        if (actor.role.code === 'ADMIN') return;
        if (!actor.permissionCodes.includes(permission)) throw new ForbiddenException('Ban khong co quyen thuc hien thao tac nay');
    }

    private ensureCanManageClassLessons(actor: any, classItem: any) {
        if (actor.role.code === 'ADMIN') return;
        if (actor.role.code === 'LECTURER' && [classItem.lecturerId, classItem.assistantId].includes(actor.id)) return;
        throw new ForbiddenException('Giang vien chi duoc thao tac voi lop duoc phan cong');
    }

    private ensureStudent(actor: any) {
        if (actor.role.code !== 'STUDENT') throw new ForbiddenException('Chi sinh vien moi duoc thao tac hoc bai');
    }

    private async ensureStudentEnrolled(studentId: number, classId: number) {
        const enrollment = await this.prisma.enrollment.findFirst({
            where: { studentId, classId, status: EnrollmentStatus.APPROVED },
            select: { id: true }
        });
        if (!enrollment) throw new ForbiddenException('Sinh vien chua dang ky lop hoc nay');
    }

    private async ensureStudentCanOpenLesson(studentId: number, lesson: LessonWithDetails) {
        if (lesson.status !== LessonStatus.PUBLISHED || !lesson.allowStudentView) {
            throw new ForbiddenException('Bai hoc chua duoc xuat ban');
        }
        await this.ensureStudentEnrolled(studentId, lesson.classId);
        if (lesson.requirePreviousCompletion) {
            const previous = await this.prisma.lesson.findFirst({
                where: { classId: lesson.classId, orderIndex: { lt: lesson.orderIndex }, status: LessonStatus.PUBLISHED },
                orderBy: { orderIndex: 'desc' },
                select: { id: true }
            });
            if (previous) {
                const progress = await this.prisma.lessonProgress.findUnique({
                    where: { lessonId_studentId: { lessonId: previous.id, studentId } },
                    select: { status: true }
                });
                if (progress?.status !== LessonProgressStatus.COMPLETED) {
                    throw new BadRequestException('Can hoan thanh bai hoc truoc do');
                }
            }
        }
    }

    private async findActor(publicId: string) {
        const user = await this.prisma.user.findFirst({
            where: { publicId, deletedAt: null },
            select: {
                id: true,
                publicId: true,
                fullName: true,
                status: true,
                role: { select: { code: true, permissions: { select: { permission: { select: { code: true } } } } } }
            }
        });
        if (!user || !user.role) throw new ForbiddenException('Nguoi dung khong hop le');
        return {
            ...user,
            role: { code: user.role.code },
            permissionCodes: user.role.permissions.map((item) => item.permission.code)
        };
    }

    private async findClassOrThrow(publicId: string) {
        const classItem = await this.prisma.class.findUnique({
            where: { publicId },
            select: {
                id: true,
                publicId: true,
                code: true,
                name: true,
                lecturerId: true,
                assistantId: true,
                departmentHeadId: true,
                courseId: true,
                course: { select: { id: true, publicId: true, code: true, name: true, departmentId: true } }
            }
        });
        if (!classItem) throw new NotFoundException('Khong tim thay lop hoc');
        return classItem;
    }

    private async findLessonOrThrow(publicId: string, includeDetails = false) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { publicId },
            select: lessonSelect(includeDetails)
        });
        if (!lesson || lesson.deletedAt) throw new NotFoundException('Khong tim thay bai hoc');
        return lesson;
    }

    private async ensureOrderAvailable(classId: number, orderIndex: number, exceptPublicId?: string) {
        const duplicate = await this.prisma.lesson.findFirst({
            where: { classId, orderIndex, deletedAt: null, ...(exceptPublicId ? { publicId: { not: exceptPublicId } } : {}) },
            select: { id: true }
        });
        if (duplicate) throw new ConflictException('Thu tu bai hoc da ton tai trong lop');
    }

    private ensureVisibilityDates(start?: string, end?: string) {
        if (!start || !end) return;
        if (new Date(end) <= new Date(start)) throw new BadRequestException('Ngay an phai sau ngay hien thi');
    }

    private ensurePublishablePayload(status?: LessonStatus, blocks?: any[]) {
        if (status === LessonStatus.PUBLISHED && !blocks?.length) {
            throw new BadRequestException('Bai hoc phai co it nhat mot block truoc khi xuat ban');
        }
    }

    private extractBlockFlags(blocks: any[]) {
        return {
            hasVideo: blocks.some((block) => block.type === LessonContentType.VIDEO),
            hasAttachment: blocks.some((block) => [LessonContentType.FILE, LessonContentType.IMAGE].includes(block.type)),
            hasLinkedExam: blocks.some((block) => block.type === LessonContentType.EXAM)
        };
    }

    private toBlockCreateData(blocks: any[]) {
        return blocks.map((block, index) => ({
            type: block.type,
            title: block.title,
            content: block.content,
            fileUrl: block.fileUrl,
            fileName: block.fileName,
            fileSize: block.fileSize,
            mimeType: block.mimeType,
            orderIndex: block.orderIndex ?? index + 1
        }));
    }

    private toAttachmentCreateData(blocks: any[], actorId: number) {
        return blocks
            .filter((block) => [LessonContentType.FILE, LessonContentType.IMAGE].includes(block.type) && block.fileUrl)
            .map((block) => ({
                fileName: block.fileName || block.title || 'Tai lieu',
                fileUrl: block.fileUrl,
                fileSize: block.fileSize,
                mimeType: block.mimeType,
                uploadedById: actorId
            }));
    }

    private async nextOrderIndex(classId: number) {
        const aggregate = await this.prisma.lesson.aggregate({
            where: { classId },
            _max: { orderIndex: true }
        });
        return (aggregate._max.orderIndex ?? 0) + 1;
    }

    private auditLessonValue(lesson: any) {
        return {
            title: lesson.title,
            classId: lesson.classId,
            orderIndex: lesson.orderIndex,
            status: lesson.status,
            primaryContentType: lesson.primaryContentType,
            blockCount: lesson._count?.blocks ?? lesson.blocks?.length ?? 0
        };
    }

    private formatLesson(lesson: LessonWithDetails | any) {
        const { id: _id, classId: _classId, _count, ...rest } = lesson;
        void _id;
        const progressCount = lesson.progresses?.length ?? _count?.progresses ?? 0;
        const completedCount = lesson.progresses?.filter((progress: any) => progress.status === LessonProgressStatus.COMPLETED).length ?? 0;
        const averageProgress = lesson.progresses?.length
            ? Math.round(lesson.progresses.reduce((sum: number, progress: any) => sum + progress.progressPercent, 0) / lesson.progresses.length)
            : 0;
        return {
            ...rest,
            progressCount,
            completedCount,
            averageProgress,
            blockCount: _count?.blocks ?? lesson.blocks?.length ?? 0,
            attachmentCount: _count?.attachments ?? lesson.attachments?.length ?? 0
        };
    }

    private percent(value: number, total: number) {
        return total > 0 ? `${Math.round((value / total) * 100)}%` : '0%';
    }
}
