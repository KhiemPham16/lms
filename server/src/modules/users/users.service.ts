import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { AuditAction, EmploymentStatus, Prisma, StudentStatus, UserRole, UserStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'node:crypto';
import { PrismaService } from '~/prisma/prisma.service';
import { MailQueueService } from '../mail/mail-queue.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';

const roleScope: Record<UserRole, UserRole[]> = {
    [UserRole.ADMIN]: [
        UserRole.PRINCIPAL,
        UserRole.HR,
        UserRole.TRAINING_OFFICER,
        UserRole.DEPARTMENT_HEAD,
        UserRole.LECTURER,
        UserRole.STUDENT
    ],
    [UserRole.HR]: [UserRole.TRAINING_OFFICER, UserRole.DEPARTMENT_HEAD, UserRole.LECTURER, UserRole.STUDENT],
    [UserRole.PRINCIPAL]: [
        UserRole.HR,
        UserRole.TRAINING_OFFICER,
        UserRole.DEPARTMENT_HEAD,
        UserRole.LECTURER,
        UserRole.STUDENT
    ],
    [UserRole.TRAINING_OFFICER]: [],
    [UserRole.DEPARTMENT_HEAD]: [],
    [UserRole.LECTURER]: [],
    [UserRole.STUDENT]: []
};

const passwordResetScope: Record<UserRole, UserRole[]> = {
    [UserRole.ADMIN]: [
        UserRole.PRINCIPAL,
        UserRole.HR,
        UserRole.TRAINING_OFFICER,
        UserRole.DEPARTMENT_HEAD,
        UserRole.LECTURER,
        UserRole.STUDENT
    ],
    [UserRole.PRINCIPAL]: [
        UserRole.HR,
        UserRole.TRAINING_OFFICER,
        UserRole.DEPARTMENT_HEAD,
        UserRole.LECTURER,
        UserRole.STUDENT
    ],
    [UserRole.HR]: [UserRole.TRAINING_OFFICER, UserRole.DEPARTMENT_HEAD, UserRole.LECTURER, UserRole.STUDENT],
    [UserRole.TRAINING_OFFICER]: [],
    [UserRole.DEPARTMENT_HEAD]: [],
    [UserRole.LECTURER]: [],
    [UserRole.STUDENT]: []
};

const DEFAULT_ACCOUNT_PASSWORD = 'Lms@123';

const permanentDeleteDependencies: Partial<Record<UserRole, string[]>> = {
    [UserRole.STUDENT]: ['enrollments', 'attempts', 'lessonProgress'],
    [UserRole.LECTURER]: ['sessions', 'auditLogs', 'teachingClasses', 'gradedAnswers', 'mediaUploads', 'notifications'],
    [UserRole.DEPARTMENT_HEAD]: [
        'sessions',
        'auditLogs',
        'proposedSubjects',
        'proposedClasses',
        'managedClasses',
        'teachingClasses',
        'gradedAnswers',
        'mediaUploads',
        'notifications'
    ],
    [UserRole.HR]: ['sessions', 'auditLogs', 'notifications', 'studentStatusChanges', 'employmentStatusChanges'],
    [UserRole.TRAINING_OFFICER]: [
        'sessions',
        'auditLogs',
        'trainingSubjectReviews',
        'classProposalReviews',
        'notifications'
    ],
    [UserRole.PRINCIPAL]: [
        'sessions',
        'auditLogs',
        'principalSubjectReviews',
        'notifications',
        'updatedSystemSettings',
        'studentStatusChanges',
        'employmentStatusChanges',
        'createdAnnouncements',
        'publishedAnnouncements'
    ]
};

const roleNames: Partial<Record<UserRole, string>> = {
    [UserRole.STUDENT]: 'sinh viên',
    [UserRole.LECTURER]: 'giảng viên',
    [UserRole.DEPARTMENT_HEAD]: 'trưởng bộ môn',
    [UserRole.HR]: 'nhân sự HR',
    [UserRole.TRAINING_OFFICER]: 'nhân sự Phòng đào tạo',
    [UserRole.PRINCIPAL]: 'Hiệu trưởng'
};

const publicUserSelect = {
    publicId: true,
    code: true,
    fullName: true,
    email: true,
    phone: true,
    role: true,
    status: true,
    studentStatus: true,
    studentStatusChangedAt: true,
    studentStatusChangedBy: { select: { publicId: true, fullName: true } },
    employmentStatus: true,
    employmentStatusChangedAt: true,
    employmentEndedAt: true,
    employmentStatusChangedBy: { select: { publicId: true, fullName: true } },
    gender: true,
    dateOfBirth: true,
    address: true,
    avatarUrl: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    department: { select: { publicId: true, code: true, name: true } }
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailQueue: MailQueueService,
        private readonly config: ConfigService,
        private readonly audit: AuditService
    ) {}

    async list(query: QueryUserDto, actor: { sub: string; role: UserRole }) {
        const actorRole = actor.role;
        const allowed = roleScope[actorRole];
        const hasGlobalView = actorRole === UserRole.ADMIN || actorRole === UserRole.PRINCIPAL;
        const canViewDepartmentLecturers = actorRole === UserRole.DEPARTMENT_HEAD && query.role === UserRole.LECTURER;

        if (query.role && !hasGlobalView && !allowed.includes(query.role) && !canViewDepartmentLecturers) {
            throw new ForbiddenException('Bạn không được xem nhóm tài khoản này');
        }

        let departmentId: number | undefined;
        if (canViewDepartmentLecturers) {
            const departmentHead = await this.prisma.user.findUnique({
                where: { publicId: actor.sub },
                select: { departmentId: true }
            });
            if (!departmentHead?.departmentId) {
                throw new ForbiddenException('Trưởng bộ môn chưa được gán bộ môn');
            }
            departmentId = departmentHead.departmentId;
        }

        const where: Prisma.UserWhereInput = {
            role: query.role ? query.role : hasGlobalView ? undefined : { in: allowed },
            departmentId,
            status: query.status,
            studentStatus: query.studentStatus,
            employmentStatus: query.employmentStatus,
            OR: query.search
                ? [
                      { code: { contains: query.search } },
                      { fullName: { contains: query.search } },
                      { email: { contains: query.search } }
                  ]
                : undefined
        };
        const skip = (query.page - 1) * query.limit;
        const [data, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                select: publicUserSelect,
                skip,
                take: query.limit,
                orderBy: [{ role: 'asc' }, { createdAt: 'desc' }]
            }),
            this.prisma.user.count({ where })
        ]);
        return {
            data,
            meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
        };
    }

    async findOne(publicId: string, actorRole: UserRole) {
        const user = await this.prisma.user.findUnique({ where: { publicId }, select: publicUserSelect });
        if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
        this.assertCanView(actorRole, user.role);
        return user;
    }

    async create(dto: CreateUserDto, actor: { sub: string; role: UserRole }) {
        this.assertCanManage(actor.role, dto.role);
        if (dto.role === UserRole.PRINCIPAL) {
            const principalExists = await this.prisma.user.findFirst({
                where: {
                    role: UserRole.PRINCIPAL,
                    OR: [
                        { employmentStatus: null },
                        {
                            employmentStatus: {
                                notIn: [
                                    EmploymentStatus.CONTRACT_ENDED,
                                    EmploymentStatus.RESIGNED,
                                    EmploymentStatus.TERMINATED
                                ]
                            }
                        }
                    ]
                },
                select: { id: true }
            });
            if (principalExists) throw new ConflictException('Hệ thống chỉ được có một Hiệu trưởng');
        }
        const duplicate = await this.prisma.user.findFirst({
            where: {
                OR: [{ email: dto.email.toLowerCase() }, ...(dto.phone ? [{ phone: dto.phone }] : [])]
            }
        });
        if (duplicate) throw new ConflictException('Email hoặc số điện thoại đã tồn tại');
        const department = dto.departmentPublicId
            ? await this.prisma.department.findUnique({ where: { publicId: dto.departmentPublicId } })
            : null;
        if (dto.departmentPublicId && !department) throw new NotFoundException('Không tìm thấy phòng ban');
        const activationToken = randomBytes(32).toString('hex');
        const activationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const password = await bcrypt.hash(
            DEFAULT_ACCOUNT_PASSWORD,
            this.config.get<number>('auth.bcryptRounds') ?? 10
        );
        const code = await this.generateUserCode();
        const user = await this.prisma.user.create({
            data: {
                code,
                fullName: dto.fullName.trim(),
                email: dto.email.toLowerCase(),
                phone: dto.phone,
                password,
                role: dto.role,
                status: UserStatus.PENDING,
                studentStatus: dto.role === UserRole.STUDENT ? StudentStatus.STUDYING : null,
                employmentStatus: dto.role === UserRole.STUDENT ? null : EmploymentStatus.WORKING,
                gender: dto.gender,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                address: dto.address,
                departmentId: department?.id,
                activationToken,
                activationTokenExpiresAt
            },
            select: publicUserSelect
        });
        const frontendUrl = this.config.get<string>('app.frontendUrl');
        await this.mailQueue.sendActivation({
            email: user.email,
            fullName: user.fullName,
            account: user.email,
            password: DEFAULT_ACCOUNT_PASSWORD,
            status: user.status,
            activationUrl: `${frontendUrl}/activate?token=${activationToken}`,
            expiresAt: activationTokenExpiresAt.toLocaleString('vi-VN')
        });
        await this.audit.record({
            actorPublicId: actor.sub,
            action: AuditAction.CREATE,
            module: 'tai-khoan',
            targetType: 'User',
            targetPublicId: user.publicId,
            newValue: { code: user.code, email: user.email, role: user.role }
        });
        return user;
    }

    async update(publicId: string, dto: UpdateUserDto, actor: { sub: string; role: UserRole }) {
        const current = await this.prisma.user.findUnique({ where: { publicId } });
        if (!current) throw new NotFoundException('Không tìm thấy tài khoản');
        this.assertCanManage(actor.role, current.role);
        const department = dto.departmentPublicId
            ? await this.prisma.department.findUnique({ where: { publicId: dto.departmentPublicId } })
            : undefined;
        if (dto.departmentPublicId && !department) throw new NotFoundException('Không tìm thấy phòng ban');
        const user = await this.prisma.user.update({
            where: { publicId },
            data: {
                fullName: dto.fullName?.trim(),
                email: dto.email?.toLowerCase(),
                phone: dto.phone,
                gender: dto.gender,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                address: dto.address,
                departmentId: dto.departmentPublicId === undefined ? undefined : (department?.id ?? null)
            },
            select: publicUserSelect
        });
        await this.audit.record({
            actorPublicId: actor.sub,
            action: AuditAction.UPDATE,
            module: 'tai-khoan',
            targetType: 'User',
            targetPublicId: publicId,
            oldValue: { code: current.code, email: current.email },
            newValue: { code: user.code, email: user.email }
        });
        return user;
    }

    async changeStatus(publicId: string, status: UserStatus, actor: { sub: string; role: UserRole }) {
        const current = await this.prisma.user.findUnique({ where: { publicId } });
        if (!current) throw new NotFoundException('Không tìm thấy tài khoản');
        this.assertCanManage(actor.role, current.role);
        const user = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({ where: { publicId }, data: { status }, select: publicUserSelect });
            if (status !== UserStatus.ACTIVE) await tx.session.deleteMany({ where: { userId: current.id } });
            return updated;
        });
        await this.audit.record({
            actorPublicId: actor.sub,
            action: AuditAction.STATUS_CHANGE,
            module: 'tai-khoan',
            targetType: 'User',
            targetPublicId: publicId,
            oldValue: { status: current.status },
            newValue: { status }
        });
        return user;
    }

    async changeStudentStatus(publicId: string, status: StudentStatus, actor: { sub: string; role: UserRole }) {
        const [current, changedBy] = await Promise.all([
            this.prisma.user.findUnique({ where: { publicId } }),
            this.prisma.user.findUnique({ where: { publicId: actor.sub }, select: { id: true } })
        ]);
        if (!current) throw new NotFoundException('Không tìm thấy tài khoản');
        if (!changedBy) throw new NotFoundException('Không tìm thấy người thực hiện');
        if (current.role !== UserRole.STUDENT)
            throw new BadRequestException('Trạng thái học tập chỉ áp dụng cho sinh viên');
        this.assertCanManage(actor.role, current.role);

        const user = await this.prisma.user.update({
            where: { id: current.id },
            data: {
                studentStatus: status,
                studentStatusChangedAt: new Date(),
                studentStatusChangedById: changedBy.id
            },
            select: publicUserSelect
        });
        await this.audit.record({
            actorPublicId: actor.sub,
            action: AuditAction.STATUS_CHANGE,
            module: 'tai-khoan',
            targetType: 'User',
            targetPublicId: publicId,
            oldValue: { studentStatus: current.studentStatus },
            newValue: { studentStatus: status }
        });
        return user;
    }

    async changeEmploymentStatus(publicId: string, status: EmploymentStatus, actor: { sub: string; role: UserRole }) {
        const [current, changedBy] = await Promise.all([
            this.prisma.user.findUnique({ where: { publicId } }),
            this.prisma.user.findUnique({ where: { publicId: actor.sub }, select: { id: true } })
        ]);
        if (!current) throw new NotFoundException('Không tìm thấy tài khoản');
        if (!changedBy) throw new NotFoundException('Không tìm thấy người thực hiện');
        if (current.role === UserRole.STUDENT)
            throw new BadRequestException('Trạng thái công tác không áp dụng cho sinh viên');
        this.assertCanManage(actor.role, current.role);

        const ended = new Set<EmploymentStatus>([
            EmploymentStatus.CONTRACT_ENDED,
            EmploymentStatus.RESIGNED,
            EmploymentStatus.TERMINATED
        ]).has(status);
        const now = new Date();
        const user = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id: current.id },
                data: {
                    status: ended ? UserStatus.INACTIVE : undefined,
                    employmentStatus: status,
                    employmentStatusChangedAt: now,
                    employmentEndedAt: ended ? now : null,
                    employmentStatusChangedById: changedBy.id
                },
                select: publicUserSelect
            });
            if (ended) await tx.session.deleteMany({ where: { userId: current.id } });
            return updated;
        });
        await this.audit.record({
            actorPublicId: actor.sub,
            action: AuditAction.STATUS_CHANGE,
            module: 'tai-khoan',
            targetType: 'User',
            targetPublicId: publicId,
            oldValue: { employmentStatus: current.employmentStatus, employmentEndedAt: current.employmentEndedAt },
            newValue: { employmentStatus: status, employmentEndedAt: user.employmentEndedAt }
        });
        return user;
    }

    async resetPassword(publicId: string, actor: { sub: string; role: UserRole }) {
        const current = await this.prisma.user.findUnique({ where: { publicId } });
        if (!current) throw new NotFoundException('Không tìm thấy tài khoản');
        if (!passwordResetScope[actor.role].includes(current.role))
            throw new ForbiddenException('Bạn không có quyền đặt lại mật khẩu của vai trò này');
        const password = await bcrypt.hash(
            DEFAULT_ACCOUNT_PASSWORD,
            this.config.get<number>('auth.bcryptRounds') ?? 10
        );
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: current.id },
                data: { password, resetPasswordOtp: null, resetPasswordOtpExpiresAt: null }
            }),
            this.prisma.session.deleteMany({ where: { userId: current.id } })
        ]);
        await this.audit.record({
            actorPublicId: actor.sub,
            action: AuditAction.RESET_PASSWORD,
            module: 'tai-khoan',
            targetType: 'User',
            targetPublicId: publicId,
            newValue: { resetToDefault: true }
        });
        return { message: 'Đã đặt lại mật khẩu về mặc định', temporaryPassword: DEFAULT_ACCOUNT_PASSWORD };
    }

    async remove(publicId: string, actor: { sub: string; role: UserRole }) {
        const [current, changedBy] = await Promise.all([
            this.prisma.user.findUnique({
                where: { publicId },
                include: {
                    _count: {
                        select: {
                            sessions: true,
                            auditLogs: true,
                            proposedSubjects: true,
                            trainingSubjectReviews: true,
                            principalSubjectReviews: true,
                            proposedClasses: true,
                            classProposalReviews: true,
                            managedClasses: true,
                            teachingClasses: true,
                            enrollments: true,
                            notifications: true,
                            attempts: true,
                            gradedAnswers: true,
                            lessonProgress: true,
                            mediaUploads: true,
                            updatedSystemSettings: true,
                            studentStatusChanges: true,
                            employmentStatusChanges: true,
                            createdAnnouncements: true,
                            publishedAnnouncements: true
                        }
                    }
                }
            }),
            this.prisma.user.findUnique({ where: { publicId: actor.sub }, select: { id: true } })
        ]);
        if (!current) throw new NotFoundException('Không tìm thấy tài khoản');
        if (!changedBy) throw new NotFoundException('Không tìm thấy người thực hiện');
        if (current.publicId === actor.sub) throw new BadRequestException('Không thể tự xóa tài khoản đang đăng nhập');
        this.assertCanManage(actor.role, current.role);

        const dependencies = permanentDeleteDependencies[current.role];
        if (dependencies) {
            const counts = current._count as Record<string, number>;
            const relatedData = dependencies.filter((relation) => (counts[relation] ?? 0) > 0);
            const canDeleteByStatus =
                current.role === UserRole.STUDENT ||
                current.status === UserStatus.PENDING ||
                (current.role === UserRole.PRINCIPAL && current.employmentStatus === EmploymentStatus.TERMINATED);
            if (!canDeleteByStatus || relatedData.length) {
                const isStudent = current.role === UserRole.STUDENT;
                throw new ConflictException({
                    code: `${current.role}_CANNOT_BE_PERMANENTLY_DELETED`,
                    message: relatedData.length
                        ? `Không thể xóa vĩnh viễn ${roleNames[current.role]} đã phát sinh dữ liệu`
                        : `Không thể xóa vĩnh viễn ${roleNames[current.role]} ở trạng thái hiện tại`,
                    accountStatus: current.status,
                    relatedData,
                    suggestedStatuses: isStudent
                        ? [
                              StudentStatus.RESERVED,
                              StudentStatus.GRADUATED,
                              StudentStatus.DROPPED_OUT,
                              StudentStatus.SUSPENDED
                          ]
                        : [
                              EmploymentStatus.ON_LEAVE,
                              EmploymentStatus.CONTRACT_ENDED,
                              EmploymentStatus.RESIGNED,
                              EmploymentStatus.TERMINATED
                          ]
                });
            }
            await this.prisma.user.delete({ where: { id: current.id } });
            await this.audit.record({
                actorPublicId: actor.sub,
                action: AuditAction.DELETE,
                module: 'tai-khoan',
                targetType: 'User',
                targetPublicId: publicId,
                oldValue: { role: current.role, status: current.status },
                newValue: { permanentlyDeleted: true }
            });
            return {
                message: `Đã xóa vĩnh viễn ${roleNames[current.role]} chưa phát sinh dữ liệu`,
                permanentlyDeleted: true,
                role: current.role
            };
        }

        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: current.id },
                data: {
                    status: UserStatus.INACTIVE,
                    employmentStatus: EmploymentStatus.TERMINATED,
                    employmentStatusChangedAt: now,
                    employmentEndedAt: now,
                    employmentStatusChangedById: changedBy.id,
                    activationToken: null,
                    activationTokenExpiresAt: null
                }
            }),
            this.prisma.session.deleteMany({ where: { userId: current.id } })
        ]);
        await this.audit.record({
            actorPublicId: actor.sub,
            action: AuditAction.STATUS_CHANGE,
            module: 'tai-khoan',
            targetType: 'User',
            targetPublicId: publicId,
            oldValue: { status: current.status, employmentStatus: current.employmentStatus },
            newValue: {
                status: UserStatus.INACTIVE,
                employmentStatus: EmploymentStatus.TERMINATED,
                employmentEndedAt: now,
                softDeleted: true
            }
        });
        return {
            message: 'Đã chuyển nhân sự sang trạng thái ngừng công tác và thu hồi toàn bộ phiên đăng nhập',
            permanentlyDeleted: false
        };
    }

    private assertCanManage(actorRole: UserRole, targetRole: UserRole) {
        if (!roleScope[actorRole].includes(targetRole))
            throw new ForbiddenException('Bạn không có quyền quản lý vai trò này');
    }

    private assertCanView(actorRole: UserRole, targetRole: UserRole) {
        if (actorRole === UserRole.ADMIN || actorRole === UserRole.PRINCIPAL) return;
        if (!roleScope[actorRole].includes(targetRole)) {
            throw new ForbiddenException('Bạn không có quyền xem tài khoản này');
        }
    }

    private async generateUserCode() {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const year = String(now.getFullYear());

        for (let attempt = 0; attempt < 20; attempt += 1) {
            const randomPart = String(randomInt(0, 1000)).padStart(3, '0');
            const code = `${day}${year}${randomPart}`;
            const exists = await this.prisma.user.findUnique({ where: { code }, select: { id: true } });
            if (!exists) return code;
        }

        throw new ConflictException('Không thể tạo mã người dùng duy nhất, vui lòng thử lại');
    }
}
