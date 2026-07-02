import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ClassStatus, CourseStatus, EnrollmentStatus, Prisma } from '@prisma/client';

import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { PrismaService } from '~/prisma/prisma.service';
import { AssignClassHeadDto } from './dto/assign-class-head.dto';
import { AssignLecturerDto, ClassTeacherRole } from './dto/assign-lecturer.dto';
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
        assistantId: true,
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
        assistant: {
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
                }
            }
        },
        createdAt: true,
        updatedAt: true
    }) satisfies Prisma.ClassSelect;

type ClassWithDetails = Prisma.ClassGetPayload<{ select: ReturnType<typeof classSelect> }>;

@Injectable()
export class ClassesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService
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
            throw new BadRequestException('Phai gan truong bo mon truoc khi tao lop');
        }

        await this.ensureDepartmentHead(departmentHeadId, course.departmentId);
        if (dto.lecturerId) await this.ensureLecturer(dto.lecturerId, course.departmentId);
        if (dto.assistantId) await this.ensureLecturer(dto.assistantId, course.departmentId);

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

            return classItem;
        });

        return this.formatClass(createdClass);
    }

    async summary(query: QueryClassDto) {
        const where = await this.buildClassWhere({ ...query, page: undefined, limit: undefined });
        const total = await this.prisma.class.count({ where });
        const approvedEnrollmentWhere = { ...where, enrollments: { some: { status: EnrollmentStatus.APPROVED } } };

        const [
            draft,
            openRegistration,
            closedRegistration,
            inProgress,
            completed,
            totalRegistered,
            fullCandidates
        ] = await Promise.all([
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
        const where = await this.buildClassWhere(query);

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

        let formattedItems = items.map((item) => this.formatClass(item));
        if (query.isFull !== undefined || query.hasAvailableSlots !== undefined) {
            formattedItems = formattedItems.filter((item) =>
                query.isFull !== undefined ? item.isFull === query.isFull : item.availableSlots > 0
            );
        }

        return {
            items: formattedItems,
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
            throw new NotFoundException('Khong tim thay lop hoc');
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
            this.ensureValidClassDates(dto.startDate ?? classItem.startDate.toISOString(), dto.endDate ?? classItem.endDate.toISOString());
        }
        this.ensureValidRegistrationDates(dto.registrationStartDate, dto.registrationEndDate);
        if (dto.departmentHeadId) await this.ensureDepartmentHead(dto.departmentHeadId, course.departmentId);
        if (dto.lecturerId) await this.ensureLecturer(dto.lecturerId, course.departmentId);
        if (dto.assistantId) await this.ensureLecturer(dto.assistantId, course.departmentId);

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
        this.ensureTrainingOffice(actor);
        const classItem = await this.findClassRecordOrThrow(publicId);

        if (classItem._count.enrollments > 0) {
            throw new BadRequestException('Lop da co sinh vien nen khong duoc xoa cung');
        }

        await this.prisma.$transaction(async (tx) => {
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

            await tx.class.delete({ where: { publicId } });
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

            return updated;
        });

        return this.formatClass(updatedClass);
    }

    async assignLecturer(publicId: string, dto: AssignLecturerDto, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const classItem = await this.findClassRecordOrThrow(publicId);
        this.ensureCanManageClass(actor, classItem);
        await this.ensureLecturer(dto.lecturerId, classItem.course.departmentId);

        const data =
            dto.role === ClassTeacherRole.ASSISTANT
                ? { assistantId: dto.lecturerId }
                : { lecturerId: dto.lecturerId };

        const updatedClass = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.class.update({
                where: { publicId },
                data,
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
                    oldValue: { lecturerId: classItem.lecturerId, assistantId: classItem.assistantId },
                    newValue: { ...data, role: dto.role, startsAt: dto.startsAt, note: dto.note }
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

            return updated;
        });

        return this.formatClass(updatedClass);
    }

    private async buildClassWhere(query: QueryClassDto): Promise<Prisma.ClassWhereInput> {
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

    private toClassData(dto: CreateClassDto, courseId: number, departmentHeadId: number): Prisma.ClassUncheckedCreateInput {
        return {
            code: dto.code,
            name: dto.name,
            description: dto.description,
            courseId,
            lecturerId: dto.lecturerId,
            assistantId: dto.assistantId,
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
            assistantId: dto.assistantId,
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

        if (!course) throw new NotFoundException('Khong tim thay mon hoc');
        if (course.status !== CourseStatus.ACTIVE) throw new BadRequestException('Chi co the tao lop tu mon ACTIVE');
        return course;
    }

    private async ensureClassCodeAvailable(code: string, exceptPublicId?: string) {
        const duplicate = await this.prisma.class.findFirst({
            where: {
                code,
                ...(exceptPublicId ? { publicId: { not: exceptPublicId } } : {})
            }
        });

        if (duplicate) throw new ConflictException('Ma lop hoc da ton tai');
    }

    private ensureTrainingOffice(actor: { role: { code: string } }) {
        if (!['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code)) {
            throw new ForbiddenException('Chi Phong dao tao duoc tao hoac cap nhat lop hoc');
        }
    }

    private ensureCanManageClass(actor: { id: number; role: { code: string } }, classItem: { departmentHeadId: number }) {
        if (['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code)) return;
        if (actor.role.code !== 'DEPARTMENT_HEAD' || actor.id !== classItem.departmentHeadId) {
            throw new ForbiddenException('Chi truong bo mon quan ly lop nay moi duoc thao tac');
        }
    }

    private ensureCanChangeStatus(actor: { id: number; role: { code: string } }, classItem: { departmentHeadId: number }) {
        this.ensureCanManageClass(actor, classItem);
    }

    private ensureStatusTransition(classItem: Awaited<ReturnType<ClassesService['findClassRecordOrThrow']>>, nextStatus: ClassStatus) {
        const terminalStatuses: ClassStatus[] = [ClassStatus.COMPLETED, ClassStatus.CANCELLED];
        if (terminalStatuses.includes(classItem.status)) {
            throw new BadRequestException('Lop da ket thuc hoac da huy khong the doi trang thai');
        }

        if (nextStatus === ClassStatus.OPEN_REGISTRATION) {
            const openableStatuses: ClassStatus[] = [ClassStatus.DRAFT, ClassStatus.CLOSED_REGISTRATION];
            if (!openableStatuses.includes(classItem.status)) {
                throw new BadRequestException('Chi lop DRAFT hoac CLOSED_REGISTRATION moi duoc mo dang ky');
            }
            if (classItem.course.status !== CourseStatus.ACTIVE) throw new BadRequestException('Mon hoc khong con ACTIVE');
            if (!classItem.departmentHeadId) throw new BadRequestException('Lop chua co truong bo mon quan ly');
            if (!classItem.maxStudents || classItem.maxStudents <= 0) throw new BadRequestException('Si so toi da khong hop le');
            this.ensureValidRegistrationDates(
                classItem.registrationStartDate?.toISOString(),
                classItem.registrationEndDate?.toISOString()
            );
        }

        if (nextStatus === ClassStatus.CLOSED_REGISTRATION && classItem.status !== ClassStatus.OPEN_REGISTRATION) {
            throw new BadRequestException('Chi lop dang mo dang ky moi duoc dong dang ky');
        }

        if (nextStatus === ClassStatus.IN_PROGRESS && !classItem.lecturerId) {
            throw new BadRequestException('Phai gan giang vien chinh truoc khi bat dau lop');
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
        if (!user) throw new BadRequestException('Truong bo mon khong hop le voi bo mon cua lop');
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
        if (!lecturer) throw new BadRequestException('Giang vien khong hop le voi bo mon cua lop');
    }

    private ensureValidClassDates(startDate: string, endDate: string) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            throw new BadRequestException('Ngay ket thuc phai sau ngay bat dau');
        }
    }

    private ensureValidRegistrationDates(startDate?: string, endDate?: string) {
        if (!startDate || !endDate) return;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            throw new BadRequestException('Ngay dong dang ky phai sau ngay mo dang ky');
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
        if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
        if (!user.role) throw new ForbiddenException('Nguoi dung chua duoc gan vai tro');
        return { ...user, role: user.role };
    }

    private async findClassRecordOrThrow(publicId: string) {
        const classItem = await this.prisma.class.findUnique({
            where: { publicId },
            select: this.classSelect()
        });
        if (!classItem) throw new NotFoundException('Khong tim thay lop hoc');
        return classItem;
    }

    private classSelect(includeEnrollments = false) {
        return classSelect(includeEnrollments);
    }

    private auditClassValue(classItem: any) {
        return {
            code: classItem.code,
            name: classItem.name,
            courseId: classItem.courseId,
            lecturerId: classItem.lecturerId,
            assistantId: classItem.assistantId,
            departmentHeadId: classItem.departmentHeadId,
            maxStudents: classItem.maxStudents,
            status: classItem.status
        };
    }

    private formatClass(classItem: ClassWithDetails | any) {
        const { id: _id, _count, ...rest } = classItem;
        void _id;
        const enrolledCount = _count?.enrollments ?? 0;
        const availableSlots = Math.max((classItem.maxStudents ?? 0) - enrolledCount, 0);

        return {
            ...rest,
            weeklyScheduleText: classItem.weeklySchedule?.text || '',
            enrolledCount,
            availableSlots,
            isFull: availableSlots <= 0,
            fullBadge: availableSlots <= 0 ? 'Đã đầy' : null
        };
    }

    private percent(value: number, total: number) {
        return total > 0 ? `${Math.round((value / total) * 100)}%` : '0%';
    }
}
