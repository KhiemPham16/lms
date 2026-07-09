import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { AuditAction, ClassStatus, CourseStatus, EnrollmentStatus, Prisma } from '@prisma/client';

import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { NotificationsService } from '~/modules/notifications/notifications.service';
import { PrismaService } from '~/prisma/prisma.service';
import { AssignClassHeadDto } from './dto/assign-class-head.dto';
import { AssignLecturerDto } from './dto/assign-lecturer.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { QueryClassDto } from './dto/query-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

const classSelect = (includeEnrollments = false) =>
    ({
        id: true,
        publicId: true,
        courseId: true,
        code: true,
        name: true,
        description: true,
        semester: true,
        academicYear: true,
        lecturerId: true,
        departmentHeadId: true,
        maxStudents: true,
        minStudents: true,
        allowWaitlist: true,
        startDate: true,
        endDate: true,
        weeklySchedule: true,
        studyShift: true,
        room: true,
        onlineUrl: true,
        registrationStartDate: true,
        registrationEndDate: true,
        registrationOpenedAt: true,
        registrationClosedAt: true,
        allowStudentDrop: true,
        checkScheduleConflict: true,
        autoCloseWhenFull: true,
        status: true,
        course: {
            select: {
                id: true,
                publicId: true,
                code: true,
                name: true,
                credits: true,
                status: true,
                departmentId: true,
                department: {
                    select: {
                        id: true,
                        publicId: true,
                        code: true,
                        name: true
                    }
                }
            }
        },
        lecturer: {
            select: {
                id: true,
                publicId: true,
                code: true,
                fullName: true,
                email: true,
                departmentId: true
            }
        },
        departmentHead: {
            select: {
                id: true,
                publicId: true,
                code: true,
                fullName: true,
                email: true,
                departmentId: true
            }
        },
        enrollments: includeEnrollments
            ? {
                  orderBy: {
                      enrolledAt: 'desc' as const
                  },
                  select: {
                      id: true,
                      status: true,
                      enrolledAt: true,
                      student: {
                          select: {
                              publicId: true,
                              code: true,
                              fullName: true,
                              email: true
                          }
                      }
                  }
              }
            : false,
        _count: {
            select: {
                enrollments: {
                    where: {
                        status: EnrollmentStatus.APPROVED
                    }
                },
                lessonSections: true,
                lessons: true
            }
        },
        createdAt: true,
        updatedAt: true
    }) satisfies Prisma.ClassSelect;

type ClassWithDetails = Prisma.ClassGetPayload<{ select: ReturnType<typeof classSelect> }>;
type ClassAuditValueSource = Pick<
    ClassWithDetails,
    'code' | 'name' | 'courseId' | 'lecturerId' | 'departmentHeadId' | 'maxStudents' | 'status'
>;
type FormattedClass = Omit<ClassWithDetails, 'id' | '_count'> & {
    weeklyScheduleText: string;
    enrolledCount: number;
    availableSlots: number;
    isFull: boolean;
    fullBadge: string | null;
};

