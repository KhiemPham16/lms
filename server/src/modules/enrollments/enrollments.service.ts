import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ClassStatus, EnrollmentStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '~/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Injectable()
export class EnrollmentsService {
    constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

    async availableClasses(studentPublicId: string) {
        const student = await this.requireStudent(studentPublicId);
        if (student.departmentId === null) return [];
        const now = new Date();
        const classes = await this.prisma.class.findMany({
            where: {
                departmentId: student.departmentId,
                status: ClassStatus.OPEN_REGISTRATION,
                registrationStart: { lte: now }, registrationEnd: { gte: now }
            },
            include: {
                subject: { select: { publicId: true, code: true, name: true, credits: true } },
                schedules: true,
                lecturer: { select: { publicId: true, fullName: true } },
                _count: { select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } } } }
            }, orderBy: [{ createdAt: 'desc' }, { code: 'asc' }]
        });
        return classes.map((item) => ({ ...item, enrolledCount: item._count.enrollments, remainingSlots: Math.max(0, item.maxStudents - item._count.enrollments), _count: undefined }));
    }

    async myEnrollments(studentPublicId: string) {
        const student = await this.requireStudent(studentPublicId);
        return this.prisma.enrollment.findMany({
            where: { studentId: student.id }, orderBy: { enrolledAt: 'desc' },
            include: { class: { include: { subject: true, schedules: true, lecturer: { select: { publicId: true, fullName: true } } } } }
        });
    }

    async enroll(dto: CreateEnrollmentDto, studentPublicId: string) {
        const student = await this.requireStudent(studentPublicId);

        const enrollment = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM \`Class\` WHERE publicId = ${dto.classPublicId} FOR UPDATE`;
            const courseClass = await tx.class.findUnique({
                where: { publicId: dto.classPublicId },
                include: { subject: { include: { prerequisites: true } }, schedules: true }
            });
            if (!courseClass) throw new NotFoundException('Không tìm thấy lớp học');
            if (student.departmentId === null || courseClass.departmentId !== student.departmentId || courseClass.subject.departmentId !== student.departmentId) {
                throw new ForbiddenException('Bạn chỉ được đăng ký lớp thuộc ngành của mình');
            }
            this.assertRegistrationOpen(courseClass);

            const duplicateSubject = await tx.enrollment.findFirst({
                where: {
                    studentId: student.id, status: EnrollmentStatus.ACTIVE,
                    class: { subjectId: courseClass.subjectId }
                }
            });
            if (duplicateSubject) throw new ConflictException('Bạn đang tham gia một lớp học phần khác của môn học này');

            const passedSubject = await tx.enrollment.findFirst({
                where: { studentId: student.id, passed: true, class: { subjectId: courseClass.subjectId } }
            });
            if (passedSubject) throw new ConflictException('Bạn đã hoàn thành môn học này');

            await this.assertPrerequisites(tx, student.id, courseClass.subject.prerequisites.map((item) => item.prerequisiteId));
            await this.assertNoScheduleConflict(tx, student.id, courseClass.schedules);

            const enrolledCount = await tx.enrollment.count({ where: { classId: courseClass.id, status: EnrollmentStatus.ACTIVE } });
            if (enrolledCount >= courseClass.maxStudents) throw new ConflictException('Lớp học đã đủ số lượng sinh viên');

            const value = await tx.enrollment.upsert({
                where: { classId_studentId: { classId: courseClass.id, studentId: student.id } },
                create: { classId: courseClass.id, studentId: student.id },
                update: { status: EnrollmentStatus.ACTIVE, enrolledAt: new Date(), droppedAt: null }
            });
            await tx.notification.create({ data: {
                recipientId: student.id, type: 'ENROLLMENT_SUCCESS', title: 'Đăng ký lớp thành công',
                message: `Bạn đã đăng ký thành công lớp ${courseClass.code} - ${courseClass.name}.`,
                data: { classPublicId: courseClass.publicId, enrollmentPublicId: value.publicId }
            } });
            return { enrollment: value, courseClass };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

        await this.audit.record({ actorPublicId: studentPublicId, action: AuditAction.ENROLL, module: 'dang-ky-lop', targetType: 'Enrollment', targetPublicId: enrollment.enrollment.publicId, newValue: { classPublicId: enrollment.courseClass.publicId } });
        return { message: 'Đăng ký lớp thành công', enrollment: enrollment.enrollment };
    }

    async drop(enrollmentPublicId: string, studentPublicId: string) {
        const student = await this.requireStudent(studentPublicId);
        const enrollment = await this.prisma.enrollment.findFirst({ where: { publicId: enrollmentPublicId, studentId: student.id }, include: { class: true } });
        if (!enrollment || enrollment.status !== EnrollmentStatus.ACTIVE) throw new NotFoundException('Không tìm thấy đăng ký đang hoạt động');
        if (new Date() > enrollment.class.registrationEnd) throw new BadRequestException('Đã hết thời gian hủy đăng ký');
        const updated = await this.prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: EnrollmentStatus.DROPPED, droppedAt: new Date() } });
        await this.prisma.notification.create({ data: {
            recipientId: student.id, type: 'ENROLLMENT_DROPPED', title: 'Đã hủy đăng ký lớp',
            message: `Bạn đã hủy đăng ký lớp ${enrollment.class.code}.`, data: { classPublicId: enrollment.class.publicId }
        } });
        await this.audit.record({ actorPublicId: studentPublicId, action: AuditAction.DROP, module: 'dang-ky-lop', targetType: 'Enrollment', targetPublicId: enrollmentPublicId, newValue: { classPublicId: enrollment.class.publicId } });
        return { message: 'Hủy đăng ký lớp thành công', enrollment: updated };
    }

    private async requireStudent(publicId: string) {
        const student = await this.prisma.user.findUnique({ where: { publicId } });
        if (!student || student.role !== UserRole.STUDENT) throw new ForbiddenException('Chỉ sinh viên được đăng ký lớp');
        return student;
    }

    private assertRegistrationOpen(courseClass: { status: ClassStatus; registrationStart: Date; registrationEnd: Date }) {
        const now = new Date();
        if (courseClass.status !== ClassStatus.OPEN_REGISTRATION) throw new BadRequestException('Lớp học chưa mở đăng ký');
        if (now < courseClass.registrationStart || now > courseClass.registrationEnd) throw new BadRequestException('Không nằm trong thời gian đăng ký lớp');
    }

    private async assertPrerequisites(tx: Prisma.TransactionClient, studentId: number, prerequisiteIds: number[]) {
        if (!prerequisiteIds.length) return;
        const passedCount = await tx.enrollment.count({ where: { studentId, passed: true, class: { subjectId: { in: prerequisiteIds } } } });
        if (passedCount < prerequisiteIds.length) throw new BadRequestException('Bạn chưa hoàn thành đầy đủ các môn học tiên quyết');
    }

    private async assertNoScheduleConflict(tx: Prisma.TransactionClient, studentId: number, schedules: Array<{ weekDay: string; startTime: string; endTime: string }>) {
        if (!schedules.length) return;
        const enrollments = await tx.enrollment.findMany({
            where: { studentId, status: EnrollmentStatus.ACTIVE },
            include: { class: { include: { schedules: true } } }
        });
        const conflict = enrollments.some((item) => item.class.schedules.some((existing) => schedules.some((incoming) =>
            existing.weekDay === incoming.weekDay && existing.startTime < incoming.endTime && incoming.startTime < existing.endTime
        )));
        if (conflict) throw new ConflictException('Lịch học bị trùng với lớp đã đăng ký');
    }
}
