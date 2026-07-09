import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { ApprovalAction, ApprovalLevel, AuditAction, CourseStatus, Prisma } from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';
import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { NotificationsService } from '~/modules/notifications/notifications.service';
import { ApproveCourseDto } from './dto/approve-course.dto';
import { AssignCourseDepartmentHeadDto } from './dto/assign-course-department-head.dto';
import { AssignCourseLecturersDto } from './dto/assign-course-lecturers.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateCourseProposalDto } from './dto/create-course-proposal.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

const courseSelect = () =>
    ({
        id: true,
        publicId: true,
        code: true,
        name: true,
        description: true,
        credits: true,
        requestedClassCount: true,
        requiresPrincipalApproval: true,
        status: true,
        departmentId: true,
        department: {
            select: {
                id: true,
                publicId: true,
                code: true,
                name: true
            }
        },
        departmentHeadId: true,
        departmentHead: {
            select: {
                publicId: true,
                code: true,
                fullName: true,
                email: true,
                departmentId: true
            }
        },
        lecturers: {
            orderBy: {
                assignedAt: 'desc' as const
            },
            select: {
                assignedAt: true,
                lecturer: {
                    select: {
                        publicId: true,
                        code: true,
                        fullName: true,
                        email: true,
                        departmentId: true
                    }
                }
            }
        },
        proposedBy: {
            select: {
                publicId: true,
                code: true,
                fullName: true,
                email: true
            }
        },
        approvals: {
            orderBy: {
                createdAt: 'desc' as const
            },
            select: {
                level: true,
                action: true,
                note: true,
                createdAt: true,
                approver: {
                    select: {
                        publicId: true,
                        code: true,
                        fullName: true
                    }
                }
            }
        },
        _count: {
            select: {
                classes: true
            }
        },
        createdAt: true,
        updatedAt: true
    }) satisfies Prisma.CourseSelect;

type CourseWithDetails = Prisma.CourseGetPayload<{ select: ReturnType<typeof courseSelect> }>;

