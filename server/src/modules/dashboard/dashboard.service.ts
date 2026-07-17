import { ForbiddenException, Injectable } from '@nestjs/common';
import {
    ClassProposalStatus,
    EnrollmentStatus,
    ProposalStatus,
    UserRole,
    UserStatus
} from '@prisma/client';
import type { JwtPayload } from '~/common/guards/jwt-auth.guard';
import { PrismaService } from '~/prisma/prisma.service';

type Tone = 'blue' | 'amber' | 'green' | 'slate';
type Metric = { key: string; label: string; value: number; detail?: string; suffix?: string; tone: Tone };
type BreakdownItem = { key: string; label: string; value: number; secondaryValue?: number; secondaryLabel?: string };

const ROLE_LABELS: Record<UserRole, string> = {
    ADMIN: 'Quản trị hệ thống',
    PRINCIPAL: 'Hiệu trưởng',
    HR: 'Nhân sự',
    TRAINING_OFFICER: 'Phòng đào tạo',
    DEPARTMENT_HEAD: 'Trưởng bộ môn',
    LECTURER: 'Giảng viên',
    STUDENT: 'Sinh viên'
};

const USER_STATUS_LABELS: Record<UserStatus, string> = {
    ACTIVE: 'Đang hoạt động',
    PENDING: 'Chờ kích hoạt',
    INACTIVE: 'Ngừng hoạt động',
    LOCKED: 'Đã khóa'
};

const SUBJECT_STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Bản nháp',
    PUBLIC: 'Đang công khai',
    ARCHIVE: 'Đã lưu trữ'
};

