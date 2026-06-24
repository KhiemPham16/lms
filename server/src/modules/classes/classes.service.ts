import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ClassStatus, CourseStatus, EnrollmentStatus } from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';
import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { AssignLecturerDto } from './dto/assign-lecturer.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { QueryClassDto } from './dto/query-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@Injectable()
export class ClassesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService
    ) {}

    async create(coursePublicId: string, dto: CreateClassDto, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const course = await this.prisma.course.findUnique({
            where: { publicId: coursePublicId },
            select: { id: true, status: true, proposedById: true }
        });

        if (!course) {
            throw new NotFoundException('Không tìm thấy môn học');
        }

        const classReadyStatuses: CourseStatus[] = [CourseStatus.PRINCIPAL_APPROVED, CourseStatus.ACTIVE];

        if (!classReadyStatuses.includes(course.status)) {
            throw new BadRequestException('Chỉ có thể tạo lớp cho môn học đã được phê duyệt');
        }

        await this.ensureClassCodeAvailable(dto.code);
        if (dto.lecturerId) {
            await this.ensureLecturer(dto.lecturerId);
        }
        this.ensureValidClassDates(dto.startDate, dto.endDate);

        const createdClass = await this.prisma.class.create({
            data: {
                code: dto.code,
                name: dto.name,
                courseId: course.id,
                lecturerId: dto.lecturerId ?? null,
                departmentHeadId: course.proposedById,
                maxStudents: dto.maxStudents,
                startDate: new Date(dto.startDate),
                endDate: new Date(dto.endDate),
                status: dto.status ?? ClassStatus.UPCOMING
            },
            select: this.classSelect()
        });

        await this.auditLogsService.create({
            actorId: actor.id,
            action: AuditAction.CREATE,
            module: 'classes',
            targetType: 'Class',
            targetId: createdClass.id,
            targetPublicId: createdClass.publicId,
            newValue: {
                code: createdClass.code,
                name: createdClass.name,
                lecturerId: createdClass.lecturerId,
                departmentHeadId: createdClass.departmentHeadId,
                maxStudents: createdClass.maxStudents,
                startDate: createdClass.startDate.toISOString(),
                endDate: createdClass.endDate.toISOString(),
                status: createdClass.status
            }
        });

        return this.formatClass(createdClass);
    }

    async findAll(query: QueryClassDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const where = {
            ...(query.keyword
                ? {
                      OR: [
                          { code: { contains: query.keyword } },
                          { name: { contains: query.keyword } },
                          { course: { code: { contains: query.keyword } } },
                          { course: { name: { contains: query.keyword } } }
                      ]
                  }
                : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.courseId ? { courseId: query.courseId } : {}),
            ...(query.lecturerId ? { lecturerId: query.lecturerId } : {})
        };

        const [items, total] = await Promise.all([
            this.prisma.class.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
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
        const classItem = await this.prisma.class.findUnique({
            where: { publicId },
            select: {
                id: true,
                publicId: true,
                code: true,
                name: true,
                lecturerId: true,
                maxStudents: true,
                startDate: true,
                endDate: true,
                status: true
            }
        });

        if (!classItem) {
            throw new NotFoundException('Không tìm thấy lớp học');
        }

        if (dto.code && dto.code !== classItem.code) {
            await this.ensureClassCodeAvailable(dto.code, publicId);
        }

        if (dto.lecturerId) {
            await this.ensureLecturer(dto.lecturerId);
        }

        if (dto.startDate || dto.endDate) {
            this.ensureValidClassDates(
                dto.startDate ?? classItem.startDate.toISOString(),
                dto.endDate ?? classItem.endDate.toISOString()
            );
        }

        const updatedClass = await this.prisma.class.update({
            where: { publicId },
            data: {
                code: dto.code,
                name: dto.name,
                lecturerId: dto.lecturerId,
                maxStudents: dto.maxStudents,
                startDate: dto.startDate ? new Date(dto.startDate) : undefined,
                endDate: dto.endDate ? new Date(dto.endDate) : undefined,
                status: dto.status
            },
            select: this.classSelect()
        });

        await this.auditLogsService.create({
            actorId: actor.id,
            action: AuditAction.UPDATE,
            module: 'classes',
            targetType: 'Class',
            targetId: updatedClass.id,
            targetPublicId: updatedClass.publicId,
            oldValue: {
                code: classItem.code,
                name: classItem.name,
                lecturerId: classItem.lecturerId,
                maxStudents: classItem.maxStudents,
                startDate: classItem.startDate.toISOString(),
                endDate: classItem.endDate.toISOString(),
                status: classItem.status
            },
            newValue: {
                code: updatedClass.code,
                name: updatedClass.name,
                maxStudents: updatedClass.maxStudents,
                startDate: updatedClass.startDate.toISOString(),
                endDate: updatedClass.endDate.toISOString(),
                status: updatedClass.status
            }
        });

        return this.formatClass(updatedClass);
    }

    async assignLecturer(publicId: string, dto: AssignLecturerDto, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const classItem = await this.prisma.class.findUnique({
            where: { publicId },
            select: {
                id: true,
                publicId: true,
                lecturerId: true,
                departmentHeadId: true
            }
        });

        if (!classItem) {
            throw new NotFoundException('Không tìm thấy lớp học');
        }

        this.ensureCanManageClass(actor, classItem);
        await this.ensureLecturer(dto.lecturerId);

        const updatedClass = await this.prisma.class.update({
            where: { publicId },
            data: {
                lecturerId: dto.lecturerId
            },
            select: this.classSelect()
        });

        await this.auditLogsService.create({
            actorId: actor.id,
            action: AuditAction.ASSIGN,
            module: 'classes',
            targetType: 'Class',
            targetId: updatedClass.id,
            targetPublicId: updatedClass.publicId,
            oldValue: {
                lecturerId: classItem.lecturerId
            },
            newValue: {
                lecturerId: dto.lecturerId
            }
        });

        return this.formatClass(updatedClass);
    }

    async updateStatus(publicId: string, status: ClassStatus, actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        const classItem = await this.findClassRecordOrThrow(publicId);

        this.ensureCanManageClass(actor, classItem);

        if (status === ClassStatus.OPEN && !classItem.lecturerId) {
            throw new BadRequestException('Phải gán giảng viên trước khi mở đăng ký lớp');
        }

        const updatedClass = await this.prisma.class.update({
            where: { publicId },
            data: { status },
            select: this.classSelect()
        });

        await this.auditLogsService.create({
            actorId: actor.id,
            action: AuditAction.STATUS_CHANGE,
            module: 'classes',
            targetType: 'Class',
            targetId: updatedClass.id,
            targetPublicId: updatedClass.publicId,
            oldValue: {
                status: classItem.status
            },
            newValue: {
                status: updatedClass.status
            }
        });

        return this.formatClass(updatedClass);
    }

    private async ensureClassCodeAvailable(code: string, exceptPublicId?: string) {
        const duplicate = await this.prisma.class.findFirst({
            where: {
                code,
                ...(exceptPublicId ? { publicId: { not: exceptPublicId } } : {})
            }
        });

        if (duplicate) {
            throw new ConflictException('Mã lớp học đã tồn tại');
        }
    }

    private ensureCanManageClass(actor: { id: number; role: { code: string } }, classItem: { departmentHeadId: number }) {
        if (actor.role.code === 'ADMIN') {
            return;
        }

        if (actor.role.code !== 'DEPARTMENT_HEAD' || actor.id !== classItem.departmentHeadId) {
            throw new ForbiddenException('Chỉ trưởng bộ môn quản lý lớp này mới được thao tác');
        }
    }

    private async ensureLecturer(lecturerId: number) {
        const lecturer = await this.prisma.user.findFirst({
            where: {
                id: lecturerId,
                deletedAt: null,
                role: {
                    code: {
                        in: ['LECTURER', 'DEPARTMENT_HEAD']
                    }
                }
            },
            select: { id: true }
        });

        if (!lecturer) {
            throw new BadRequestException('Giảng viên không hợp lệ');
        }
    }

    private ensureValidClassDates(startDate: string, endDate: string) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            throw new BadRequestException('Thời gian lớp học không hợp lệ');
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

        if (!user.role) {
            throw new ForbiddenException('Nguoi dung chua duoc gan vai tro');
        }

        return { ...user, role: user.role };
    }

    private async findClassRecordOrThrow(publicId: string) {
        const classItem = await this.prisma.class.findUnique({
            where: { publicId },
            select: {
                id: true,
                publicId: true,
                status: true,
                maxStudents: true,
                lecturerId: true,
                departmentHeadId: true
            }
        });

        if (!classItem) {
            throw new NotFoundException('Không tìm thấy lớp học');
        }

        return classItem;
    }

    private classSelect(includeEnrollments = false) {
        return {
            id: true,
            publicId: true,
            courseId: true,
            code: true,
            name: true,
            lecturerId: true,
            departmentHeadId: true,
            maxStudents: true,
            startDate: true,
            endDate: true,
            status: true,
            course: {
                select: {
                    publicId: true,
                    code: true,
                    name: true,
                    credits: true
                }
            },
            lecturer: {
                select: {
                    publicId: true,
                    code: true,
                    fullName: true,
                    email: true
                }
            },
            departmentHead: {
                select: {
                    publicId: true,
                    code: true,
                    fullName: true,
                    email: true
                }
            },
            enrollments: includeEnrollments
                ? {
                      orderBy: {
                          enrolledAt: 'desc' as const
                      },
                      select: this.enrollmentSelect()
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
        };
    }

    private enrollmentSelect() {
        return {
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
            },
            class: {
                select: {
                    publicId: true,
                    code: true,
                    name: true
                }
            }
        };
    }

    private formatClass(classItem: any) {
        const { id, _count, ...rest } = classItem;
        const enrolledCount = _count?.enrollments ?? 0;

        return {
            ...rest,
            enrolledCount,
            availableSlots: Math.max((classItem.maxStudents ?? 0) - enrolledCount, 0)
        };
    }
}