@Injectable()
export class CoursesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService,
        private readonly notificationsService: NotificationsService
    ) {}

    async createOfficialCourse(dto: CreateCourseDto, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        this.ensureOfficialCatalogManager(actor);
        await this.ensureDepartmentExists(dto.departmentId);
        await this.ensureCourseCodeAvailable(dto.code);

        if (dto.departmentHeadId !== undefined) {
            await this.ensureDepartmentHead(dto.departmentHeadId, dto.departmentId);
        }

        const course = await this.prisma.$transaction(async (tx) => {
            const createdCourse = await tx.course.create({
                data: {
                    code: dto.code,
                    name: dto.name,
                    description: dto.description,
                    credits: dto.credits,
                    requestedClassCount: dto.requestedClassCount,
                    departmentId: dto.departmentId,
                    departmentHeadId: dto.departmentHeadId,
                    proposedById: actor.id,
                    status: CourseStatus.PENDING_PRINCIPAL,
                    requiresPrincipalApproval: true
                },
                select: this.courseSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.CREATE,
                    module: 'courses',
                    targetType: 'Course',
                    targetId: createdCourse.id,
                    targetPublicId: createdCourse.publicId,
                    newValue: {
                        source: 'official_curriculum',
                        flow: 'pdt_submit_to_principal',
                        code: createdCourse.code,
                        name: createdCourse.name,
                        credits: createdCourse.credits,
                        requestedClassCount: createdCourse.requestedClassCount,
                        requiresPrincipalApproval: createdCourse.requiresPrincipalApproval,
                        departmentId: createdCourse.departmentId,
                        departmentHeadId: createdCourse.departmentHeadId,
                        status: createdCourse.status
                    }
                },
                tx
            );

            await this.notifyCoursePendingPrincipal(createdCourse, actor.id, tx);

            return createdCourse;
        });

        return this.formatCourse(course);
    }

    async createProposal(dto: CreateCourseProposalDto, proposedByPublicId: string) {
        const proposedBy = await this.findUserByPublicIdOrThrow(proposedByPublicId);
        this.ensureNewCourseProposalCreator(proposedBy.role.code);
        await this.ensureDepartmentExists(dto.departmentId);

        await this.ensureCourseCodeAvailable(dto.code);

        const course = await this.prisma.$transaction(async (tx) => {
            const createdCourse = await tx.course.create({
                data: {
                    code: dto.code,
                    name: dto.name,
                    description: dto.description,
                    credits: dto.credits,
                    departmentId: dto.departmentId,
                    proposedById: proposedBy.id,
                    status: CourseStatus.PENDING_PDT,
                    requiresPrincipalApproval: true
                },
                select: this.courseSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: proposedBy.id,
                    action: AuditAction.CREATE,
                    module: 'courses',
                    targetType: 'Course',
                    targetId: createdCourse.id,
                    targetPublicId: createdCourse.publicId,
                    newValue: {
                        source: 'missing_curriculum_proposal',
                        code: createdCourse.code,
                        name: createdCourse.name,
                        credits: createdCourse.credits,
                        requiresPrincipalApproval: createdCourse.requiresPrincipalApproval,
                        departmentId: createdCourse.departmentId,
                        status: createdCourse.status
                    }
                },
                tx
            );

            await this.notifyCourseProposalCreated(createdCourse, proposedBy.id, tx);

            return createdCourse;
        });

        return this.formatCourse(course);
    }

    async findAll(query: QueryCourseDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const where = {
            ...(query.keyword
                ? {
                      OR: [{ code: { contains: query.keyword } }, { name: { contains: query.keyword } }]
                  }
                : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.departmentId ? { departmentId: query.departmentId } : {})
        };

        const [items, total] = await Promise.all([
            this.prisma.course.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: this.courseSelect()
            }),
            this.prisma.course.count({ where })
        ]);

        return {
            items: items.map((course) => this.formatCourse(course)),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async findByPublicIdOrThrow(publicId: string) {
        const course = await this.prisma.course.findUnique({
            where: { publicId },
            select: this.courseSelect()
        });

        if (!course) {
            throw new NotFoundException('Không tìm thấy môn học');
        }

        return this.formatCourse(course);
    }

    async update(publicId: string, dto: UpdateCourseDto, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const course = await this.prisma.course.findUnique({
            where: { publicId },
            select: {
                id: true,
                publicId: true,
                code: true,
                name: true,
                description: true,
                credits: true,
                requestedClassCount: true,
                departmentId: true,
                status: true
            }
        });

        if (!course) {
            throw new NotFoundException('Không tìm thấy môn học');
        }

        const lockedStatuses: CourseStatus[] = [
            CourseStatus.PDT_APPROVED,
            CourseStatus.PENDING_PRINCIPAL,
            CourseStatus.PRINCIPAL_APPROVED,
            CourseStatus.ACTIVE
        ];

        if (lockedStatuses.includes(course.status)) {
            throw new BadRequestException('Không thể cập nhật môn học đã vào quy trình duyệt hoặc đã kích hoạt');
        }

        if (dto.departmentId) {
            await this.ensureDepartmentExists(dto.departmentId);
        }

        if (dto.code && dto.code !== course.code) {
            await this.ensureCourseCodeAvailable(dto.code, publicId);
        }

        const updatedCourse = await this.prisma.course.update({
            where: { publicId },
            data: {
                code: dto.code,
                name: dto.name,
                description: dto.description,
                credits: dto.credits,
                departmentId: dto.departmentId,
                status: course.status === CourseStatus.PDT_REJECTED ? CourseStatus.PENDING_PDT : undefined
            },
            select: this.courseSelect()
        });

        await this.auditLogsService.create({
            actorId: actor.id,
            action: AuditAction.UPDATE,
            module: 'courses',
            targetType: 'Course',
            targetId: updatedCourse.id,
            targetPublicId: updatedCourse.publicId,
            oldValue: {
                code: course.code,
                name: course.name,
                description: course.description,
                credits: course.credits,
                requestedClassCount: course.requestedClassCount,
                departmentId: course.departmentId,
                status: course.status
            },
            newValue: {
                code: updatedCourse.code,
                name: updatedCourse.name,
                description: updatedCourse.description,
                credits: updatedCourse.credits,
                requestedClassCount: updatedCourse.requestedClassCount,
                departmentId: updatedCourse.departmentId,
                status: updatedCourse.status
            }
        });

        return this.formatCourse(updatedCourse);
    }

    async decideByTrainingOffice(publicId: string, dto: ApproveCourseDto, approverPublicId: string) {
        return this.decideCourse({
            publicId,
            dto,
            approverPublicId,
            level: ApprovalLevel.PDT,
            expectedStatus: CourseStatus.PENDING_PDT,
            approvedStatus: CourseStatus.PENDING_PRINCIPAL,
            rejectedStatus: CourseStatus.PDT_REJECTED,
            approverRoleCodes: ['ADMIN', 'TRAINING_OFFICER']
        });
    }

    async decideByPrincipal(publicId: string, dto: ApproveCourseDto, approverPublicId: string) {
        return this.decideCourse({
            publicId,
            dto,
            approverPublicId,
            level: ApprovalLevel.PRINCIPAL,
            expectedStatus: CourseStatus.PENDING_PRINCIPAL,
            approvedStatus: CourseStatus.ACTIVE,
            rejectedStatus: CourseStatus.PRINCIPAL_REJECTED,
            approverRoleCodes: ['ADMIN', 'PRINCIPAL']
        });
    }

    async assignDepartmentHead(publicId: string, dto: AssignCourseDepartmentHeadDto, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        this.ensureOfficialCatalogManager(actor);

        const course = await this.findCourseRecordOrThrow(publicId);
        const departmentHead = await this.ensureDepartmentHead(dto.departmentHeadId, course.departmentId);

        const updatedCourse = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.course.update({
                where: { publicId },
                data: {
                    departmentHeadId: departmentHead.id
                },
                select: this.courseSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.ASSIGN,
                    module: 'courses',
                    targetType: 'Course',
                    targetId: updated.id,
                    targetPublicId: updated.publicId,
                    oldValue: {
                        departmentHeadId: course.departmentHeadId
                    },
                    newValue: {
                        departmentHeadId: departmentHead.id
                    }
                },
                tx
            );

            await this.notificationsService.createMany(
                {
                    recipientIds: [departmentHead.id],
                    actorId: actor.id,
                    type: 'COURSE_DEPARTMENT_HEAD_ASSIGNED',
                    title: `Bạn được gán phụ trách môn ${updated.code}`,
                    message: `Bạn đã được gán phụ trách môn ${updated.name}. ạn có thể phân công giảng viên cho các lớp của môn này.`,
                    data: {
                        coursePublicId: updated.publicId,
                        status: updated.status
                    }
                },
                tx
            );

            return updated;
        });

        return this.formatCourse(updatedCourse);
    }

    async assignLecturers(publicId: string, dto: AssignCourseLecturersDto, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const course = await this.findCourseRecordOrThrow(publicId);
        this.ensureCanAssignCourseLecturers(actor, course);

        const uniqueLecturerIds = [...new Set(dto.lecturerIds)];
        const lecturers = await this.ensureLecturers(uniqueLecturerIds, course.departmentId);

        const updatedCourse = await this.prisma.$transaction(async (tx) => {
            await tx.courseLecturer.deleteMany({
                where: { courseId: course.id }
            });

            await tx.courseLecturer.createMany({
                data: lecturers.map((lecturer) => ({
                    courseId: course.id,
                    lecturerId: lecturer.id
                }))
            });

            return tx.course.findUniqueOrThrow({
                where: { publicId },
                select: this.courseSelect()
            });
        });

        await this.auditLogsService.create({
            actorId: actor.id,
            action: AuditAction.ASSIGN,
            module: 'courses',
            targetType: 'Course',
            targetId: updatedCourse.id,
            targetPublicId: updatedCourse.publicId,
            oldValue: {
                lecturerIds: course.lecturers.map((item) => item.lecturerId)
            },
            newValue: {
                lecturerIds: uniqueLecturerIds
            }
        });

        return this.formatCourse(updatedCourse);
    }

    async updateStatus(publicId: string, status: CourseStatus, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        this.ensureOfficialCatalogManager(actor);

        const course = await this.findCourseRecordOrThrow(publicId);

        if (status !== CourseStatus.ACTIVE && status !== CourseStatus.INACTIVE) {
            throw new BadRequestException('Chỉ hỗ trợ kích hoạt hoặc vô hiệu hóa môn học');
        }

        if (status === course.status) {
            return this.findByPublicIdOrThrow(publicId);
        }

        if (status === CourseStatus.ACTIVE) {
            const activatableStatuses: CourseStatus[] = [CourseStatus.PRINCIPAL_APPROVED, CourseStatus.INACTIVE];

            if (!activatableStatuses.includes(course.status)) {
                throw new BadRequestException(
                    'Chỉ môn đã được Hiệu trưởng duyệt hoặc đang INACTIVE mới được kích hoạt'
                );
            }

            if (!course.departmentHeadId) {
                throw new BadRequestException('Phải gán Trưởng bộ môn trước khi kích hoạt môn học');
            }

            if (course.lecturers.length === 0) {
                throw new BadRequestException('Phải gán ít nhất một Giảng viên trước khi kích hoạt môn học');
            }
        }

        if (status === CourseStatus.INACTIVE && course.status !== CourseStatus.ACTIVE) {
            throw new BadRequestException('Chỉ môn ACTIVE mới được vô hiệu hóa');
        }

        const updatedCourse = await this.prisma.course.update({
            where: { publicId },
            data: { status },
            select: this.courseSelect()
        });

        await this.auditLogsService.create({
            actorId: actor.id,
            action: AuditAction.STATUS_CHANGE,
            module: 'courses',
            targetType: 'Course',
            targetId: updatedCourse.id,
            targetPublicId: updatedCourse.publicId,
            oldValue: {
                status: course.status
            },
            newValue: {
                status: updatedCourse.status
            }
        });

        return this.formatCourse(updatedCourse);
    }

    async removeRejected(publicId: string, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const course = await this.findCourseRecordOrThrow(publicId);
        const rejectedStatuses: CourseStatus[] = [CourseStatus.PDT_REJECTED, CourseStatus.PRINCIPAL_REJECTED];

        if (!rejectedStatuses.includes(course.status)) {
            throw new BadRequestException('Chỉ có thể xóa đề xuất môn học đã bị từ chối');
        }

        if ((course._count?.classes ?? 0) > 0) {
            throw new BadRequestException('Không thể xóa môn học đã có lớp phát sinh');
        }

        if (!['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code) && actor.id !== course.proposedById) {
            throw new ForbiddenException('Chỉ người đề xuất hoặc Phòng đào tạo được xóa đề xuất bị từ chối');
        }

        await this.prisma.$transaction(async (tx) => {
            await this.auditLogsService.create(
                {
                    actorId: actor.id,
                    action: AuditAction.DELETE,
                    module: 'courses',
                    targetType: 'Course',
                    targetId: course.id,
                    targetPublicId: course.publicId,
                    oldValue: {
                        status: course.status,
                        classCount: course._count?.classes ?? 0
                    }
                },
                tx
            );

            await tx.course.delete({
                where: { publicId }
            });
        });

        return {
            publicId,
            deleted: true
        };
    }

    private async decideCourse(options: {
        publicId: string;
        dto: ApproveCourseDto;
        approverPublicId: string;
        level: ApprovalLevel;
        expectedStatus: CourseStatus;
        approvedStatus: CourseStatus;
        rejectedStatus: CourseStatus;
        approverRoleCodes: string[];
    }) {
        const approver = await this.findUserByPublicIdOrThrow(options.approverPublicId);
        const course = await this.prisma.course.findUnique({
            where: { publicId: options.publicId },
            select: {
                id: true,
                status: true,
                code: true,
                name: true,
                requestedClassCount: true,
                proposedBy: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true
                    }
                }
            }
        });

        if (!course) {
            throw new NotFoundException('Không tìm thấy môn học');
        }

        if (!options.approverRoleCodes.includes(approver.role.code)) {
            throw new ForbiddenException('Vai trò không được duyệt bước này');
        }

        if (course.status !== options.expectedStatus) {
            throw new BadRequestException('Trạng thái môn học không hợp lệ để duyệt bước này');
        }

        const nextStatus =
            options.dto.action === ApprovalAction.APPROVED ? options.approvedStatus : options.rejectedStatus;

        const updatedCourse = await this.prisma.$transaction(async (tx) => {
            await tx.courseApproval.create({
                data: {
                    courseId: course.id,
                    approverId: approver.id,
                    level: options.level,
                    action: options.dto.action,
                    note: options.dto.note
                }
            });

            const updatedCourse = await tx.course.update({
                where: { publicId: options.publicId },
                data: {
                    status: nextStatus
                },
                select: this.courseSelect()
            });

            await this.auditLogsService.create(
                {
                    actorId: approver.id,
                    action: options.dto.action === ApprovalAction.APPROVED ? AuditAction.APPROVE : AuditAction.REJECT,
                    module: 'course_proposals',
                    targetType: 'Course',
                    targetId: updatedCourse.id,
                    targetPublicId: updatedCourse.publicId,
                    oldValue: {
                        status: course.status
                    },
                    newValue: {
                        level: options.level,
                        action: options.dto.action,
                        note: options.dto.note,
                        status: updatedCourse.status
                    }
                },
                tx
            );

            await this.notifyCourseDecision(
                updatedCourse,
                course.proposedBy.id,
                approver.id,
                options.level,
                options.dto.action,
                tx
            );

            return updatedCourse;
        });

        return this.formatCourse(updatedCourse);
    }

    private async ensureDepartmentExists(departmentId: number) {
        const department = await this.prisma.department.findUnique({
            where: { id: departmentId },
            select: { id: true }
        });

        if (!department) {
            throw new BadRequestException('Khoa/phòng ban không hợp lệ');
        }
    }

    private ensureOfficialCatalogManager(actor: { role: { code: string } }) {
        if (!['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code)) {
            throw new ForbiddenException('Chỉ Phòng đào tạo được quản lý danh mục môn học chính thức');
        }
    }

    private ensureCanAssignCourseLecturers(
        actor: { id: number; role: { code: string } },
        course: { departmentHeadId: number | null }
    ) {
        if (['ADMIN', 'TRAINING_OFFICER'].includes(actor.role.code)) {
            return;
        }

        if (actor.role.code !== 'DEPARTMENT_HEAD' || actor.id !== course.departmentHeadId) {
            throw new ForbiddenException('Chỉ Trưởng bộ môn được gán cho môn này mới được phân công giảng viên');
        }
    }

    private async ensureDepartmentHead(userId: number, departmentId: number) {
        const user = await this.prisma.user.findFirst({
            where: {
                id: userId,
                deletedAt: null,
                status: 'ACTIVE',
                departmentId,
                role: {
                    code: 'DEPARTMENT_HEAD'
                }
            },
            select: { id: true }
        });

        if (!user) {
            throw new BadRequestException('Trưởng bộ môn không hợp lệ hoặc không thuộc bộ môn của môn học');
        }

        return user;
    }

    private async ensureLecturers(lecturerIds: number[], departmentId: number) {
        const lecturers = await this.prisma.user.findMany({
            where: {
                id: { in: lecturerIds },
                deletedAt: null,
                status: 'ACTIVE',
                departmentId,
                role: {
                    code: 'LECTURER'
                }
            },
            select: { id: true }
        });

        if (lecturers.length !== lecturerIds.length) {
            throw new BadRequestException('Danh sách giảng viên không hợp lệ hoặc không thuộc bộ môn của môn học');
        }

        return lecturers;
    }

    private ensureNewCourseProposalCreator(roleCode: string) {
        if (roleCode === 'ADMIN' || roleCode === 'DEPARTMENT_HEAD') {
            return;
        }

        throw new ForbiddenException('Chỉ có trưởng bộ môn tạo mới chưa có trong giáo trình');
    }

    private async ensureCourseCodeAvailable(code: string, exceptPublicId?: string) {
        const duplicate = await this.prisma.course.findFirst({
            where: {
                code,
                ...(exceptPublicId ? { publicId: { not: exceptPublicId } } : {})
            }
        });

        if (duplicate) {
            throw new ConflictException('Mã môn học đã tồn tại');
        }
    }

    private async notifyCourseProposalCreated(
        course: CourseWithDetails,
        actorId: number,
        tx: Prisma.TransactionClient
    ) {
        const trainingOfficers = await this.findActiveUserIdsByRoles(['TRAINING_OFFICER'], tx);
        await this.notificationsService.createMany(
            {
                recipientIds: trainingOfficers,
                actorId,
                type: 'COURSE_PROPOSAL_SUBMITTED',
                title: `Đề xuất môn học mới: ${course.code}`,
                message: `${course.name} Đang chờ Phòng đào tạo xử lý.`,
                data: {
                    coursePublicId: course.publicId,
                    status: course.status
                }
            },
            tx
        );
    }

    private async notifyCoursePendingPrincipal(
        course: CourseWithDetails,
        actorId: number,
        tx: Prisma.TransactionClient
    ) {
        const principals = await this.findActiveUserIdsByRoles(['PRINCIPAL'], tx);
        await this.notificationsService.createMany(
            {
                recipientIds: principals,
                actorId,
                type: 'COURSE_PENDING_PRINCIPAL',
                title: `Mon ${course.code} can Hieu truong duyet`,
                message: `${course.name} da duoc Phong Dao tao submit va dang cho Hieu truong duyet.`,
                data: {
                    coursePublicId: course.publicId,
                    status: course.status
                }
            },
            tx
        );
    }

    private async notifyCourseDecision(
        course: CourseWithDetails,
        proposedById: number,
        actorId: number,
        level: ApprovalLevel,
        action: ApprovalAction,
        tx: Prisma.TransactionClient
    ) {
        if (level === ApprovalLevel.PDT && action === ApprovalAction.APPROVED) {
            const principals = await this.findActiveUserIdsByRoles(['PRINCIPAL'], tx);
            await this.notificationsService.createMany(
                {
                    recipientIds: principals,
                    actorId,
                    type: 'COURSE_PROPOSAL_PENDING_PRINCIPAL',
                    title: `Môn ${course.code} chờ Hiệu trưởng duyệt`,
                    message: `${course.name} đã được Phòng đào tạo duyệt và đang chờ Hiệu trưởng.`,
                    data: {
                        coursePublicId: course.publicId,
                        status: course.status
                    }
                },
                tx
            );
            return;
        }

        if (level === ApprovalLevel.PDT && action === ApprovalAction.REJECTED) {
            await this.notificationsService.createMany(
                {
                    recipientIds: [proposedById],
                    actorId,
                    type: 'COURSE_PROPOSAL_REJECTED_BY_PDT',
                    title: `Đề xuất môn ${course.code} bị phòng đào tạo từ chối`,
                    message: `${course.name} đã bị Phòng đào tạo từ chối.`,
                    data: {
                        coursePublicId: course.publicId,
                        status: course.status
                    }
                },
                tx
            );
            return;
        }

        if (level === ApprovalLevel.PRINCIPAL) {
            const trainingOfficers = await this.findActiveUserIdsByRoles(['TRAINING_OFFICER'], tx);
            const isApproved = action === ApprovalAction.APPROVED;
            await this.notificationsService.createMany(
                {
                    recipientIds: [proposedById, ...trainingOfficers],
                    actorId,
                    type: isApproved ? 'COURSE_PROPOSAL_PRINCIPAL_APPROVED' : 'COURSE_PROPOSAL_PRINCIPAL_REJECTED',
                    title: isApproved
                        ? `Môn ${course.code} đã được Hiệu trưởng duyệt`
                        : `Môn ${course.code} bị Hiệu trưởng từ chối`,
                    message: isApproved
                        ? `${course.name} đã được Hiệu trưởng duyệt. Phòng đào tạo có thể kích hoạt môn.`
                        : `${course.name} đã bị Hiệu trưởng từ chối.`,
                    data: {
                        coursePublicId: course.publicId,
                        status: course.status
                    }
                },
                tx
            );
        }
    }

    private async findActiveUserIdsByRoles(roleCodes: string[], tx: Prisma.TransactionClient) {
        const users = await tx.user.findMany({
            where: {
                deletedAt: null,
                status: 'ACTIVE',
                role: {
                    code: { in: roleCodes }
                }
            },
            select: { id: true }
        });

        return users.map((user) => user.id);
    }

    private async findUserByPublicIdOrThrow(publicId: string) {
        const user = await this.prisma.user.findFirst({
            where: {
                publicId,
                deletedAt: null
            },
            select: {
                id: true,
                publicId: true,
                fullName: true,
                status: true,
                departmentId: true,
                role: {
                    select: {
                        code: true
                    }
                }
            }
        });

        if (!user) {
            throw new NotFoundException('Không tìm thấy người dùng');
        }

        if (!user.role) {
            throw new ForbiddenException('Nguoi dung chua duoc gan vai tro');
        }

        return { ...user, role: user.role };
    }

    private async findCourseRecordOrThrow(publicId: string) {
        const course = await this.prisma.course.findUnique({
            where: { publicId },
            select: {
                id: true,
                publicId: true,
                status: true,
                departmentId: true,
                departmentHeadId: true,
                proposedById: true,
                lecturers: {
                    select: {
                        lecturerId: true
                    }
                },
                _count: {
                    select: {
                        classes: true
                    }
                }
            }
        });

        if (!course) {
            throw new NotFoundException('Không tìm thấy môn học');
        }

        return course;
    }

    private courseSelect() {
        return courseSelect();
    }

    private formatCourse(course: CourseWithDetails) {
        const { id, _count, ...rest } = course;

        return {
            id,
            ...rest,
            lecturers:
                rest.lecturers?.map((item) => ({
                    ...item.lecturer,
                    assignedAt: item.assignedAt
                })) ?? [],
            classCount: _count?.classes ?? 0
        };
    }
}