const CLASS_STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Bản nháp',
    OPEN_REGISTRATION: 'Đang mở đăng ký',
    CLOSED_REGISTRATION: 'Đã đóng đăng ký',
    IN_PROGRESS: 'Đang học',
    COMPLETED: 'Đã hoàn thành',
    CANCELLED: 'Đã hủy'
};

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) {}

    get(user: JwtPayload) {
        switch (user.role) {
            case UserRole.ADMIN:
                return this.systemOverview(true);
            case UserRole.PRINCIPAL:
                return this.systemOverview(false);
            case UserRole.HR:
                return this.hrOverview();
            case UserRole.TRAINING_OFFICER:
                return this.trainingOverview();
            case UserRole.DEPARTMENT_HEAD:
                return this.departmentOverview(user.sub);
            default:
                throw new ForbiddenException('Vai trò này sử dụng bảng điều khiển chuyên biệt');
        }
    }

    private async systemOverview(includeAudit: boolean) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [
            totalUsers,
            activeUsers,
            activeDepartments,
            totalSubjects,
            totalClasses,
            activeEnrollments,
            finalizedGrades,
            averageGrade,
            passedGrades,
            pendingSubjects,
            pendingClasses,
            roleGroups,
            statusGroups,
            subjectGroups,
            classGroups,
            auditToday,
            recentAudit
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
            this.prisma.department.count({ where: { isActive: true } }),
            this.prisma.subject.count(),
            this.prisma.class.count(),
            this.prisma.enrollment.count({ where: { status: EnrollmentStatus.ACTIVE } }),
            this.prisma.enrollment.count({ where: { finalScore: { not: null } } }),
            this.prisma.enrollment.aggregate({ where: { finalScore: { not: null } }, _avg: { finalScore: true } }),
            this.prisma.enrollment.count({ where: { passed: true } }),
            this.prisma.subjectProposal.count({
                where: { status: { in: [ProposalStatus.PENDING_TRAINING, ProposalStatus.PENDING_PRINCIPAL] } }
            }),
            this.prisma.classProposal.count({ where: { status: ClassProposalStatus.PENDING } }),
            this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
            this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
            this.prisma.subject.groupBy({ by: ['status'], _count: { _all: true } }),
            this.prisma.class.groupBy({ by: ['status'], _count: { _all: true } }),
            includeAudit ? this.prisma.auditLog.count({ where: { createdAt: { gte: today } } }) : Promise.resolve(0),
            includeAudit
                ? this.prisma.auditLog.findMany({
                      take: 8,
                      orderBy: { createdAt: 'desc' },
                      select: {
                          action: true,
                          module: true,
                          targetType: true,
                          createdAt: true,
                          actor: { select: { fullName: true, role: true } }
                      }
                  })
                : Promise.resolve([])
        ]);

        const metrics: Metric[] = [
            { key: 'users', label: 'Tổng người dùng', value: totalUsers, detail: `${activeUsers} đang hoạt động`, tone: 'blue' },
            { key: 'departments', label: 'Phòng ban hoạt động', value: activeDepartments, tone: 'slate' },
            { key: 'subjects', label: 'Tổng môn học', value: totalSubjects, tone: 'green' },
            { key: 'classes', label: 'Tổng lớp học', value: totalClasses, detail: `${activeEnrollments} lượt ghi danh`, tone: 'blue' },
            { key: 'average', label: 'Điểm trung bình toàn hệ thống', value: this.round(Number(averageGrade._avg.finalScore ?? 0)), suffix: '/10', detail: `${finalizedGrades} kết quả đã chốt`, tone: 'green' },
            { key: 'pass-rate', label: 'Tỷ lệ đạt toàn hệ thống', value: this.round(finalizedGrades ? (passedGrades / finalizedGrades) * 100 : 0), suffix: '%', tone: 'blue' },
            { key: 'pending', label: 'Yêu cầu chờ duyệt', value: pendingSubjects + pendingClasses, detail: `${pendingSubjects} môn, ${pendingClasses} lớp`, tone: 'amber' }
        ];
        if (includeAudit) {
            metrics.push({ key: 'audit', label: 'Audit log hôm nay', value: auditToday, tone: 'slate' });
        }

        return {
            scope: includeAudit ? 'ADMIN' : 'PRINCIPAL',
            title: includeAudit ? 'Tổng quan toàn hệ thống' : 'Tổng quan điều hành',
            subtitle: includeAudit
                ? 'Dữ liệu thời gian thực trên toàn bộ LMS.'
                : 'Thống kê toàn hệ thống, không bao gồm nhật ký audit.',
            metrics,
            breakdowns: [
                this.breakdown('roles', 'Người dùng theo vai trò', roleGroups, 'role', ROLE_LABELS),
                this.breakdown('user-status', 'Trạng thái tài khoản', statusGroups, 'status', USER_STATUS_LABELS),
                this.breakdown('subjects', 'Môn học theo trạng thái', subjectGroups, 'status', SUBJECT_STATUS_LABELS),
                this.breakdown('classes', 'Lớp học theo trạng thái', classGroups, 'status', CLASS_STATUS_LABELS)
            ],
            activity: includeAudit
                ? {
                      title: 'Hoạt động hệ thống gần đây',
                      items: recentAudit.map((item) => ({
                          label: item.actor?.fullName ?? 'Hệ thống',
                          detail: `${item.action} · ${item.module} · ${item.targetType}`,
                          timestamp: item.createdAt
                      }))
                  }
                : null,
            generatedAt: new Date()
        };
    }

    private async hrOverview() {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [totalUsers, activeUsers, pendingUsers, roleGroups, newRoleGroups, recentUsers] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
            this.prisma.user.count({ where: { status: UserStatus.PENDING } }),
            this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
            this.prisma.user.groupBy({ by: ['role'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
            this.prisma.user.findMany({
                take: 8,
                orderBy: { createdAt: 'desc' },
                select: { fullName: true, code: true, role: true, createdAt: true, department: { select: { name: true } } }
            })
        ]);
        const newByRole = new Map(newRoleGroups.map((item) => [item.role, item._count._all]));
        const roleItems: BreakdownItem[] = Object.values(UserRole).map((role) => {
            const total = roleGroups.find((item) => item.role === role)?._count._all ?? 0;
            return {
                key: role,
                label: ROLE_LABELS[role],
                value: total,
                secondaryValue: newByRole.get(role) ?? 0,
                secondaryLabel: 'mới trong 30 ngày'
            };
        });
        const newUsers = newRoleGroups.reduce((sum, item) => sum + item._count._all, 0);
        const students = roleGroups.find((item) => item.role === UserRole.STUDENT)?._count._all ?? 0;
        const employees = totalUsers - students;

        return {
            scope: 'HR',
            title: 'Tổng quan nhân sự & người học',
            subtitle: 'Số lượng hiện tại và tài khoản mới trong 30 ngày gần nhất.',
            metrics: [
                { key: 'people', label: 'Tổng người dùng', value: totalUsers, tone: 'blue' },
                { key: 'employees', label: 'Tổng nhân sự', value: employees, tone: 'slate' },
                { key: 'students', label: 'Tổng sinh viên', value: students, tone: 'green' },
                { key: 'new', label: 'Người dùng mới', value: newUsers, detail: 'Trong 30 ngày', tone: 'blue' },
                { key: 'active', label: 'Tài khoản hoạt động', value: activeUsers, tone: 'green' },
                { key: 'active-rate', label: 'Tỷ lệ tài khoản hoạt động', value: this.round(totalUsers ? (activeUsers / totalUsers) * 100 : 0), suffix: '%', detail: `${activeUsers}/${totalUsers} tài khoản`, tone: 'green' },
                { key: 'pending', label: 'Chờ kích hoạt', value: pendingUsers, tone: 'amber' }
            ] satisfies Metric[],
            breakdowns: [{ key: 'roles', title: 'Tổng và số mới theo vai trò', items: roleItems }],
            activity: {
                title: 'Tài khoản mới tạo',
                items: recentUsers.map((item) => ({
                    label: item.fullName,
                    detail: `${ROLE_LABELS[item.role]} · ${item.department?.name ?? 'Chưa gán phòng ban'} · ${item.code}`,
                    timestamp: item.createdAt
                }))
            },
            generatedAt: new Date()
        };
    }

    private async trainingOverview() {
        return this.academicOverview();
    }

    private async departmentOverview(publicId: string) {
        const user = await this.prisma.user.findUnique({
            where: { publicId },
            select: { departmentId: true, department: { select: { publicId: true, code: true, name: true } } }
        });
        if (!user?.departmentId || !user.department) {
            return {
                scope: 'DEPARTMENT_HEAD',
                title: 'Tổng quan bộ môn',
                subtitle: 'Tài khoản chưa được gán bộ môn.',
                warning: 'Vui lòng liên hệ HR hoặc quản trị viên để gán bộ môn.',
                metrics: [],
                breakdowns: [],
                activity: null,
                generatedAt: new Date()
            };
        }
        return this.academicOverview(user.departmentId, user.department);
    }

    private async academicOverview(
        departmentId?: number,
        department?: { publicId: string; code: string; name: string }
    ) {
        const subjectWhere = departmentId ? { departmentId } : {};
        const classWhere = departmentId ? { departmentId } : {};
        const enrollmentWhere = departmentId ? { class: { departmentId } } : {};
        const scoreWhere = { ...enrollmentWhere, finalScore: { not: null } };
        const subjectProposalWhere = departmentId
            ? { departmentId, status: { in: [ProposalStatus.PENDING_TRAINING, ProposalStatus.PENDING_PRINCIPAL] } }
            : { status: ProposalStatus.PENDING_TRAINING };
        const classProposalWhere = departmentId
            ? { subject: { departmentId }, status: ClassProposalStatus.PENDING }
            : { status: ClassProposalStatus.PENDING };

        const [
            totalSubjects,
            totalClasses,
            activeEnrollments,
            finalizedGrades,
            averageGrade,
            passedGrades,
            pendingSubjects,
            pendingClasses,
            subjectGroups,
            classGroups,
            gradeBelow5,
            grade5To7,
            grade7To85,
            gradeAbove85,
            recentClasses,
            departmentPeople
        ] = await Promise.all([
            this.prisma.subject.count({ where: subjectWhere }),
            this.prisma.class.count({ where: classWhere }),
            this.prisma.enrollment.count({ where: { ...enrollmentWhere, status: EnrollmentStatus.ACTIVE } }),
            this.prisma.enrollment.count({ where: scoreWhere }),
            this.prisma.enrollment.aggregate({ where: scoreWhere, _avg: { finalScore: true } }),
            this.prisma.enrollment.count({ where: { ...enrollmentWhere, passed: true } }),
            this.prisma.subjectProposal.count({ where: subjectProposalWhere }),
            this.prisma.classProposal.count({ where: classProposalWhere }),
            this.prisma.subject.groupBy({ by: ['status'], where: subjectWhere, _count: { _all: true } }),
            this.prisma.class.groupBy({ by: ['status'], where: classWhere, _count: { _all: true } }),
            this.prisma.enrollment.count({ where: { ...enrollmentWhere, finalScore: { lt: 5 } } }),
            this.prisma.enrollment.count({ where: { ...enrollmentWhere, finalScore: { gte: 5, lt: 7 } } }),
            this.prisma.enrollment.count({ where: { ...enrollmentWhere, finalScore: { gte: 7, lt: 8.5 } } }),
            this.prisma.enrollment.count({ where: { ...enrollmentWhere, finalScore: { gte: 8.5 } } }),
            this.prisma.class.findMany({
                where: classWhere,
                take: 8,
                orderBy: { createdAt: 'desc' },
                select: { code: true, name: true, status: true, createdAt: true, subject: { select: { name: true } } }
            }),
            departmentId
                ? this.prisma.user.groupBy({
                      by: ['role'],
                      where: { departmentId, role: { in: [UserRole.DEPARTMENT_HEAD, UserRole.LECTURER, UserRole.STUDENT] } },
                      _count: { _all: true }
                  })
                : Promise.resolve<Array<{ role: UserRole; _count: { _all: number } }>>([])
        ]);
        const average = Number(averageGrade._avg.finalScore ?? 0);
        const passRate = finalizedGrades ? (passedGrades / finalizedGrades) * 100 : 0;
        const metrics: Metric[] = [
            { key: 'subjects', label: departmentId ? 'Môn học của bộ môn' : 'Tổng môn học', value: totalSubjects, tone: 'green' },
            { key: 'classes', label: departmentId ? 'Lớp thuộc bộ môn' : 'Tổng lớp học', value: totalClasses, tone: 'blue' },
            { key: 'enrollments', label: 'Lượt ghi danh hoạt động', value: activeEnrollments, tone: 'slate' },
            { key: 'average', label: 'Điểm trung bình', value: this.round(average), suffix: '/10', detail: `${finalizedGrades} kết quả đã chốt`, tone: 'green' },
            { key: 'pass-rate', label: 'Tỷ lệ đạt', value: this.round(passRate), suffix: '%', tone: 'blue' },
            { key: 'pending', label: 'Yêu cầu chờ xử lý', value: pendingSubjects + pendingClasses, detail: `${pendingSubjects} môn, ${pendingClasses} lớp`, tone: 'amber' }
        ];
        if (departmentId) {
            const lecturers = departmentPeople.find((item) => item.role === UserRole.LECTURER)?._count._all ?? 0;
            const students = departmentPeople.find((item) => item.role === UserRole.STUDENT)?._count._all ?? 0;
            metrics.push(
                { key: 'lecturers', label: 'Giảng viên trong bộ môn', value: lecturers, tone: 'slate' },
                { key: 'students', label: 'Sinh viên trong bộ môn', value: students, tone: 'blue' }
            );
        }

        return {
            scope: departmentId ? 'DEPARTMENT_HEAD' : 'TRAINING_OFFICER',
            title: department ? `Tổng quan bộ môn ${department.name}` : 'Tổng quan đào tạo',
            subtitle: department
                ? `Dữ liệu chỉ trong bộ môn ${department.code}.`
                : 'Thống kê môn học, lớp học, ghi danh và kết quả điểm.',
            department: department ?? null,
            metrics,
            breakdowns: [
                this.breakdown('subjects', 'Môn học theo trạng thái', subjectGroups, 'status', SUBJECT_STATUS_LABELS),
                this.breakdown('classes', 'Lớp học theo trạng thái', classGroups, 'status', CLASS_STATUS_LABELS),
                {
                    key: 'grades',
                    title: 'Phân bố điểm tổng kết',
                    items: [
                        { key: 'below-5', label: 'Dưới 5', value: gradeBelow5 },
                        { key: '5-7', label: 'Từ 5 đến dưới 7', value: grade5To7 },
                        { key: '7-8.5', label: 'Từ 7 đến dưới 8.5', value: grade7To85 },
                        { key: 'above-8.5', label: 'Từ 8.5 trở lên', value: gradeAbove85 }
                    ]
                }
            ],
            activity: {
                title: 'Lớp học mới nhất',
                items: recentClasses.map((item) => ({
                    label: `${item.code} - ${item.name}`,
                    detail: `${item.subject.name} · ${CLASS_STATUS_LABELS[item.status] ?? item.status}`,
                    timestamp: item.createdAt
                }))
            },
            generatedAt: new Date()
        };
    }

    private breakdown<T extends Record<string, unknown>>(
        key: string,
        title: string,
        rows: T[],
        field: keyof T,
        labels: Record<string, string>
    ) {
        return {
            key,
            title,
            items: rows.map((row) => {
                const itemKey = String(row[field]);
                const count = row._count as { _all: number };
                return { key: itemKey, label: labels[itemKey] ?? itemKey, value: count._all };
            })
        };
    }

    private round(value: number) {
        return Math.round(value * 100) / 100;
    }
}
