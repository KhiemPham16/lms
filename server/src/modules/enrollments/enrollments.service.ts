import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ClassStatus, EnrollmentStatus } from '@prisma/client';

import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { PrismaService } from '~/prisma/prisma.service';

@Injectable()
export class EnrollmentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService
    ) {}

    async findMyEnrollments(studentPublicId: string) {
        const student = await this.findStudentByPublicIdOrThrow(studentPublicId);

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

    async enroll(classPublicId: string, studentPublicId: string) {
        const [classItem, student] = await Promise.all([
            this.findClassRecordOrThrow(classPublicId),
            this.findStudentByPublicIdOrThrow(studentPublicId)
        ]);

        if (classItem.status !== ClassStatus.OPEN) {
            throw new BadRequestException('Lớp học chưa mở đăng ký');
        }

        const approvedCount = await this.prisma.enrollment.count({
            where: {
                classId: classItem.id,
                status: EnrollmentStatus.APPROVED
            }
        });

        if (approvedCount >= classItem.maxStudents) {
            throw new BadRequestException('Lớp học đã đủ số lượng sinh viên');
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
            this.findStudentByPublicIdOrThrow(studentPublicId)
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
            throw new NotFoundException('Sinh viên chưa đăng ký lớp này');
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

    private async findStudentByPublicIdOrThrow(publicId: string) {
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

        if (user.role?.code !== 'STUDENT') {
            throw new ForbiddenException('Chỉ sinh viên mới được thao tác đăng ký lớp');
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
            throw new NotFoundException('Không tìm thấy lớp học');
        }

        return classItem;
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
}