@Injectable()
export class ClassesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService,
        private readonly notificationsService: NotificationsService
    ) {}

    async create(coursePublicId: string, dto: CreateClassDto, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        this.ensureTrainingOffice(actor);
        const course = await this.findActiveCourseOrThrow(coursePublicId);
        await this.ensureClassCodeAvailable(dto.code);
        this.ensureValidClassDates(dto.startDate, dto.endDate);
        this.ensureValidRegistrationDates(dto.registrationStartDate, dto.registrationEndDate);

        const departmentHeadId = dto.departmentHeadId ?? course.departmentHeadId;
        if (!departmentHeadId) {
            throw new BadRequestException('Phải gắn trưởng bộ môn trước khi tạo lớp');
        }

        await this.ensureDepartmentHead(departmentHeadId, course.departmentId);
        if (dto.lecturerId) await this.ensureLecturer(dto.lecturerId, course.departmentId);

        const createdClass = await this.prisma.$transaction(async (tx) => {
            const classItem = await tx.class.create({
                data: this.toClassData(dto, course.id, departmentHeadId),
                select: this.classSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.CREATE,
                    module: 'classes',
                    targetType: 'Class',
                    targetId: classItem.id,
                    targetPublicId: classItem.publicId,
                    newValue: this.auditClassValue(classItem)
                },
                tx
            );

            await this.notifyClassCreated(classItem, actor.id, tx);

            return classItem;
        });

        return this.formatClass(createdClass);
    }

    async summary(query: QueryClassDto) {
        const where = this.buildClassWhere({ ...query, page: undefined, limit: undefined });
        const total = await this.prisma.class.count({ where });
        const approvedEnrollmentWhere = { ...where, enrollments: { some: { status: EnrollmentStatus.APPROVED } } };

        const [draft, openRegistration, closedRegistration, inProgress, completed, totalRegistered, fullCandidates] =
            await Promise.all([
                this.prisma.class.count({ where: { ...where, status: ClassStatus.DRAFT } }),
                this.prisma.class.count({ where: { ...where, status: ClassStatus.OPEN_REGISTRATION } }),
                this.prisma.class.count({ where: { ...where, status: ClassStatus.CLOSED_REGISTRATION } }),
                this.prisma.class.count({ where: { ...where, status: ClassStatus.IN_PROGRESS } }),
                this.prisma.class.count({ where: { ...where, status: ClassStatus.COMPLETED } }),
                this.prisma.enrollment.count({
                    where: {
                        status: EnrollmentStatus.APPROVED,
                        class: where
                    }
                }),
                this.prisma.class.findMany({
                    where: approvedEnrollmentWhere,
                    select: {
                        maxStudents: true,
                        _count: {
                            select: {
                                enrollments: {
                                    where: { status: EnrollmentStatus.APPROVED }
                                }
                            }
                        }
                    }
                })
            ]);

        const full = fullCandidates.filter((item) => item._count.enrollments >= item.maxStudents).length;
        const trend = total > 0 ? '100%' : '0%';

        return {
            total,
            draft,
            openRegistration,
            closedRegistration,
            inProgress,
            completed,
            full,
            totalRegistered,
            trends: {
                total: trend,
                draft: this.percent(draft, total),
                openRegistration: this.percent(openRegistration, total),
                closedRegistration: this.percent(closedRegistration, total),
                inProgress: this.percent(inProgress, total),
                completed: this.percent(completed, total),
                full: this.percent(full, total),
                totalRegistered: `${totalRegistered.toLocaleString('vi-VN')}`
            }
        };
    }

    async findAll(query: QueryClassDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;
        const where = this.buildClassWhere(query);
        const needsSlotFilter = query.isFull !== undefined || query.hasAvailableSlots !== undefined;

        if (needsSlotFilter) {
            const allItems = await this.prisma.class.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                select: this.classSelect()
            });

            const filteredItems = allItems
                .map((item) => this.formatClass(item))
                .filter((item) => {
                    if (query.isFull !== undefined) return item.isFull === query.isFull;
                    if (query.hasAvailableSlots !== undefined) {
                        return query.hasAvailableSlots ? item.availableSlots > 0 : item.availableSlots <= 0;
                    }
                    return true;
                });
            const total = filteredItems.length;

            return {
                items: filteredItems.slice(skip, skip + limit),
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        }

        const [items, total] = await Promise.all([
            this.prisma.class.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' },
                select: this.classSelect()
            }),
            this.prisma.class.count({ where })
        ]);

        return {
            items: items.map((item) => this.formatClass(item)),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async findByPublicIdOrThrow(publicId: string) {
        const classItem = await this.prisma.class.findUnique({
            where: { publicId },
            select: this.classSelect(true)
        });

        if (!classItem) {
            throw new NotFoundException('Không tìm thấy lớp học');
        }

        return this.formatClass(classItem);
    }

    async update(publicId: string, dto: UpdateClassDto, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        this.ensureTrainingOffice(actor);
        const classItem = await this.findClassRecordOrThrow(publicId);
        const course = await this.prisma.course.findUniqueOrThrow({
            where: { id: classItem.courseId },
            select: { id: true, departmentId: true, status: true }
        });

        if (dto.code && dto.code !== classItem.code) {
            await this.ensureClassCodeAvailable(dto.code, publicId);
        }
        if (dto.startDate || dto.endDate) {
            this.ensureValidClassDates(
                dto.startDate ?? classItem.startDate.toISOString(),
                dto.endDate ?? classItem.endDate.toISOString()
            );
        }
        this.ensureValidRegistrationDates(dto.registrationStartDate, dto.registrationEndDate);
        if (dto.departmentHeadId) await this.ensureDepartmentHead(dto.departmentHeadId, course.departmentId);
        if (dto.lecturerId) await this.ensureLecturer(dto.lecturerId, course.departmentId);

        const updatedClass = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.class.update({
                where: { publicId },
                data: this.toClassUpdateData(dto),
                select: this.classSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.UPDATE,
                    module: 'classes',
                    targetType: 'Class',
                    targetId: updated.id,
                    targetPublicId: updated.publicId,
                    oldValue: this.auditClassValue(classItem),
                    newValue: this.auditClassValue(updated)
                },
                tx
            );

            return updated;
        });

        return this.formatClass(updatedClass);
    }

    async remove(publicId: string, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        this.ensureCanDeleteClass(actor);
        const classItem = await this.findClassRecordOrThrow(publicId);

        await this.prisma.$transaction(async (tx) => {
            const deleted = await tx.class.deleteMany({
                where: {
                    id: classItem.id,
                    enrollments: { none: {} }
                }
            });

            if (deleted.count === 0) {
                throw new BadRequestException('Lớp đã có sinh viên nên không được xóa');
            }

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.DELETE,
                    module: 'classes',
                    targetType: 'Class',
                    targetId: classItem.id,
                    targetPublicId: classItem.publicId,
                    oldValue: this.auditClassValue(classItem)
                },
                tx
            );
        });

        return { publicId, deleted: true };
    }

    async assignDepartmentHead(publicId: string, dto: AssignClassHeadDto, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        this.ensureTrainingOffice(actor);
        const classItem = await this.findClassRecordOrThrow(publicId);
        await this.ensureDepartmentHead(dto.departmentHeadId, classItem.course.departmentId);

        const updatedClass = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.class.update({
                where: { publicId },
                data: { departmentHeadId: dto.departmentHeadId },
                select: this.classSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.ASSIGN,
                    module: 'classes',
                    targetType: 'Class',
                    targetId: updated.id,
                    targetPublicId: updated.publicId,
                    oldValue: { departmentHeadId: classItem.departmentHeadId },
                    newValue: { departmentHeadId: dto.departmentHeadId, startsAt: dto.startsAt, note: dto.note }
                },
                tx
            );

            await this.notificationsService.createMany(
                {
                    recipientIds: [updated.departmentHeadId],
                    actorId: actor.id,
                    type: 'CLASS_DEPARTMENT_HEAD_ASSIGNED',
                    title: `Lớp ${updated.code} thuộc môn bạn phụ trách`,
                    message: `Lớp ${updated.name} đã được gán vào phạm vi phụ trách của bạn.`,
                    data: {
                        classPublicId: updated.publicId,
                        coursePublicId: updated.course.publicId
                    }
                },
                tx
            );

            return updated;
        });

        return this.formatClass(updatedClass);
    }

    async assignLecturer(publicId: string, dto: AssignLecturerDto, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const classItem = await this.findClassRecordOrThrow(publicId);
        this.ensureCanManageClass(actor, classItem);
        await this.ensureLecturer(dto.lecturerId, classItem.course.departmentId);

        const updatedClass = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.class.update({
                where: { publicId },
                data: { lecturerId: dto.lecturerId },
                select: this.classSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.ASSIGN,
                    module: 'classes',
                    targetType: 'Class',
                    targetId: updated.id,
                    targetPublicId: updated.publicId,
                    oldValue: { lecturerId: classItem.lecturerId },
                    newValue: { lecturerId: dto.lecturerId, startsAt: dto.startsAt, note: dto.note }
                },
                tx
            );

            await this.notificationsService.createMany(
                {
                    recipientIds: [dto.lecturerId],
                    actorId: actor.id,
                    type: 'CLASS_LECTURER_ASSIGNED',
                    title: `Bạn được phân công lớp: ${updated.code}`,
                    message: `Bạn đã được gán làm giảng viên của lớp ${updated.name}.`,
                    data: {
                        classPublicId: updated.publicId,
                        coursePublicId: updated.course.publicId
                    }
                },
                tx
            );

            return updated;
        });

        return this.formatClass(updatedClass);
    }

    async updateStatus(publicId: string, status: ClassStatus, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const classItem = await this.findClassRecordOrThrow(publicId);
        this.ensureCanChangeStatus(actor, classItem);
        this.ensureStatusTransition(classItem, status);

        const now = new Date();
        const data: Prisma.ClassUpdateInput = {
            status,
            ...(status === ClassStatus.OPEN_REGISTRATION ? { registrationOpenedAt: now } : {}),
            ...(status === ClassStatus.CLOSED_REGISTRATION ? { registrationClosedAt: now } : {})
        };

        const updatedClass = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.class.update({
                where: { publicId },
                data,
                select: this.classSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.STATUS_CHANGE,
                    module: 'classes',
                    targetType: 'Class',
                    targetId: updated.id,
                    targetPublicId: updated.publicId,
                    oldValue: { status: classItem.status },
                    newValue: { status: updated.status }
                },
                tx
            );

            await this.notifyClassStatusChange(updated, actor.id, tx);

            return updated;
        });

        return this.formatClass(updatedClass);
    }

    async complete(publicId: string, actorPublicId: string) {
        return this.updateStatus(publicId, ClassStatus.COMPLETED, actorPublicId);
    }

    async copyContentFrom(targetPublicId: string, sourcePublicId: string, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const [targetClass, sourceClass] = await Promise.all([
            this.findClassRecordOrThrow(targetPublicId),
            this.findClassRecordOrThrow(sourcePublicId)
        ]);
        this.ensureCanManageClass(actor, targetClass);

        if (targetClass.id === sourceClass.id) {
            throw new BadRequestException('Không thể copy nội dung từ chính lớp này');
        }

        if (targetClass.courseId !== sourceClass.courseId) {
            throw new BadRequestException('Chỉ được copy nội dung giữa các lớp cùng môn học');
        }

        if ((targetClass._count.lessonSections ?? 0) > 0 || (targetClass._count.lessons ?? 0) > 0) {
            throw new BadRequestException('Lớp đích đã có nội dung bài học');
        }

        const sourceSections = await this.prisma.lessonSection.findMany({
            where: { classId: sourceClass.id },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                title: true,
                description: true,
                sortOrder: true,
                isPublished: true,
                lessons: {
                    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                    select: {
                        title: true,
                        description: true,
                        type: true,
                        content: true,
                        resourceUrl: true,
                        codeConfig: true,
                        durationMinutes: true,
                        sortOrder: true,
                        isPublished: true
                    }
                }
            }
        });

        const standaloneLessons = await this.prisma.lesson.findMany({
            where: {
                classId: sourceClass.id,
                sectionId: null
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
                title: true,
                description: true,
                type: true,
                content: true,
                resourceUrl: true,
                codeConfig: true,
                durationMinutes: true,
                sortOrder: true,
                isPublished: true
            }
        });

        const copiedClass = await this.prisma.$transaction(async (tx) => {
            for (const section of sourceSections) {
                await tx.lessonSection.create({
                    data: {
                        classId: targetClass.id,
                        title: section.title,
                        description: section.description,
                        sortOrder: section.sortOrder,
                        isPublished: section.isPublished,
                        lessons: {
                            create: section.lessons.map((lesson) => ({
                                classId: targetClass.id,
                                title: lesson.title,
                                description: lesson.description,
                                type: lesson.type,
                                content: lesson.content,
                                resourceUrl: lesson.resourceUrl,
                                codeConfig: lesson.codeConfig === null ? undefined : lesson.codeConfig,
                                durationMinutes: lesson.durationMinutes,
                                sortOrder: lesson.sortOrder,
                                isPublished: lesson.isPublished
                            }))
                        }
                    }
                });
            }

            if (standaloneLessons.length > 0) {
                await tx.lesson.createMany({
                    data: standaloneLessons.map((lesson) => ({
                        classId: targetClass.id,
                        title: lesson.title,
                        description: lesson.description,
                        type: lesson.type,
                        content: lesson.content,
                        resourceUrl: lesson.resourceUrl,
                        codeConfig: lesson.codeConfig === null ? undefined : lesson.codeConfig,
                        durationMinutes: lesson.durationMinutes,
                        sortOrder: lesson.sortOrder,
                        isPublished: lesson.isPublished
                    }))
                });
            }

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.CREATE,
                    module: 'class_content',
                    targetType: 'Class',
                    targetId: targetClass.id,
                    targetPublicId: targetClass.publicId,
                    newValue: {
                        sourceClassPublicId: sourceClass.publicId,
                        sectionCount: sourceSections.length,
                        standaloneLessonCount: standaloneLessons.length
                    }
                },
                tx
            );

            return tx.class.findUniqueOrThrow({
                where: { id: targetClass.id },
                select: this.classSelect()
            });
        });

        return this.formatClass(copiedClass);
    }

    private buildClassWhere(query: QueryClassDto): Prisma.ClassWhereInput {
        return {
            ...(query.keyword
                ? {
                      OR: [
                          { code: { contains: query.keyword } },
                          { name: { contains: query.keyword } },
                          { course: { code: { contains: query.keyword } } },
                          { course: { name: { contains: query.keyword } } },
                          { lecturer: { fullName: { contains: query.keyword } } },
                          { departmentHead: { fullName: { contains: query.keyword } } }
                      ]
                  }
                : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.courseId ? { courseId: query.courseId } : {}),
            ...(query.departmentId ? { course: { departmentId: query.departmentId } } : {}),
            ...(query.departmentHeadId ? { departmentHeadId: query.departmentHeadId } : {}),
            ...(query.lecturerId ? { lecturerId: query.lecturerId } : {}),
            ...(query.semester ? { semester: query.semester } : {}),
            ...(query.academicYear ? { academicYear: query.academicYear } : {}),
            ...(query.registrationStatus === 'open' ? { status: ClassStatus.OPEN_REGISTRATION } : {}),
            ...(query.registrationStatus === 'closed' ? { status: ClassStatus.CLOSED_REGISTRATION } : {}),
            ...(query.startFrom ? { startDate: { gte: new Date(query.startFrom) } } : {}),
            ...(query.endTo ? { endDate: { lte: new Date(query.endTo) } } : {})
        };
    }

    private toClassData(
        dto: CreateClassDto,
        courseId: number,
        departmentHeadId: number
    ): Prisma.ClassUncheckedCreateInput {
        return {
            code: dto.code,
            name: dto.name,
            description: dto.description,
            courseId,
            lecturerId: dto.lecturerId,
            departmentHeadId,
            semester: dto.semester,
            academicYear: dto.academicYear,
            maxStudents: dto.maxStudents,
            minStudents: dto.minStudents,
            allowWaitlist: dto.allowWaitlist ?? false,
            startDate: new Date(dto.startDate),
            endDate: new Date(dto.endDate),
            weeklySchedule: dto.weeklySchedule ? { text: dto.weeklySchedule } : undefined,
            studyShift: dto.studyShift,
            room: dto.room,
            onlineUrl: dto.onlineUrl,
            registrationStartDate: dto.registrationStartDate ? new Date(dto.registrationStartDate) : undefined,
            registrationEndDate: dto.registrationEndDate ? new Date(dto.registrationEndDate) : undefined,
            allowStudentDrop: dto.allowStudentDrop ?? true,
            checkScheduleConflict: dto.checkScheduleConflict ?? false,
            autoCloseWhenFull: dto.autoCloseWhenFull ?? true,
            status: dto.status ?? ClassStatus.DRAFT
        };
    }

    private toClassUpdateData(dto: UpdateClassDto): Prisma.ClassUncheckedUpdateInput {
        return {
            code: dto.code,
            name: dto.name,
            description: dto.description,
            lecturerId: dto.lecturerId,
            departmentHeadId: dto.departmentHeadId,
            semester: dto.semester,
            academicYear: dto.academicYear,
            maxStudents: dto.maxStudents,
            minStudents: dto.minStudents,
            allowWaitlist: dto.allowWaitlist,
            startDate: dto.startDate ? new Date(dto.startDate) : undefined,
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            weeklySchedule: dto.weeklySchedule ? { text: dto.weeklySchedule } : undefined,
            studyShift: dto.studyShift,
            room: dto.room,
            onlineUrl: dto.onlineUrl,
            registrationStartDate: dto.registrationStartDate ? new Date(dto.registrationStartDate) : undefined,
            registrationEndDate: dto.registrationEndDate ? new Date(dto.registrationEndDate) : undefined,
            allowStudentDrop: dto.allowStudentDrop,
            checkScheduleConflict: dto.checkScheduleConflict,
            autoCloseWhenFull: dto.autoCloseWhenFull,
            status: dto.status
        };
    }

    private async findActiveCourseOrThrow(publicId: string) {
        const course = await this.prisma.course.findUnique({
            where: { publicId },
            select: { id: true, status: true, departmentId: true, departmentHeadId: true }
        });

        if (!course) throw new NotFoundException('Không tìm thấy môn học');
        if (course.status !== CourseStatus.ACTIVE)
            throw new BadRequestException('Chỉ có thể tạo lớp từ môn học ACTIVE');
        return course;
    }

    private async ensureClassCodeAvailable(code: string, exceptPublicId?: string) {
        const duplicate = await this.prisma.class.findFirst({
            where: {
                code,
                ...(exceptPublicId ? { publicId: { not: exceptPublicId } } : {})
            }
        });

        if (duplicate) throw new ConflictException('Mã lớp học đã tồn tại');
    }

    private ensureTrainingOffice(actor: { role: { code: string } }) {
        if (!['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code)) {
            throw new ForbiddenException('Chỉ Phòng đào tạo mới được thao tác');
        }
    }

    private ensureCanDeleteClass(actor: { role: { code: string } }) {
        if (!['ADMIN', 'TRAINING_OFFICER', 'PRINCIPAL'].includes(actor.role.code)) {
            throw new ForbiddenException('Chỉ Admin, Phòng đào tạo hoặc Hiệu trưởng mới được xóa lớp');
        }
    }

    private ensureCanManageClass(
        actor: { id: number; role: { code: string } },
        classItem: { departmentHeadId: number; lecturerId?: number | null }
    ) {
        if (['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code)) return;
        if (actor.role.code === 'LECTURER' && actor.id === classItem.lecturerId) return;
        if (actor.role.code !== 'DEPARTMENT_HEAD' || actor.id !== classItem.departmentHeadId) {
            throw new ForbiddenException('Chỉ trưởng bộ môn quản lý lớp này mới được thao tác');
        }
    }

    private ensureCanChangeStatus(
        actor: { id: number; role: { code: string } },
        classItem: { departmentHeadId: number }
    ) {
        this.ensureCanManageClass(actor, classItem);
    }

    private ensureStatusTransition(
        classItem: Awaited<ReturnType<ClassesService['findClassRecordOrThrow']>>,
        nextStatus: ClassStatus
    ) {
        const terminalStatuses: ClassStatus[] = [ClassStatus.COMPLETED, ClassStatus.CANCELLED];
        if (terminalStatuses.includes(classItem.status)) {
            throw new BadRequestException('Lớp đã kết thúc hoặc đã hủy không thể đổi trạng thái');
        }

        if (nextStatus === ClassStatus.OPEN_REGISTRATION) {
            const openableStatuses: ClassStatus[] = [ClassStatus.DRAFT, ClassStatus.CLOSED_REGISTRATION];
            if (!openableStatuses.includes(classItem.status)) {
                throw new BadRequestException('Chỉ lớp DRAFT hoặc CLOSED_REGISTRATION mới được mở đăng ký');
            }
            if (classItem.course.status !== CourseStatus.ACTIVE)
                throw new BadRequestException('Môn học không còn ACTIVE');
            if (!classItem.departmentHeadId) throw new BadRequestException('Lớp chưa có trưởng bộ môn quản lý');
            if (!classItem.maxStudents || classItem.maxStudents <= 0)
                throw new BadRequestException('Sĩ số tối đa không hợp lệ');
            this.ensureValidRegistrationDates(
                classItem.registrationStartDate?.toISOString(),
                classItem.registrationEndDate?.toISOString()
            );
        }

        if (nextStatus === ClassStatus.CLOSED_REGISTRATION && classItem.status !== ClassStatus.OPEN_REGISTRATION) {
            throw new BadRequestException('Chỉ lớp đang mở đăng ký mới được đóng đăng ký');
        }

        if (nextStatus === ClassStatus.IN_PROGRESS && !classItem.lecturerId) {
            throw new BadRequestException('Phải gắn giảng viên chính trước khi bắt đầu lớp');
        }

        if (nextStatus === ClassStatus.COMPLETED && classItem.status !== ClassStatus.IN_PROGRESS) {
            throw new BadRequestException('Chỉ lớp đang học mới được hoàn thành');
        }
    }

    private async ensureDepartmentHead(userId: number, departmentId: number) {
        const user = await this.prisma.user.findFirst({
            where: {
                id: userId,
                deletedAt: null,
                status: 'ACTIVE',
                departmentId,
                role: { code: 'DEPARTMENT_HEAD' }
            },
            select: { id: true }
        });
        if (!user) throw new BadRequestException('Trưởng bộ môn không hợp lệ với bộ môn của lớp');
    }

    private async ensureLecturer(lecturerId: number, departmentId: number) {
        const lecturer = await this.prisma.user.findFirst({
            where: {
                id: lecturerId,
                deletedAt: null,
                status: 'ACTIVE',
                departmentId,
                role: { code: { in: ['LECTURER', 'DEPARTMENT_HEAD'] } }
            },
            select: { id: true }
        });
        if (!lecturer) throw new BadRequestException('Giảng viên không hợp lệ với bộ môn của lớp');
    }

    private ensureValidClassDates(startDate: string, endDate: string) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
        }
    }

    private ensureValidRegistrationDates(startDate?: string, endDate?: string) {
        if (!startDate || !endDate) return;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            throw new BadRequestException('Ngày đóng đăng ký phải sau ngày mở đăng ký');
        }
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
            select: this.classSelect()
        });
        if (!classItem) throw new NotFoundException('Không tìm thấy lớp học');
        return classItem;
    }

    private async notifyClassStatusChange(classItem: ClassWithDetails, actorId: number, tx: Prisma.TransactionClient) {
        if (classItem.status === ClassStatus.OPEN_REGISTRATION) {
            const students = await tx.user.findMany({
                where: {
                    deletedAt: null,
                    status: 'ACTIVE',
                    role: { code: 'STUDENT' }
                },
                select: { id: true }
            });

            await this.notificationsService.createMany(
                {
                    recipientIds: students.map((student) => student.id),
                    actorId,
                    type: 'CLASS_REGISTRATION_OPENED',
                    title: `Mở đăng ký lớp ${classItem.code}`,
                    message: `${classItem.name} đã mở đăng ký. Sĩ số tối đa: ${classItem.maxStudents}.`,
                    data: {
                        classPublicId: classItem.publicId,
                        coursePublicId: classItem.course.publicId,
                        status: classItem.status
                    }
                },
                tx
            );
        }

        if (classItem.status === ClassStatus.COMPLETED) {
            const enrollments = await tx.enrollment.findMany({
                where: {
                    classId: classItem.id,
                    status: EnrollmentStatus.APPROVED
                },
                select: { studentId: true }
            });
            const managerIds = [classItem.lecturerId, classItem.departmentHeadId].filter(
                (id): id is number => typeof id === 'number'
            );

            await this.notificationsService.createMany(
                {
                    recipientIds: [...enrollments.map((enrollment) => enrollment.studentId), ...managerIds],
                    actorId,
                    type: 'CLASS_COMPLETED',
                    title: `Lớp ${classItem.code} đã hoàn thành`,
                    message: `${classItem.name} đã được chuyển sang trạng thái hoàn thành.`,
                    data: {
                        classPublicId: classItem.publicId,
                        coursePublicId: classItem.course.publicId,
                        status: classItem.status
                    }
                },
                tx
            );
        }
    }

    private async notifyClassCreated(classItem: ClassWithDetails, actorId: number, tx: Prisma.TransactionClient) {
        const recipientIds = [classItem.departmentHeadId, classItem.lecturerId].filter(
            (id): id is number => typeof id === 'number'
        );

        await this.notificationsService.createMany(
            {
                recipientIds,
                actorId,
                type: 'CLASS_CREATED',
                title: `Lớp mới được tạo: ${classItem.code}`,
                message: `${classItem.name} đã được tạo cho môn ${classItem.course.name}.`,
                data: {
                    classPublicId: classItem.publicId,
                    coursePublicId: classItem.course.publicId,
                    status: classItem.status
                }
            },
            tx
        );
    }

    private classSelect(includeEnrollments = false) {
        return classSelect(includeEnrollments);
    }

    private auditClassValue(classItem: ClassAuditValueSource) {
        return {
            code: classItem.code,
            name: classItem.name,
            courseId: classItem.courseId,
            lecturerId: classItem.lecturerId,
            departmentHeadId: classItem.departmentHeadId,
            maxStudents: classItem.maxStudents,
            status: classItem.status
        };
    }

    private formatClass(classItem: ClassWithDetails): FormattedClass {
        const { id: _id, _count, ...rest } = classItem;
        void _id;
        const enrolledCount = _count?.enrollments ?? 0;
        const availableSlots = Math.max((classItem.maxStudents ?? 0) - enrolledCount, 0);

        return {
            ...rest,
            weeklyScheduleText: this.getWeeklyScheduleText(classItem.weeklySchedule),
            enrolledCount,
            availableSlots,
            isFull: availableSlots <= 0,
            fullBadge: availableSlots <= 0 ? 'Đã đầy' : null
        };
    }

    private getWeeklyScheduleText(value: Prisma.JsonValue) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return '';
        }

        const text = value.text;
        return typeof text === 'string' ? text : '';
    }

    private percent(value: number, total: number) {
        return total > 0 ? `${Math.round((value / total) * 100)}%` : '0%';
    }
}
