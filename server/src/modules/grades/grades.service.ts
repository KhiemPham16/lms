import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
    AssessmentCategory,
    AttemptStatus,
    AuditAction,
    EnrollmentStatus,
    ScorePolicy,
    UserRole
} from '@prisma/client';
import { PrismaService } from '~/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LearningService } from '../learning/learning.service';
import { TranscriptQueryDto } from './dto/transcript-query.dto';

type AttemptSnapshot = {
    studentId: number;
    attemptNumber: number;
    status: AttemptStatus;
    score: number | null;
};

type AssessmentSnapshot = {
    publicId: string;
    title: string;
    category: AssessmentCategory;
    scorePolicy: ScorePolicy;
    closeAt: Date;
    maxPoints: number;
    attempts: AttemptSnapshot[];
};

type CategoryWeights = Record<AssessmentCategory, number>;

@Injectable()
export class GradesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly learning: LearningService
    ) {}

    async classGradebook(classPublicId: string, actorPublicId: string) {
        await this.requireGradebookAccess(classPublicId, actorPublicId);
        return this.buildClassGradebook(classPublicId);
    }

    async finalizeClass(classPublicId: string, actorPublicId: string) {
        await this.requireGradebookAccess(classPublicId, actorPublicId);
        await this.learning.autoSubmitExpiredAttempts(classPublicId);
        const gradebook = await this.buildClassGradebook(classPublicId);
        if (!gradebook.canFinalize) {
            throw new BadRequestException({
                message: 'Chưa thể chốt điểm lớp học',
                blockers: gradebook.blockers
            });
        }

        await this.prisma.$transaction(async (tx) => {
            for (const student of gradebook.students) {
                await tx.enrollment.update({
                    where: { id: student.enrollmentId },
                    data: { finalScore: student.calculatedScore, passed: student.passed }
                });
                await tx.notification.create({
                    data: {
                        recipientId: student.studentId,
                        type: 'FINAL_GRADE_PUBLISHED',
                        title: 'Đã công bố điểm tổng kết',
                        message: `Điểm tổng kết lớp ${gradebook.class.code} của bạn là ${student.calculatedScore.toFixed(2)} (${student.passed ? 'Đạt' : 'Không đạt'}).`,
                        data: {
                            classPublicId: gradebook.class.publicId,
                            finalScore: student.calculatedScore,
                            passed: student.passed
                        }
                    }
                });
            }
        });

        await this.audit.record({
            actorPublicId,
            action: AuditAction.UPDATE,
            module: 'so-diem',
            targetType: 'Class',
            targetPublicId: classPublicId,
            newValue: { finalizedStudents: gradebook.students.length }
        });

        return {
            message: 'Đã chốt và công bố điểm tổng kết',
            finalizedStudents: gradebook.students.length,
            gradebook: { ...gradebook, canFinalize: true, blockers: [] }
        };
    }

    async myCourseGrades(studentPublicId: string) {
        const student = await this.requireStudent(studentPublicId);
        const enrollments = await this.prisma.enrollment.findMany({
            where: { studentId: student.id },
            orderBy: [{ class: { createdAt: 'desc' } }, { class: { code: 'asc' } }],
            include: {
                class: {
                    include: {
                        subject: true,
                        assessments: {
                            where: { isPublished: true },
                            orderBy: { openAt: 'asc' },
                            include: {
                                questions: { select: { points: true } },
                                attempts: { where: { studentId: student.id } }
                            }
                        }
                    }
                }
            }
        });

        return enrollments.map((enrollment) => {
            const weights = this.subjectWeights(enrollment.class.subject);
            const assessments = this.assessmentSnapshots(enrollment.class.assessments);
            const calculated = this.calculateStudentGrade(assessments, weights, Number(enrollment.class.subject.passScore));
            return {
                enrollmentPublicId: enrollment.publicId,
                enrollmentStatus: enrollment.status,
                class: {
                    publicId: enrollment.class.publicId,
                    code: enrollment.class.code,
                    name: enrollment.class.name,
                    status: enrollment.class.status
                },
                subject: {
                    publicId: enrollment.class.subject.publicId,
                    code: enrollment.class.subject.code,
                    name: enrollment.class.subject.name,
                    credits: enrollment.class.subject.credits,
                    passScore: Number(enrollment.class.subject.passScore)
                },
                categoryScores: calculated.categoryScores,
                currentScore: calculated.score,
                finalScore: enrollment.finalScore === null ? null : Number(enrollment.finalScore),
                passed: enrollment.passed,
                isFinalized: enrollment.finalScore !== null,
                finalizedAt: enrollment.finalScore === null ? null : enrollment.updatedAt
            };
        });
    }

    async myTranscript(studentPublicId: string, _query: TranscriptQueryDto) {
        void _query;
        const student = await this.requireStudent(studentPublicId);
        const enrollments = await this.prisma.enrollment.findMany({
            where: { studentId: student.id, finalScore: { not: null } },
            orderBy: [{ class: { createdAt: 'asc' } }, { class: { code: 'asc' } }],
            include: { class: { include: { subject: true } } }
        });

        const courses = enrollments.map((enrollment) => ({
                classPublicId: enrollment.class.publicId,
                classCode: enrollment.class.code,
                subjectPublicId: enrollment.class.subject.publicId,
                subjectCode: enrollment.class.subject.code,
                subjectName: enrollment.class.subject.name,
                credits: enrollment.class.subject.credits,
                finalScore: Number(enrollment.finalScore),
                passed: enrollment.passed === true
            }));

        return {
            student: {
                publicId: student.publicId,
                code: student.code,
                fullName: student.fullName
            },
            courses,
            cumulative: this.transcriptSummary(courses)
        };
    }

    private async buildClassGradebook(classPublicId: string) {
        const courseClass = await this.prisma.class.findUnique({
            where: { publicId: classPublicId },
            include: {
                subject: true,
                enrollments: {
                    where: { status: EnrollmentStatus.ACTIVE },
                    orderBy: { student: { code: 'asc' } },
                    include: { student: { select: { id: true, publicId: true, code: true, fullName: true } } }
                },
                assessments: {
                    where: { isPublished: true },
                    orderBy: { openAt: 'asc' },
                    include: { questions: { select: { points: true } }, attempts: true }
                }
            }
        });
        if (!courseClass) throw new NotFoundException('Không tìm thấy lớp học');

        const weights = this.subjectWeights(courseClass.subject);
        const activeStudentIds = new Set(courseClass.enrollments.map((enrollment) => enrollment.student.id));
        const allAssessments = this.assessmentSnapshots(courseClass.assessments).map((assessment) => ({
            ...assessment,
            attempts: assessment.attempts.filter((attempt) => activeStudentIds.has(attempt.studentId))
        }));
        const blockers = this.finalizationBlockers(allAssessments, weights);
        if (!courseClass.enrollments.length) blockers.push('Lớp chưa có sinh viên đang học');
        const students = courseClass.enrollments.map((enrollment) => {
            const assessments = allAssessments.map((assessment) => ({
                ...assessment,
                attempts: assessment.attempts.filter((attempt) => attempt.studentId === enrollment.student.id)
            }));
            const calculated = this.calculateStudentGrade(
                assessments,
                weights,
                Number(courseClass.subject.passScore)
            );
            return {
                enrollmentId: enrollment.id,
                enrollmentPublicId: enrollment.publicId,
                studentId: enrollment.student.id,
                student: {
                    publicId: enrollment.student.publicId,
                    code: enrollment.student.code,
                    fullName: enrollment.student.fullName
                },
                categoryScores: calculated.categoryScores,
                calculatedScore: calculated.score,
                passed: calculated.passed,
                savedFinalScore: enrollment.finalScore === null ? null : Number(enrollment.finalScore),
                savedPassed: enrollment.passed
            };
        });

        return {
            class: { publicId: courseClass.publicId, code: courseClass.code, name: courseClass.name },
            subject: {
                publicId: courseClass.subject.publicId,
                code: courseClass.subject.code,
                name: courseClass.subject.name,
                passScore: Number(courseClass.subject.passScore),
                weights
            },
            assessments: allAssessments.map((assessment) => ({
                publicId: assessment.publicId,
                title: assessment.title,
                category: assessment.category,
                scorePolicy: assessment.scorePolicy,
                closeAt: assessment.closeAt,
                maxPoints: assessment.maxPoints
            })),
            canFinalize: blockers.length === 0,
            blockers,
            students
        };
    }

    private assessmentSnapshots(
        assessments: Array<{
            publicId: string;
            title: string;
            category: AssessmentCategory;
            scorePolicy: ScorePolicy;
            closeAt: Date;
            questions: Array<{ points: unknown }>;
            attempts: Array<{ attemptNumber: number; status: AttemptStatus; score: unknown; studentId: number }>;
        }>
    ): AssessmentSnapshot[] {
        return assessments.map((assessment) => ({
            publicId: assessment.publicId,
            title: assessment.title,
            category: assessment.category,
            scorePolicy: assessment.scorePolicy,
            closeAt: assessment.closeAt,
            maxPoints: this.round(assessment.questions.reduce((sum, question) => sum + Number(question.points), 0)),
            attempts: assessment.attempts.map((attempt) => ({
                studentId: attempt.studentId,
                attemptNumber: attempt.attemptNumber,
                status: attempt.status,
                score: attempt.score === null ? null : Number(attempt.score)
            }))
        }));
    }

    private calculateStudentGrade(
        assessments: AssessmentSnapshot[],
        weights: CategoryWeights,
        passScore: number
    ) {
        const categoryScores = Object.values(AssessmentCategory).map((category) => {
            const categoryAssessments = assessments.filter((assessment) => assessment.category === category);
            const scores = categoryAssessments.map((assessment) => this.effectiveAssessmentScore(assessment));
            const score = scores.length ? this.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
            return { category, weight: weights[category], assessmentCount: scores.length, score };
        });
        const score = this.round(
            categoryScores.reduce((sum, category) => sum + category.score * (category.weight / 100), 0)
        );
        return { categoryScores, score, passed: score >= passScore };
    }

    private effectiveAssessmentScore(assessment: AssessmentSnapshot) {
        if (assessment.maxPoints <= 0) return 0;
        const graded = assessment.attempts.filter(
            (attempt) => attempt.status === AttemptStatus.GRADED && attempt.score !== null
        );
        if (!graded.length) return 0;
        const selected =
            assessment.scorePolicy === ScorePolicy.LATEST
                ? graded.sort((a, b) => b.attemptNumber - a.attemptNumber)[0]
                : graded.sort(
                      (a, b) => (b.score ?? 0) - (a.score ?? 0) || b.attemptNumber - a.attemptNumber
                  )[0];
        return this.round(Math.min(10, Math.max(0, ((selected.score ?? 0) / assessment.maxPoints) * 10)));
    }

    private finalizationBlockers(assessments: AssessmentSnapshot[], weights: CategoryWeights) {
        const blockers: string[] = [];
        if (!assessments.length) blockers.push('Lớp chưa có bài đánh giá đã công bố');
        if (assessments.some((assessment) => assessment.maxPoints <= 0))
            blockers.push('Có bài đánh giá chưa có tổng điểm câu hỏi hợp lệ');
        if (assessments.some((assessment) => assessment.closeAt > new Date()))
            blockers.push('Vẫn còn bài đánh giá chưa hết thời gian làm bài');
        if (assessments.some((assessment) => assessment.attempts.some((attempt) => attempt.status !== AttemptStatus.GRADED)))
            blockers.push('Vẫn còn lượt làm bài chưa chấm xong');
        const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        if (this.round(totalWeight) !== 100) blockers.push('Tổng trọng số các nhóm điểm phải bằng 100%');
        for (const category of Object.values(AssessmentCategory)) {
            if (weights[category] > 0 && !assessments.some((assessment) => assessment.category === category))
                blockers.push(`Chưa có bài đánh giá cho nhóm ${this.categoryLabel(category)}`);
        }
        return blockers;
    }

    private subjectWeights(subject: {
        assignmentWeight: unknown;
        quizWeight: unknown;
        midtermWeight: unknown;
        finalWeight: unknown;
    }): CategoryWeights {
        return {
            ASSIGNMENT: Number(subject.assignmentWeight),
            QUIZ: Number(subject.quizWeight),
            MIDTERM: Number(subject.midtermWeight),
            FINAL: Number(subject.finalWeight)
        };
    }

    private transcriptSummary(courses: Array<{ credits: number; finalScore: number; passed: boolean }>) {
        const attemptedCredits = courses.reduce((sum, course) => sum + course.credits, 0);
        const passedCredits = courses.reduce((sum, course) => sum + (course.passed ? course.credits : 0), 0);
        const weightedAverage = attemptedCredits
            ? this.round(courses.reduce((sum, course) => sum + course.finalScore * course.credits, 0) / attemptedCredits)
            : null;
        return { attemptedCredits, passedCredits, weightedAverage };
    }

    private categoryLabel(category: AssessmentCategory) {
        return {
            ASSIGNMENT: 'bài tập',
            QUIZ: 'kiểm tra ngắn',
            MIDTERM: 'giữa kỳ',
            FINAL: 'cuối kỳ'
        }[category];
    }

    private async requireGradebookAccess(classPublicId: string, userPublicId: string) {
        const [courseClass, user] = await Promise.all([
            this.prisma.class.findUnique({ where: { publicId: classPublicId } }),
            this.prisma.user.findUnique({ where: { publicId: userPublicId }, select: { id: true, role: true, departmentId: true } })
        ]);
        if (!courseClass || !user) throw new ForbiddenException('Bạn không phụ trách lớp học này');
        const isTrainingOfficer = user.role === UserRole.TRAINING_OFFICER;
        const isAssignedLecturer = user.role === UserRole.LECTURER && courseClass.lecturerId === user.id;
        const isCurrentDepartmentHead = user.role === UserRole.DEPARTMENT_HEAD
            && user.departmentId !== null
            && courseClass.departmentId === user.departmentId;
        if (!isTrainingOfficer && !isAssignedLecturer && !isCurrentDepartmentHead)
            throw new ForbiddenException('Bạn không có quyền xem bảng điểm lớp học này');
        return courseClass;
    }

    private async requireStudent(publicId: string) {
        const student = await this.prisma.user.findUnique({
            where: { publicId }
        });
        if (!student || student.role !== UserRole.STUDENT) throw new ForbiddenException('Chỉ sinh viên được xem bảng điểm');
        return student;
    }

    private round(value: number) {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }
}
