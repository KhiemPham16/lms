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
            select: { id: true, status: true }
        });

        if (!course) {
            throw new NotFoundException('Khong tim thay mon hoc');
        }

        const classReadyStatuses: CourseStatus[] = [CourseStatus.PRINCIPAL_APPROVED, CourseStatus.ACTIVE];

        if (!classReadyStatuses.includes(course.status)) {
            throw new BadRequestException('Chi co the tao lop cho mon hoc da duoc Hieu truong duyet');
        }

        await this.ensureClassCodeAvailable(dto.code);
        await this.ensureLecturer(dto.lecturerId);
        this.ensureValidClassDates(dto.startDate, dto.endDate);

        const createdClass = await this.prisma.class.create({
            data: {
                code: dto.code,
                name: dto.name,
                courseId: course.id,
                lecturerId: dto.lecturerId,
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
            throw new NotFoundException('Khong tim thay lop hoc');
        }

        return this.formatClass(classItem);
    }

    async findMyEnrollments(studentPublicId: string) {
        const student = await this.findUserByPublicIdOrThrow(studentPublicId);

        if (student.role.code !== 'STUDENT') {
            throw new ForbiddenException('Chi sinh vien moi co danh sach lop da dang ky');
        }

        return this.prisma.enrollment.findMany({
            where: {
                studentId: student.id,
                status: {
                    not: EnrollmentStatus.DROPPED
                }
            },
            orderBy: {
                enrolledAt: 'desc'
            },
            select: {
                id: true,
                status: true,
                enrolledAt: true,
                class: {
                    select: {
                        publicId: true,
                        code: true,
                        name: true,
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
                        }
                    }
                }
            }
        });
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
            throw new NotFoundException('Khong tim thay lop hoc');
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
                lecturerId: true
            }
        });

        if (!classItem) {
            throw new NotFoundException('Khong tim thay lop hoc');
        }

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

    async enroll(classPublicId: string, studentPublicId: string) {
        const [classItem, student] = await Promise.all([
            this.findClassRecordOrThrow(classPublicId),
            this.findUserByPublicIdOrThrow(studentPublicId)
        ]);

        if (student.role.code !== 'STUDENT') {
            throw new ForbiddenException('Chi sinh vien moi duoc dang ky lop');
        }

        if (classItem.status !== ClassStatus.OPEN) {
            throw new BadRequestException('Lop hoc chua mo dang ky');
        }

        const approvedCount = await this.prisma.enrollment.count({
            where: {
                classId: classItem.id,
                status: EnrollmentStatus.APPROVED
            }
        });

        if (approvedCount >= classItem.maxStudents) {
            throw new BadRequestException('Lop hoc da du so luong sinh vien');
        }

        const enrollment = await this.prisma.enrollment.upsert({
            where: {
                studentId_classId: {
                    studentId: student.id,
                    classId: classItem.id
                }
            },
            update: {
                status: EnrollmentStatus.APPROVED,
                enrolledAt: new Date()
            },
            create: {
                studentId: student.id,
                classId: classItem.id,
                status: EnrollmentStatus.APPROVED
            },
            select: this.enrollmentSelect()
        });

        await this.auditLogsService.create({
            actorId: student.id,
            action: AuditAction.ENROLL,
            module: 'enrollments',
            targetType: 'Enrollment',
            targetId: enrollment.id,
            newValue: {
                classId: classItem.id,
                classPublicId: classItem.publicId,
                status: enrollment.status
            }
        });

        return enrollment;
    }

    async drop(classPublicId: string, studentPublicId: string) {
        const [classItem, student] = await Promise.all([
            this.findClassRecordOrThrow(classPublicId),
            this.findUserByPublicIdOrThrow(studentPublicId)
        ]);

        const enrollment = await this.prisma.enrollment.findUnique({
            where: {
                studentId_classId: {
                    studentId: student.id,
                    classId: classItem.id
                }
            }
        });

        if (!enrollment || enrollment.status === EnrollmentStatus.DROPPED) {
            throw new NotFoundException('Sinh vien chua dang ky lop nay');
        }

        const droppedEnrollment = await this.prisma.enrollment.update({
            where: {
                studentId_classId: {
                    studentId: student.id,
                    classId: classItem.id
                }
            },
            data: {
                status: EnrollmentStatus.DROPPED
            },
            select: this.enrollmentSelect()
        });

        await this.auditLogsService.create({
            actorId: student.id,
            action: AuditAction.DROP,
            module: 'enrollments',
            targetType: 'Enrollment',
            targetId: droppedEnrollment.id,
            oldValue: {
                status: enrollment.status
            },
            newValue: {
                classId: classItem.id,
                classPublicId: classItem.publicId,
                status: droppedEnrollment.status
            }
        });

        return droppedEnrollment;
    }

    private async ensureClassCodeAvailable(code: string, exceptPublicId?: string) {
        const duplicate = await this.prisma.class.findFirst({
            where: {
                code,
                ...(exceptPublicId ? { publicId: { not: exceptPublicId } } : {})
            }
        });

        if (duplicate) {
            throw new ConflictException('Ma lop hoc da ton tai');
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
            throw new BadRequestException('Giang vien khong hop le');
        }
    }

    private ensureValidClassDates(startDate: string, endDate: string) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            throw new BadRequestException('Thoi gian lop hoc khong hop le');
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
            throw new NotFoundException('Khong tim thay nguoi dung');
        }

        return user;
    }

    private async findClassRecordOrThrow(publicId: string) {
        const classItem = await this.prisma.class.findUnique({
            where: { publicId },
            select: {
                id: true,
                publicId: true,
                status: true,
                maxStudents: true
            }
        });

        if (!classItem) {
            throw new NotFoundException('Khong tim thay lop hoc');
        }

        return classItem;
    }

    private classSelect(includeEnrollments = false) {
        return {
            id: true,
            publicId: true,
            code: true,
            name: true,
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
