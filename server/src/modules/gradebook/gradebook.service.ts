import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExamAttemptStatus, GradeStatus } from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';

type Actor = Awaited<ReturnType<GradebookService['findUserByPublicIdOrThrow']>>;
type ClassAccessRecord = Awaited<ReturnType<GradebookService['findClassRecordOrThrow']>>;

@Injectable()
export class GradebookService {
    constructor(private readonly prisma: PrismaService) {}

    async classGradebook(classPublicId: string, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        this.ensureCanManageClass(actor, classItem);

        const enrollments = await this.prisma.enrollment.findMany({
            where: {
                classId: classItem.id,
                status: 'APPROVED'
            },
            orderBy: { enrolledAt: 'desc' },
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

        const rows = await Promise.all(
            enrollments.map(async (enrollment) => ({
                student: {
                    publicId: enrollment.student.publicId,
                    code: enrollment.student.code,
                    fullName: enrollment.student.fullName,
                    email: enrollment.student.email
                },
                ...(await this.calculateStudentClassGrade(classItem.id, enrollment.student.id))
            }))
        );

        return {
            class: {
                publicId: classItem.publicId,
                code: classItem.code,
                name: classItem.name
            },
            items: rows
        };
    }

    async studentClassGrades(classPublicId: string, studentPublicId: string, actorPublicId: string) {
        const [actor, classItem, student] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId),
            this.findUserByPublicIdOrThrow(studentPublicId)
        ]);
        if (!this.canManageClass(actor, classItem) && actor.id !== student.id) {
            throw new ForbiddenException('Ban khong co quyen xem diem cua sinh vien nay');
        }

        return this.calculateStudentClassGrade(classItem.id, student.id);
    }

    async myGrades(actorPublicId: string) {
        const actor = await this.findUserByPublicIdOrThrow(actorPublicId);
        if (actor.role.code !== 'STUDENT') {
            throw new ForbiddenException('Chi sinh vien moi co bang diem ca nhan');
        }

        const enrollments = await this.prisma.enrollment.findMany({
            where: {
                studentId: actor.id,
                status: {
                    not: 'DROPPED'
                }
            },
            orderBy: { enrolledAt: 'desc' },
            select: {
                class: {
                    select: {
                        id: true,
                        publicId: true,
                        code: true,
                        name: true,
                        course: {
                            select: {
                                publicId: true,
                                code: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        const rows = await Promise.all(
            enrollments.map(async (enrollment) => ({
                class: {
                    publicId: enrollment.class.publicId,
                    code: enrollment.class.code,
                    name: enrollment.class.name,
                    course: enrollment.class.course
                },
                ...(await this.calculateStudentClassGrade(enrollment.class.id, actor.id))
            }))
        );

        return { items: rows };
    }

    async recalculateClass(classPublicId: string, actorPublicId: string) {
        const [actor, classItem] = await Promise.all([
            this.findUserByPublicIdOrThrow(actorPublicId),
            this.findClassRecordOrThrow(classPublicId)
        ]);
        this.ensureCanManageClass(actor, classItem);

        const enrollments = await this.prisma.enrollment.findMany({
            where: {
                classId: classItem.id,
                status: 'APPROVED'
            },
            select: {
                studentId: true
            }
        });

        const grades = await Promise.all(
            enrollments.map(async (enrollment) => this.upsertStudentGrade(classItem.id, enrollment.studentId))
        );

        return {
            classPublicId,
            updatedCount: grades.length,
            items: grades
        };
    }

    private async upsertStudentGrade(classId: number, studentId: number) {
        const calculated = await this.calculateStudentClassGrade(classId, studentId);
        const grade = await this.prisma.grade.upsert({
            where: {
                classId_studentId: {
                    classId,
                    studentId
                }
            },
            update: {
                finalScore: calculated.finalScore,
                passScore: calculated.passScore,
                status: calculated.status,
                calculatedAt: new Date()
            },
            create: {
                classId,
                studentId,
                finalScore: calculated.finalScore,
                passScore: calculated.passScore,
                status: calculated.status
            },
            select: {
                publicId: true,
                finalScore: true,
                passScore: true,
                status: true,
                calculatedAt: true
            }
        });

        return {
            ...calculated,
            gradePublicId: grade.publicId,
            calculatedAt: grade.calculatedAt
        };
    }

    private async calculateStudentClassGrade(classId: number, studentId: number) {
        const exams = await this.prisma.exam.findMany({
            where: {
                classId,
                isPublished: true
            },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                publicId: true,
                title: true,
                passScore: true,
                attempts: {
                    where: {
                        studentId,
                        status: ExamAttemptStatus.SUBMITTED,
                        score: {
                            not: null
                        }
                    },
                    orderBy: { submittedAt: 'desc' },
                    select: {
                        publicId: true,
                        score: true,
                        submittedAt: true
                    }
                }
            }
        });

        const examRows = exams.map((exam) => {
            const bestAttempt = exam.attempts.reduce<{ publicId: string; score: number; submittedAt: Date | null } | null>(
                (best, attempt) => {
                    if (attempt.score === null) return best;
                    if (!best || attempt.score > best.score) {
                        return {
                            publicId: attempt.publicId,
                            score: attempt.score,
                            submittedAt: attempt.submittedAt
                        };
                    }
                    return best;
                },
                null
            );

            return {
                publicId: exam.publicId,
                title: exam.title,
                passScore: exam.passScore,
                bestAttempt
            };
        });

        const scored = examRows.filter((exam) => exam.bestAttempt);
        const finalScore =
            scored.length > 0
                ? Number((scored.reduce((total, exam) => total + (exam.bestAttempt?.score ?? 0), 0) / scored.length).toFixed(2))
                : 0;
        const passScore = exams.length > 0 ? Number((exams.reduce((total, exam) => total + exam.passScore, 0) / exams.length).toFixed(2)) : 5;
        const status = finalScore >= passScore ? GradeStatus.PASS : GradeStatus.FAIL;

        return {
            finalScore,
            passScore,
            status,
            exams: examRows
        };
    }

    private canManageClass(actor: Actor, classItem: ClassAccessRecord) {
        if (['ADMIN', 'TRAINING_OFFICER', 'PRINCIPAL'].includes(actor.role.code)) return true;
        if (actor.role.code === 'DEPARTMENT_HEAD' && actor.id === classItem.departmentHeadId) return true;
        if (actor.role.code === 'LECTURER' && actor.id === classItem.lecturerId) return true;
        return false;
    }

    private ensureCanManageClass(actor: Actor, classItem: ClassAccessRecord) {
        if (!this.canManageClass(actor, classItem)) {
            throw new ForbiddenException('Ban khong co quyen xem bang diem lop nay');
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
            select: {
                id: true,
                publicId: true,
                code: true,
                name: true,
                lecturerId: true,
                departmentHeadId: true
            }
        });
        if (!classItem) throw new NotFoundException('Khong tim thay lop hoc');
        return classItem;
    }
}
