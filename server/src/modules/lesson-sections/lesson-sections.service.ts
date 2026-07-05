import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EnrollmentStatus, Prisma } from '@prisma/client';

import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { PrismaService } from '~/prisma/prisma.service';
import { CreateLessonSectionDto } from './dto/create-lesson-section.dto';
import { QueryLessonSectionDto } from './dto/query-lesson-section.dto';
import { ReorderLessonSectionsDto } from './dto/reorder-lesson-sections.dto';
import { UpdateLessonSectionDto } from './dto/update-lesson-section.dto';

const lessonSectionSelect = () =>
    ({
        id: true,
        publicId: true,
        classId: true,
        title: true,
        description: true,
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
                departmentHeadId: true
            }
        },
        lessons: {
            orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
            select: {
                publicId: true,
                title: true,
                type: true,
                durationMinutes: true,
                sortOrder: true,
                isPublished: true
            }
        },
        _count: {
            select: {
                lessons: true
            }
        },
        createdAt: true,
        updatedAt: true
    }) satisfies Prisma.LessonSectionSelect;

type LessonSectionWithDetails = Prisma.LessonSectionGetPayload<{ select: ReturnType<typeof lessonSectionSelect> }>;
type Actor = Awaited<ReturnType<LessonSectionsService['findUserByPublicIdOrThrow']>>;
type ClassAccessRecord = Awaited<ReturnType<LessonSectionsService['findClassRecordOrThrow']>>;

