import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ClassStatus, EnrollmentStatus } from '@prisma/client';

import { AuditLogsService } from '~/modules/audit-logs/audit-logs.service';
import { NotificationsService } from '~/modules/notifications/notifications.service';
import { PrismaService } from '~/prisma/prisma.service';

@Injectable()
export class EnrollmentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogsService: AuditLogsService,
        private readonly notificationsService: NotificationsService
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

    async summary() {
        const [totalStudents, enrolledStudents, totalEnrollments, pendingEnrollments, droppedEnrollments] = await Promise.all([
            this.prisma.user.count({
                where: {
                    deletedAt: null,
                    role: {
                        code: 'STUDENT'
                    }
                }
            }),
            this.prisma.enrollment.findMany({
                where: {
                    status: EnrollmentStatus.APPROVED,
                    student: {
                        deletedAt: null,
                        role: {
                            code: 'STUDENT'
                        }
                    }
                },
                distinct: ['studentId'],
                select: {
                    studentId: true
                }
            }),
            this.prisma.enrollment.count({
                where: {
                    status: EnrollmentStatus.APPROVED
                }
            }),
            this.prisma.enrollment.count({
                where: {
                    status: EnrollmentStatus.PENDING
                }
            }),
            this.prisma.enrollment.count({
                where: {
                    status: EnrollmentStatus.DROPPED
                }
            })
        ]);
        const enrolledStudentCount = enrolledStudents.length;
        const notEnrolledStudents = Math.max(totalStudents - enrolledStudentCount, 0);

        return {
            totalStudents,
            enrolledStudents: enrolledStudentCount,
            notEnrolledStudents,
            totalEnrollments,
            pendingEnrollments,
            droppedEnrollments
        };
    }

    async enroll(classPublicId: string, studentPublicId: string) {
        const [classItem, student] = await Promise.all([
            this.findClassRecordOrThrow(classPublicId),
            this.findStudentByPublicIdOrThrow(studentPublicId)
        ]);

        if (classItem.status !== ClassStatus.OPEN_REGISTRATION) {
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

        const existingCourseEnrollment = await this.prisma.enrollment.findFirst({
            where: {
                studentId: student.id,
                status: {
                    in: [EnrollmentStatus.APPROVED, EnrollmentStatus.PENDING]
                },
                class: {
                    courseId: classItem.courseId
                },
                NOT: {
                    classId: classItem.id
                }
            },
            select: {
                class: {
                    select: {
                        code: true,
                        name: true
                    }
                }
            }
        });

        if (existingCourseEnrollment) {
            throw new BadRequestException(
                `Sinh vien da dang ky lop ${existingCourseEnrollment.class.code} - ${existingCourseEnrollment.class.name} cua mon nay`
            );
        }

        return this.prisma.$transaction(async (tx) => {
            const enrollment = await tx.enrollment.upsert({
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

            await this.auditLogsService.create(
                {
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
                },
                tx
            );

            if (classItem.autoCloseWhenFull && approvedCount + 1 >= classItem.maxStudents) {
                await tx.class.update({
                    where: { id: classItem.id },
                    data: {
                        status: ClassStatus.FULL,
                        registrationClosedAt: new Date()
                    }
                });
            }

            await this.notificationsService.createMany(
                {
                    recipientIds: [student.id],
                    actorId: student.id,
                    type: 'ENROLLMENT_APPROVED',
                    title: `Đăng ký thành công lớp ${classItem.code}`,
                    message: `Bạn đã đăng ký thành công lớp ${classItem.name}.`,
                    data: {
                        classPublicId: classItem.publicId,
                        status: enrollment.status
                    }
                },
                tx
            );
            await this.notificationsService.createMany(
                {
                    recipientIds: [classItem.lecturerId, classItem.departmentHeadId].filter(
                        (id): id is number => typeof id === 'number'
                    ),
                    actorId: student.id,
                    type: 'CLASS_STUDENT_ENROLLED',
                    title: `Sinh viên mới đăng ký lớp ${classItem.code}`,
                    message: `${student.fullName} đã đăng ký lớp ${classItem.name}.`,
                    data: {
                        classPublicId: classItem.publicId,
                        studentPublicId: student.publicId,
                        status: enrollment.status
                    }
                },
                tx
            );

            return enrollment;
        });
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

        if (classItem.status === ClassStatus.COMPLETED) {
            throw new BadRequestException('Lớp đã hoàn thành nên không thể hủy đăng ký');
        }

        if (!classItem.allowStudentDrop) {
            throw new BadRequestException('Lớp không cho phép sinh viên hủy đăng ký');
        }

        return this.prisma.$transaction(async (tx) => {
            const droppedEnrollment = await tx.enrollment.update({
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

            await this.auditLogsService.create(
                {
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
                },
                tx
            );

            const approvedCountAfterDrop = await tx.enrollment.count({
                where: {
                    classId: classItem.id,
                    status: EnrollmentStatus.APPROVED
                }
            });

            if (classItem.status === ClassStatus.FULL && approvedCountAfterDrop < classItem.maxStudents) {
                await tx.class.update({
                    where: { id: classItem.id },
                    data: {
                        status: ClassStatus.OPEN_REGISTRATION,
                        registrationClosedAt: null
                    }
                });
            }

            return droppedEnrollment;
        });
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
                code: true,
                name: true,
                status: true,
                maxStudents: true,
                courseId: true,
                autoCloseWhenFull: true,
                allowStudentDrop: true,
                lecturerId: true,
                departmentHeadId: true
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
