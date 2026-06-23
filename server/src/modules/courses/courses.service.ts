import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalAction, ApprovalLevel, AuditAction, ClassStatus, CourseStatus } from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';
import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { ApproveCourseDto } from './dto/approve-course.dto';
import { CreateCourseProposalDto } from './dto/create-course-proposal.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService
    ) {}

    async createProposal(dto: CreateCourseProposalDto, proposedByPublicId: string) {
        const proposedBy = await this.findUserByPublicIdOrThrow(proposedByPublicId);
        await this.ensureDepartmentExists(dto.departmentId);

        const existingCourse = await this.prisma.course.findUnique({
            where: { code: dto.code },
            select: {
                id: true,
                status: true,
                requiresPrincipalApproval: true
            }
        });

        const pendingStatuses: CourseStatus[] = [
            CourseStatus.PENDING_PDT,
            CourseStatus.PDT_APPROVED,
            CourseStatus.PENDING_PRINCIPAL
        ];

        if (existingCourse && pendingStatuses.includes(existingCourse.status)) {
            throw new BadRequestException('Môn học này đang có đề xuất chờ duyệt');
        }

        const approvedCourseStatuses: CourseStatus[] = [CourseStatus.ACTIVE, CourseStatus.INACTIVE];
        const isExistingApprovedCourse = existingCourse && approvedCourseStatuses.includes(existingCourse.status);

        const course = existingCourse
            ? await this.prisma.course.update({
                  where: { id: existingCourse.id },
                  data: {
                      ...(isExistingApprovedCourse
                          ? {}
                          : {
                                name: dto.name,
                                description: dto.description,
                                credits: dto.credits,
                                departmentId: dto.departmentId
                            }),
                      requestedClassCount: dto.requestedClassCount,
                      proposedById: proposedBy.id,
                      status: CourseStatus.PENDING_PDT,
                      requiresPrincipalApproval: isExistingApprovedCourse
                          ? false
                          : existingCourse.requiresPrincipalApproval
                  },
                  select: this.courseSelect()
              })
            : await this.prisma.course.create({
                  data: {
                      code: dto.code,
                      name: dto.name,
                      description: dto.description,
                      credits: dto.credits,
                      requestedClassCount: dto.requestedClassCount,
                      departmentId: dto.departmentId,
                      proposedById: proposedBy.id,
                      status: CourseStatus.PENDING_PDT,
                      requiresPrincipalApproval: true
                  },
                  select: this.courseSelect()
              });

        await this.auditLogsService.create({
            actorId: proposedBy.id,
            action: AuditAction.CREATE,
            module: 'courses',
            targetType: 'Course',
            targetId: course.id,
            targetPublicId: course.publicId,
            newValue: {
                code: course.code,
                name: course.name,
                credits: course.credits,
                requestedClassCount: course.requestedClassCount,
                requiresPrincipalApproval: course.requiresPrincipalApproval,
                departmentId: course.departmentId,
                status: course.status
            }
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
                requestedClassCount: dto.requestedClassCount,
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
                requiresPrincipalApproval: true,
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
            options.dto.action === ApprovalAction.APPROVED
                ? options.level === ApprovalLevel.PDT && !course.requiresPrincipalApproval
                    ? CourseStatus.ACTIVE
                    : options.approvedStatus
                : options.rejectedStatus;

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

            if (options.dto.action === ApprovalAction.APPROVED && nextStatus === CourseStatus.ACTIVE) {
                await this.createApprovedClasses(tx, {
                    courseId: course.id,
                    courseCode: course.code,
                    courseName: course.name,
                    requestedClassCount: course.requestedClassCount ?? 0,
                    departmentHeadId: course.proposedBy.id
                });
            }

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

            return updatedCourse;
        });

        return this.formatCourse(updatedCourse);
    }

    private async createApprovedClasses(
        tx: any,
        data: {
            courseId: number;
            courseCode: string;
            courseName: string;
            requestedClassCount: number;
            departmentHeadId: number;
        }
    ) {
        if (data.requestedClassCount <= 0) {
            return;
        }

        const existingClasses = await tx.class.findMany({
            where: {
                courseId: data.courseId
            },
            select: {
                code: true
            }
        });

        const usedCodes = new Set(existingClasses.map((classItem: { code: string }) => classItem.code));
        const startDate = this.defaultClassStartDate();
        const endDate = this.defaultClassEndDate(startDate);
        const classes: {
            code: string;
            name: string;
            courseId: number;
            lecturerId: null;
            departmentHeadId: number;
            maxStudents: number;
            startDate: Date;
            endDate: Date;
            status: ClassStatus;
        }[] = [];
        let sequence = 1;

        while (classes.length < data.requestedClassCount) {
            const suffix = String(sequence).padStart(2, '0');
            const code = `${data.courseCode}-${suffix}`;

            if (!usedCodes.has(code)) {
                usedCodes.add(code);
                classes.push({
                    code,
                    name: `${data.courseName} - Lớp ${suffix}`,
                    courseId: data.courseId,
                    lecturerId: null,
                    departmentHeadId: data.departmentHeadId,
                    maxStudents: 40,
                    startDate,
                    endDate,
                    status: ClassStatus.UPCOMING
                });
            }

            sequence += 1;
        }

        await tx.class.createMany({
            data: classes
        });
    }

    private defaultClassStartDate() {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    private defaultClassEndDate(startDate: Date) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + 4);
        return date;
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

        return user;
    }

    private courseSelect() {
        return {
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
                    publicId: true,
                    code: true,
                    name: true
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
        };
    }

    private formatCourse(course: any) {
        const { id, _count, ...rest } = course;

        return {
            ...rest,
            classCount: _count?.classes ?? 0
        };
    }

}