@Injectable()
export class LessonSectionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService
    ) {}

    async create(classPublicId: string, dto: CreateLessonSectionDto, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        this.ensureCanManageClass(actor, classItem);
        this.ensureClassContentEditable(actor, classItem);
        await this.ensureSectionOrderAvailable(classItem.id, dto.sortOrder);

        const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(classItem.id));
        const section = await this.prisma.$transaction(async (tx) => {
            const created = await tx.lessonSection.create({
                data: {
                    classId: classItem.id,
                    title: dto.title,
                    description: dto.description,
                    sortOrder,
                    isPublished: dto.isPublished ?? false
                },
                select: this.lessonSectionSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.CREATE,
                    module: 'lesson_sections',
                    targetType: 'LessonSection',
                    targetId: created.id,
                    targetPublicId: created.publicId,
                    newValue: this.auditSectionValue(created)
                },
                tx
            );

            return created;
        });

        return this.formatSection(section, this.canManageClass(actor, classItem));
    }

    async findByClass(classPublicId: string, query: QueryLessonSectionDto, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        const canManage = this.canManageClass(actor, classItem);
        if (!canManage) await this.ensureCanStudyClass(actor, classItem.id);

        const where: Prisma.LessonSectionWhereInput = {
            classId: classItem.id,
            ...(query.keyword
                ? {
                      OR: [{ title: { contains: query.keyword } }, { description: { contains: query.keyword } }]
                  }
                : {}),
            ...(query.isPublished !== undefined ? { isPublished: query.isPublished } : {}),
            ...(!canManage ? { isPublished: true } : {})
        };

        const sections = await this.prisma.lessonSection.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: this.lessonSectionSelect()
        });

        return sections.map((section) => this.formatSection(section, canManage));
    }

    async findOne(publicId: string, actorPublicId: string) {
        const [actor, section] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findSectionRecordOrThrow(publicId)
        ]);
        const canManage = this.canManageClass(actor, section.class);
        if (!canManage) {
            if (!section.isPublished) throw new ForbiddenException('Section chưa được công bố');
            await this.ensureCanStudyClass(actor, section.classId);
        }

        return this.formatSection(section, canManage);
    }

    async update(publicId: string, dto: UpdateLessonSectionDto, actorPublicId: string) {
        const [actor, section] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findSectionRecordOrThrow(publicId)
        ]);
        this.ensureCanManageClass(actor, section.class);
        this.ensureClassContentEditable(actor, section.class);
        await this.ensureSectionOrderAvailable(section.classId, dto.sortOrder, section.id);

        const updated = await this.prisma.$transaction(async (tx) => {
            const item = await tx.lessonSection.update({
                where: { publicId },
                data: {
                    title: dto.title,
                    description: dto.description,
                    sortOrder: dto.sortOrder,
                    isPublished: dto.isPublished
                },
                select: this.lessonSectionSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.UPDATE,
                    module: 'lesson_sections',
                    targetType: 'LessonSection',
                    targetId: item.id,
                    targetPublicId: item.publicId,
                    oldValue: this.auditSectionValue(section),
                    newValue: this.auditSectionValue(item)
                },
                tx
            );

            return item;
        });

        return this.formatSection(updated, true);
    }

    async remove(publicId: string, actorPublicId: string) {
        const [actor, section] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findSectionRecordOrThrow(publicId)
        ]);
        this.ensureCanManageClass(actor, section.class);
        this.ensureClassContentEditable(actor, section.class);

        await this.prisma.$transaction(async (tx) => {
            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.DELETE,
                    module: 'lesson_sections',
                    targetType: 'LessonSection',
                    targetId: section.id,
                    targetPublicId: section.publicId,
                    oldValue: this.auditSectionValue(section)
                },
                tx
            );

            await tx.lessonSection.delete({ where: { publicId } });
        });

        return { publicId, deleted: true };
    }

    async reorder(classPublicId: string, dto: ReorderLessonSectionsDto, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        this.ensureCanManageClass(actor, classItem);
        this.ensureClassContentEditable(actor, classItem);
        this.ensureUniqueOrderPayload(dto);

        const sections = await this.prisma.lessonSection.findMany({
            where: {
                classId: classItem.id,
                publicId: {
                    in: dto.items.map((item) => item.publicId)
                }
            },
            select: { id: true, publicId: true }
        });

        if (sections.length !== dto.items.length) {
            throw new BadRequestException('Danh sách section không hợp lệ với lớp này');
        }

        const orderByPublicId = new Map(dto.items.map((item) => [item.publicId, item.sortOrder]));
        await this.prisma.$transaction(async (tx) => {
            for (const section of sections) {
                await tx.lessonSection.update({
                    where: { id: section.id },
                    data: { sortOrder: -section.id }
                });
            }

            for (const section of sections) {
                await tx.lessonSection.update({
                    where: { id: section.id },
                    data: { sortOrder: orderByPublicId.get(section.publicId) }
                });
            }

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.UPDATE,
                    module: 'lesson_sections',
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

    private canManageClass(actor: Actor, classItem: ClassAccessRecord | LessonSectionWithDetails['class']) {
        if (['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code)) return true;
        if (actor.role.code === 'DEPARTMENT_HEAD' && actor.id === classItem.departmentHeadId) return true;
        if (actor.role.code === 'LECTURER' && actor.id === classItem.lecturerId) return true;
        return false;
    }

    private ensureCanManageClass(actor: Actor, classItem: ClassAccessRecord | LessonSectionWithDetails['class']) {
        if (!this.canManageClass(actor, classItem)) {
            throw new ForbiddenException('Bạn không có quyền quản lý section của lớp học này');
        }
    }

    private ensureClassContentEditable(actor: Actor, classItem: { status?: string | null }) {
        if (classItem.status === 'COMPLETED' && !['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code)) {
            throw new BadRequestException('Lop da hoan thanh, chi Admin hoac PDT duoc sua noi dung');
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

    private async ensureSectionOrderAvailable(classId: number, sortOrder?: number, exceptSectionId?: number) {
        if (sortOrder === undefined) return;

        const duplicate = await this.prisma.lessonSection.findFirst({
            where: {
                classId,
                sortOrder,
                ...(exceptSectionId ? { id: { not: exceptSectionId } } : {})
            },
            select: { id: true }
        });

        if (duplicate) throw new BadRequestException('Thứ tự section đã tồn tại trong lớp này');
    }

    private ensureUniqueOrderPayload(dto: ReorderLessonSectionsDto) {
        const publicIds = new Set(dto.items.map((item) => item.publicId));
        const sortOrders = new Set(dto.items.map((item) => item.sortOrder));
        if (publicIds.size !== dto.items.length || sortOrders.size !== dto.items.length) {
            throw new BadRequestException('Danh sách sắp xếp bị trùng section hoặc thứ tự');
        }
    }

    private async nextSortOrder(classId: number) {
        const last = await this.prisma.lessonSection.findFirst({
            where: { classId },
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
                departmentHeadId: true
            }
        });
        if (!classItem) throw new NotFoundException('Không tìm thấy lớp học');
        return classItem;
    }

    private async findSectionRecordOrThrow(publicId: string) {
        const section = await this.prisma.lessonSection.findUnique({
            where: { publicId },
            select: this.lessonSectionSelect()
        });
        if (!section) throw new NotFoundException('Không tìm thấy section');
        return section;
    }

    private lessonSectionSelect() {
        return lessonSectionSelect();
    }

    private auditSectionValue(section: LessonSectionWithDetails) {
        return {
            classId: section.classId,
            title: section.title,
            sortOrder: section.sortOrder,
            isPublished: section.isPublished
        };
    }

    private formatSection(section: LessonSectionWithDetails, canManage: boolean) {
        const { id: _id, _count, lessons, ...rest } = section;
        void _id;

        return {
            ...rest,
            lessonCount: _count?.lessons ?? 0,
            lessons: canManage ? lessons : lessons.filter((lesson) => lesson.isPublished)
        };
    }
}
