import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, ExamAttemptStatus } from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';

type Actor = Awaited<ReturnType<CourseProgressService['findUserByPublicIdOrThrow']>>;
type ClassRecord = Awaited<ReturnType<CourseProgressService['findClassRecordOrThrow']>>;

@Injectable()
export class CourseProgressService {
    constructor(private readonly prisma: PrismaService) {}

    async myProgress(actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        if (actor.role?.code !== 'STUDENT') {
            throw new ForbiddenException('Chỉ có sinh viên mới xem được tiến độ học tập của mình');
        }

        const enrollments = await this.prisma.enrollment.findMany({
            where: {
                studentId: actor.id,
                status: EnrollmentStatus.APPROVED
            },
            orderBy: { enrolledAt: 'desc' },
            select: {
                class: {
                    select: this.classSelect()
                }
            }
        });

        const items = await Promise.all(
            enrollments.map(async (enrollment) => this.buildStudentClassProgress(enrollment.class, actor.id))
        );

        return { items };
    }

    async studentProgress(classPublicId: string, studentPublicId: string, actorPublicId: string) {
        const [actor, classItem, student] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId),
            this.findUserByPublicIdOrThrow(studentPublicId)
        ]);

        if (student.role?.code !== 'STUDENT') throw new ForbiddenException('Người dùng không phải là sinh viên');
        this.ensureCanViewStudentProgress(actor, classItem, student.id);
        await this.ensureStudentEnrolled(classItem.id, student.id);

        return this.buildStudentClassProgress(classItem, student.id);
    }

    async classProgress(classPublicId: string, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        this.ensureCanManageClass(actor, classItem);

        const enrollments = await this.prisma.enrollment.findMany({
            where: {
                classId: classItem.id,
                status: EnrollmentStatus.APPROVED
            },
            orderBy: {
                enrolledAt: 'desc'
            },
            select: {
                student: {
                    select: {
                        id: true,
                        publicId: true,
                        code: true,
                        fullName: true,
                        email: true
                    }
                }
            }
        });

        const students = await Promise.all(
            enrollments.map(async (enrollment) => ({
                student: {
                    publicId: enrollment.student.publicId,
                    code: enrollment.student.code,
                    fullName: enrollment.student.fullName,
                    email: enrollment.student.email
                },
                ...(await this.buildStudentClassProgress(classItem, enrollment.student.id))
            }))
        );

        const lessonCompletionAverage =
            students.length > 0
                ? Math.round(
                      students.reduce((sum, item) => sum + item.lessonProgress.completionRate, 0) / students.length
                  )
                : 0;
        const examCompletionAverage =
            students.length > 0
                ? Math.round(
                      students.reduce((sum, item) => sum + item.examProgress.completionRate, 0) / students.length
                  )
                : 0;

        return {
            class: this.formatClass(classItem),
            summary: {
                studentCount: students.length,
                lessonCompletionAverage,
                examCompletionAverage
            },
            students
        };
    }

    private async buildStudentClassProgress(classItem: ClassRecord, studentId: number) {
        const [lessonCount, completedLessonCount, examCount, submittedExamCount, grade] = await Promise.all([
            this.prisma.lesson.count({
                where: {
                    classId: classItem.id,
                    isPublished: true
                }
            }),
            this.prisma.lessonProgress.count({
                where: {
                    studentId,
                    completedAt: { not: null },
                    lesson: {
                        classId: classItem.id,
                        isPublished: true
                    }
                }
            }),
            this.prisma.exam.count({
                where: {
                    classId: classItem.id,
                    isPublished: true
                }
            }),
            this.prisma.exam.count({
                where: {
                    classId: classItem.id,
                    isPublished: true,
                    attempts: {
                        some: {
                            studentId,
                            status: ExamAttemptStatus.SUBMITTED
                        }
                    }
                }
            }),
            this.prisma.grade.findUnique({
                where: {
                    classId_studentId: {
                        classId: classItem.id,
                        studentId
                    }
                },
                select: {
                    publicId: true,
                    finalScore: true,
                    passScore: true,
                    status: true,
                    calculatedAt: true
                }
            })
        ]);

        const lessonCompletionRate = lessonCount > 0 ? Math.round((completedLessonCount / lessonCount) * 100) : 0;
        const examCompletionRate = examCount > 0 ? Math.round((submittedExamCount / examCount) * 100) : 0;
        const overallRate = Math.round((lessonCompletionRate + examCompletionRate) / (examCount > 0 ? 2 : 1));

        return {
            class: this.formatClass(classItem),
            lessonProgress: {
                total: lessonCount,
                completed: completedLessonCount,
                completionRate: lessonCompletionRate
            },
            examProgress: {
                total: examCount,
                submitted: submittedExamCount,
                completionRate: examCompletionRate
            },
            overallRate,
            grade
        };
    }

    private async ensureStudentEnrolled(classId: number, studentId: number) {
        const enrollment = await this.prisma.enrollment.findFirst({
            where: {
                classId,
                studentId,
                status: EnrollmentStatus.APPROVED
            },
            select: { id: true }
        });

        if (!enrollment) throw new ForbiddenException('Sinh viên chưa tham gia lớp này');
    }

    private ensureCanViewStudentProgress(actor: Actor, classItem: ClassRecord, studentId: number) {
        if (actor.role?.code === 'STUDENT') {
            if (actor.id !== studentId) throw new ForbiddenException('Sinh viên chỉ được xem tiến độ của mình');
            return;
        }

        this.ensureCanManageClass(actor, classItem);
    }

    private ensureCanManageClass(actor: Actor, classItem: ClassRecord) {
        if (['ADMIN', 'TRAINING_OFFICER', 'PRINCIPAL'].includes(actor.role?.code ?? '')) return;
        if (actor.role?.code === 'DEPARTMENT_HEAD' && actor.id === classItem.departmentHeadId) return;
        if (actor.role?.code === 'LECTURER' && actor.id === classItem.lecturerId) return;
        throw new ForbiddenException('Bạn không có quyền xem tiến độ lớp này');
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
                role: {
                    select: {
                        code: true
                    }
                }
            }
        });

        if (!user) throw new NotFoundException('Không tìm thấy người dùng');
        return user;
    }

    private async findClassRecordOrThrow(publicId: string) {
        const classItem = await this.prisma.class.findUnique({
            where: { publicId },
            select: this.classSelect()
        });

        if (!classItem) throw new NotFoundException('Không tìm thấy lớp học');
        return classItem;
    }

    private classSelect() {
        return {
            id: true,
            publicId: true,
            code: true,
            name: true,
            status: true,
            lecturerId: true,
            departmentHeadId: true,
            course: {
                select: {
                    publicId: true,
                    code: true,
                    name: true,
                    credits: true
                }
            }
        };
    }

    private formatClass(classItem: ClassRecord) {
        return {
            publicId: classItem.publicId,
            code: classItem.code,
            name: classItem.name,
            status: classItem.status,
            course: classItem.course
        };
    }
}
