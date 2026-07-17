import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ClassProposalStatus, ClassStatus, Prisma, ProposalStatus, SubjectRestoreRequestStatus, SubjectStatus, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '~/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AddPrerequisiteDto, CreateClassProposalDto, CreateSubjectProposalDto, CreateSubjectRestoreRequestDto, ReviewProposalDto, UpdateClassDto } from './dto/academics.dto';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class AcademicsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly notifications: NotificationsService,
        private readonly settings: SystemSettingsService
    ) {}

    async listSubjects(actor: { sub: string; role: UserRole }) {
        const managerRoles = new Set<UserRole>([UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TRAINING_OFFICER, UserRole.DEPARTMENT_HEAD]);
        const canManageSubjects = managerRoles.has(actor.role);
        let departmentId: number | undefined;

        if (actor.role === UserRole.DEPARTMENT_HEAD || actor.role === UserRole.STUDENT) {
            const user = await this.prisma.user.findUnique({
                where: { publicId: actor.sub },
                select: { departmentId: true }
            });
            if (!user?.departmentId) {
                throw new BadRequestException(actor.role === UserRole.STUDENT
                    ? 'Sinh viên chưa được gán ngành'
                    : 'Trưởng bộ môn chưa được gán bộ môn');
            }
            departmentId = user.departmentId;
        }

        return this.prisma.subject.findMany({
            where: departmentId
                ? { departmentId, ...(canManageSubjects ? {} : { status: SubjectStatus.PUBLIC }) }
                : (canManageSubjects ? undefined : { status: SubjectStatus.PUBLIC }),
            orderBy: { code: 'asc' },
            include: {
                department: {
                    select: {
                        publicId: true,
                        code: true,
                        name: true,
                        users: {
                            where: { role: UserRole.DEPARTMENT_HEAD, status: UserStatus.ACTIVE },
                            select: { publicId: true, code: true, fullName: true }
                        }
                    }
                }
            }
        });
    }

    async updateSubjectStatus(publicId: string, status: SubjectStatus, actorPublicId: string) {
        const subject = await this.prisma.subject.findUnique({ where: { publicId } });
        if (!subject) throw new NotFoundException('Không tìm thấy môn học');

        if (status === subject.status) return subject;

        if (status === SubjectStatus.PUBLIC && subject.status !== SubjectStatus.PUBLIC) {
            throw new BadRequestException('Môn học chỉ được chuyển lại PUBLIC thông qua yêu cầu khôi phục được Hiệu trưởng duyệt');
        }
        if (status !== SubjectStatus.ARCHIVE) throw new BadRequestException('Không thể chuyển môn học về trạng thái DRAFT sau khi đã được tạo');

        if (status === SubjectStatus.ARCHIVE) {
            const unfinishedClassCount = await this.prisma.class.count({
                where: { subjectId: subject.id, status: { not: ClassStatus.COMPLETED } }
            });
            if (unfinishedClassCount > 0) {
                throw new BadRequestException('Chỉ có thể lưu trữ môn học khi tất cả lớp học phần đã hoàn thành');
            }
        }

        const updated = await this.prisma.subject.update({ where: { id: subject.id }, data: { status } });
        await this.record(actorPublicId, AuditAction.STATUS_CHANGE, 'mon-hoc', 'Subject', publicId, { status });
        return updated;
    }

    async removeSubject(publicId: string, actorPublicId: string) {
        const subject = await this.prisma.subject.findUnique({ where: { publicId } });
        if (!subject) throw new NotFoundException('Không tìm thấy môn học');

        const classCount = await this.prisma.class.count({ where: { subjectId: subject.id } });
        if (classCount > 0) throw new BadRequestException('Không thể xóa môn học đã có lớp học phần');

        await this.prisma.$transaction(async (tx) => {
            await tx.subjectProposal.updateMany({
                where: { approvedSubjectId: subject.id },
                data: { approvedSubjectId: null }
            });
            await tx.subjectRestoreRequest.deleteMany({ where: { subjectId: subject.id } });
            await tx.classProposal.deleteMany({ where: { subjectId: subject.id } });
            await tx.subject.delete({ where: { id: subject.id } });
        });
        await this.record(actorPublicId, AuditAction.DELETE, 'mon-hoc', 'Subject', publicId, {
            code: subject.code,
            name: subject.name
        });
        return { message: 'Đã xóa môn học' };
    }

    listSubjectRestoreRequests() {
        return this.prisma.subjectRestoreRequest.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                subject: { select: { publicId: true, code: true, name: true, status: true } },
                requestedBy: { select: { publicId: true, fullName: true } },
                reviewedBy: { select: { publicId: true, fullName: true } }
            }
        });
    }

    async createSubjectRestoreRequest(subjectPublicId: string, dto: CreateSubjectRestoreRequestDto, actorPublicId: string) {
        const actor = await this.requireActor(actorPublicId, UserRole.TRAINING_OFFICER);
        const subject = await this.prisma.subject.findUnique({ where: { publicId: subjectPublicId } });
        if (!subject) throw new NotFoundException('Không tìm thấy môn học');
        if (subject.status !== SubjectStatus.ARCHIVE) throw new BadRequestException('Chỉ môn học đang ARCHIVE mới cần yêu cầu khôi phục');
        const pending = await this.prisma.subjectRestoreRequest.findFirst({
            where: { subjectId: subject.id, status: SubjectRestoreRequestStatus.PENDING }
        });
        if (pending) throw new ConflictException('Môn học đã có yêu cầu khôi phục đang chờ Hiệu trưởng xử lý');
        const request = await this.prisma.subjectRestoreRequest.create({
            data: { subjectId: subject.id, requestedById: actor.id, reason: dto.reason?.trim() }
        });
        await this.record(actorPublicId, AuditAction.CREATE, 'khoi-phuc-mon-hoc', 'SubjectRestoreRequest', request.publicId, { subjectCode: subject.code, reason: request.reason ?? undefined });
        const principals = await this.prisma.user.findMany({
            where: { role: UserRole.PRINCIPAL, status: UserStatus.ACTIVE },
            select: { id: true }
        });
        await this.notifications.createMany(principals.map((principal) => ({
            recipientId: principal.id,
            type: 'SUBJECT_RESTORE_REQUESTED',
            title: 'Yêu cầu khôi phục môn học',
            message: `Phòng đào tạo đề nghị chuyển môn ${subject.code} từ ARCHIVE về PUBLIC.`,
            data: { requestPublicId: request.publicId, subjectPublicId: subject.publicId }
        })));
        return request;
    }

    async reviewSubjectRestoreRequest(publicId: string, dto: ReviewProposalDto, actorPublicId: string) {
        const reviewer = await this.requireActor(actorPublicId, UserRole.PRINCIPAL);
        const request = await this.prisma.subjectRestoreRequest.findUnique({ where: { publicId }, include: { subject: true } });
        if (!request) throw new NotFoundException('Không tìm thấy yêu cầu khôi phục môn học');
        if (request.status !== SubjectRestoreRequestStatus.PENDING) throw new BadRequestException('Yêu cầu khôi phục đã được xử lý');
        if (request.subject.status !== SubjectStatus.ARCHIVE) throw new BadRequestException('Môn học không còn ở trạng thái ARCHIVE');
        if (!dto.approved && !dto.reason?.trim()) throw new BadRequestException('Phải nhập lý do từ chối');

        const status = dto.approved ? SubjectRestoreRequestStatus.APPROVED : SubjectRestoreRequestStatus.REJECTED;
        const updated = await this.prisma.$transaction(async (tx) => {
            const value = await tx.subjectRestoreRequest.update({
                where: { id: request.id },
                data: { status, reviewedById: reviewer.id, reviewedAt: new Date(), rejectionReason: dto.approved ? null : dto.reason?.trim() }
            });
            if (dto.approved) await tx.subject.update({ where: { id: request.subjectId }, data: { status: SubjectStatus.PUBLIC } });
            return value;
        });
        await this.record(actorPublicId, dto.approved ? AuditAction.APPROVE : AuditAction.REJECT, 'khoi-phuc-mon-hoc', 'SubjectRestoreRequest', publicId, { status, reason: dto.reason });

        const departmentHeads = dto.approved
            ? await this.prisma.user.findMany({ where: { departmentId: request.subject.departmentId, role: UserRole.DEPARTMENT_HEAD, status: UserStatus.ACTIVE }, select: { id: true } })
            : [];
        await this.notifications.createMany([
            {
                recipientId: request.requestedById,
                type: dto.approved ? 'SUBJECT_RESTORE_APPROVED' : 'SUBJECT_RESTORE_REJECTED',
                title: dto.approved ? 'Môn học đã được khôi phục' : 'Yêu cầu khôi phục môn bị từ chối',
                message: dto.approved ? `Môn ${request.subject.code} đã được chuyển lại PUBLIC.` : `Yêu cầu khôi phục môn ${request.subject.code} bị từ chối. Lý do: ${dto.reason}`,
                data: { requestPublicId: request.publicId, subjectPublicId: request.subject.publicId, status }
            },
            ...departmentHeads.map((head) => ({
                recipientId: head.id,
                type: 'SUBJECT_AVAILABLE_FOR_CLASS_PROPOSAL',
                title: 'Môn học đã sẵn sàng mở lớp học phần',
                message: `Môn ${request.subject.code} đã được khôi phục. Bạn có thể đề xuất mở lớp học phần mới.`,
                data: { subjectPublicId: request.subject.publicId }
            }))
        ]);
        return updated;
    }

    listSubjectProposals() {
        return this.prisma.subjectProposal.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                department: { select: { publicId: true, code: true, name: true } },
                proposedBy: { select: { publicId: true, fullName: true } }
            }
        });
    }

    async createSubjectProposal(dto: CreateSubjectProposalDto, actorPublicId: string) {
        this.assertWeights(dto);
        const gradingPolicy = await this.settings.gradingPolicy();
        const actor = await this.requireActor(actorPublicId, UserRole.DEPARTMENT_HEAD);
        if (!actor.departmentId) throw new BadRequestException('Trưởng bộ môn chưa được gán phòng ban');
        const code = dto.code.trim().toUpperCase();
        const [existingSubject, existingProposal] = await Promise.all([
            this.prisma.subject.findUnique({ where: { code } }),
            this.prisma.subjectProposal.findFirst({ where: { code, status: { not: ProposalStatus.REJECTED } } })
        ]);
        if (existingSubject) throw new ConflictException(`Môn ${code} đã tồn tại với trạng thái ${existingSubject.status}`);
        if (existingProposal) throw new ConflictException(`Mã ${code} đã có trong một đề xuất môn học`);

        let proposal;
        try {
            proposal = await this.prisma.subjectProposal.create({ data: {
                code,
                name: dto.name.trim(),
                description: dto.description,
                credits: dto.credits,
                assignmentWeight: dto.assignmentWeight,
                quizWeight: dto.quizWeight,
                midtermWeight: dto.midtermWeight,
                finalWeight: dto.finalWeight,
                departmentId: actor.departmentId,
                proposedById: actor.id,
                status: ProposalStatus.DRAFT,
                passScore: dto.passScore ?? gradingPolicy.defaultPassScore
            } });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException(`Mã ${code} vừa được sử dụng bởi một yêu cầu khác`);
            }
            throw error;
        }
        await this.record(actorPublicId, AuditAction.CREATE, 'de-xuat-mon', 'SubjectProposal', proposal.publicId, { code, name: proposal.name });
        return proposal;
    }

    async updateSubjectProposal(publicId: string, dto: CreateSubjectProposalDto, actorPublicId: string) {
        this.assertWeights(dto);
        const actor = await this.requireActor(actorPublicId, UserRole.DEPARTMENT_HEAD);
        const proposal = await this.prisma.subjectProposal.findUnique({ where: { publicId } });
        if (!proposal) throw new NotFoundException('Không tìm thấy đề xuất môn học');
        if (proposal.proposedById !== actor.id) throw new ForbiddenException('Bạn không sở hữu đề xuất này');
        if (proposal.status !== ProposalStatus.DRAFT) throw new BadRequestException('Chỉ đề xuất nháp mới được chỉnh sửa');

        const code = dto.code.trim().toUpperCase();
        const [existingSubject, existingProposal] = await Promise.all([
            this.prisma.subject.findUnique({ where: { code } }),
            this.prisma.subjectProposal.findFirst({
                where: { code, id: { not: proposal.id }, status: { not: ProposalStatus.REJECTED } }
            })
        ]);
        if (existingSubject) throw new ConflictException(`Môn ${code} đã tồn tại với trạng thái ${existingSubject.status}`);
        if (existingProposal) throw new ConflictException(`Mã ${code} đã có trong một đề xuất môn học`);

        let updated;
        try {
            updated = await this.prisma.subjectProposal.update({
                where: { id: proposal.id },
                data: {
                    code,
                    name: dto.name.trim(),
                    description: dto.description,
                    credits: dto.credits,
                    assignmentWeight: dto.assignmentWeight,
                    quizWeight: dto.quizWeight,
                    midtermWeight: dto.midtermWeight,
                    finalWeight: dto.finalWeight,
                    ...(dto.passScore !== undefined ? { passScore: dto.passScore } : {})
                }
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException(`Mã ${code} vừa được sử dụng bởi một yêu cầu khác`);
            }
            throw error;
        }
        await this.record(actorPublicId, AuditAction.UPDATE, 'de-xuat-mon', 'SubjectProposal', publicId, { code, name: updated.name });
        return updated;
    }

    async removeSubjectProposal(publicId: string, actorPublicId: string) {
        const actor = await this.requireActor(actorPublicId, UserRole.DEPARTMENT_HEAD);
        const proposal = await this.prisma.subjectProposal.findUnique({ where: { publicId } });
        if (!proposal) throw new NotFoundException('Không tìm thấy đề xuất môn học');
        if (proposal.proposedById !== actor.id) throw new ForbiddenException('Bạn không sở hữu đề xuất này');
        if (proposal.status !== ProposalStatus.DRAFT) throw new BadRequestException('Chỉ đề xuất nháp mới được xóa');

        await this.prisma.subjectProposal.delete({ where: { id: proposal.id } });
        await this.record(actorPublicId, AuditAction.DELETE, 'de-xuat-mon', 'SubjectProposal', publicId, {
            code: proposal.code, name: proposal.name, status: proposal.status
        });
        return { message: 'Đã xóa đề xuất môn học' };
    }

    async resubmitSubjectProposal(publicId: string, actorPublicId: string) {
        const actor = await this.requireActor(actorPublicId, UserRole.DEPARTMENT_HEAD);
        const proposal = await this.prisma.subjectProposal.findUnique({ where: { publicId } });
        if (!proposal) throw new NotFoundException('Không tìm thấy đề xuất môn học');
        if (proposal.proposedById !== actor.id) throw new ForbiddenException('Bạn không sở hữu đề xuất này');
        if (proposal.status !== ProposalStatus.REJECTED) throw new BadRequestException('Chỉ đề xuất đã bị từ chối mới được đề xuất lại');

        const [existingSubject, existingProposal] = await Promise.all([
            this.prisma.subject.findUnique({ where: { code: proposal.code } }),
            this.prisma.subjectProposal.findFirst({
                where: { code: proposal.code, id: { not: proposal.id }, status: { not: ProposalStatus.REJECTED } }
            })
        ]);
        if (existingSubject) throw new ConflictException(`Môn ${proposal.code} đã tồn tại với trạng thái ${existingSubject.status}`);
        if (existingProposal) throw new ConflictException(`Mã ${proposal.code} đã có trong một đề xuất môn học khác`);

        const updated = await this.prisma.subjectProposal.update({
            where: { id: proposal.id },
            data: {
                status: ProposalStatus.DRAFT,
                rejectionReason: null,
                submittedAt: null,
                trainingReviewedById: null,
                trainingReviewedAt: null,
                principalReviewedById: null,
                principalReviewedAt: null
            }
        });
        await this.record(actorPublicId, AuditAction.UPDATE, 'de-xuat-mon', 'SubjectProposal', publicId, {
            action: 'RESUBMIT_AS_DRAFT', previousStatus: proposal.status, status: updated.status
        });
        return updated;
    }

    async submitSubjectProposal(publicId: string, actorPublicId: string) {
        const actor = await this.requireActor(actorPublicId, UserRole.DEPARTMENT_HEAD);
        const proposal = await this.prisma.subjectProposal.findUnique({ where: { publicId } });
        if (!proposal) throw new NotFoundException('Không tìm thấy đề xuất môn học');
        if (proposal.proposedById !== actor.id) throw new ForbiddenException('Bạn không sở hữu đề xuất này');
        if (proposal.status !== ProposalStatus.DRAFT) throw new BadRequestException('Chỉ đề xuất nháp mới được gửi duyệt');
        const updated = await this.prisma.subjectProposal.update({ where: { id: proposal.id }, data: { status: ProposalStatus.PENDING_TRAINING, submittedAt: new Date() } });
        await this.record(actorPublicId, AuditAction.UPDATE, 'de-xuat-mon', 'SubjectProposal', publicId, { status: updated.status });
        return updated;
    }

    async trainingReviewSubject(publicId: string, dto: ReviewProposalDto, actorPublicId: string) {
        const actor = await this.requireActor(actorPublicId, UserRole.TRAINING_OFFICER);
        const proposal = await this.prisma.subjectProposal.findUnique({ where: { publicId } });
        if (!proposal) throw new NotFoundException('Không tìm thấy đề xuất môn học');
        if (proposal.status !== ProposalStatus.PENDING_TRAINING) throw new BadRequestException('Đề xuất không ở bước Phòng đào tạo duyệt');
        if (!dto.approved && !dto.reason?.trim()) throw new BadRequestException('Phải nhập lý do từ chối');
        const status = dto.approved ? ProposalStatus.PENDING_PRINCIPAL : ProposalStatus.REJECTED;
        const updated = await this.prisma.subjectProposal.update({ where: { id: proposal.id }, data: {
            status, rejectionReason: dto.approved ? null : dto.reason, trainingReviewedById: actor.id, trainingReviewedAt: new Date()
        } });
        await this.record(actorPublicId, dto.approved ? AuditAction.APPROVE : AuditAction.REJECT, 'de-xuat-mon', 'SubjectProposal', publicId, { status, reason: dto.reason });
        await this.notifications.create({
            recipientId: proposal.proposedById,
            type: dto.approved ? 'SUBJECT_PROPOSAL_FORWARDED' : 'SUBJECT_PROPOSAL_REJECTED',
            title: dto.approved ? 'Đề xuất môn đã qua bước Phòng đào tạo' : 'Đề xuất môn bị từ chối',
            message: dto.approved
                ? `Đề xuất môn ${proposal.code} đã được chuyển lên Hiệu trưởng duyệt.`
                : `Đề xuất môn ${proposal.code} bị từ chối. Lý do: ${dto.reason}`,
            data: { proposalPublicId: proposal.publicId, status }
        });
        return updated;
    }

    async principalReviewSubject(publicId: string, dto: ReviewProposalDto, actorPublicId: string) {
        const actor = await this.requireActor(actorPublicId, UserRole.PRINCIPAL);
        const proposal = await this.prisma.subjectProposal.findUnique({ where: { publicId } });
        if (!proposal) throw new NotFoundException('Không tìm thấy đề xuất môn học');
        if (proposal.status !== ProposalStatus.PENDING_PRINCIPAL) throw new BadRequestException('Đề xuất chưa được Phòng đào tạo thông qua');
        if (!dto.approved && !dto.reason?.trim()) throw new BadRequestException('Phải nhập lý do từ chối');

        const result = await this.prisma.$transaction(async (tx) => {
            if (!dto.approved) return tx.subjectProposal.update({ where: { id: proposal.id }, data: {
                status: ProposalStatus.REJECTED, rejectionReason: dto.reason, principalReviewedById: actor.id, principalReviewedAt: new Date()
            } });
            if (await tx.subject.findUnique({ where: { code: proposal.code } })) throw new ConflictException('Mã môn học đã tồn tại');
            const subject = await tx.subject.create({ data: {
                code: proposal.code, name: proposal.name, description: proposal.description, credits: proposal.credits,
                assignmentWeight: proposal.assignmentWeight, quizWeight: proposal.quizWeight, midtermWeight: proposal.midtermWeight,
                finalWeight: proposal.finalWeight, passScore: proposal.passScore, departmentId: proposal.departmentId,
                status: SubjectStatus.PUBLIC
            } });
            return tx.subjectProposal.update({ where: { id: proposal.id }, data: {
                status: ProposalStatus.APPROVED, approvedSubjectId: subject.id, principalReviewedById: actor.id, principalReviewedAt: new Date(), rejectionReason: null
            } });
        });
        await this.record(actorPublicId, dto.approved ? AuditAction.APPROVE : AuditAction.REJECT, 'de-xuat-mon', 'SubjectProposal', publicId, { status: result.status, reason: dto.reason });
        await this.notifications.create({
            recipientId: proposal.proposedById,
            type: dto.approved ? 'SUBJECT_PROPOSAL_APPROVED' : 'SUBJECT_PROPOSAL_REJECTED',
            title: dto.approved ? 'Môn học mới đã được duyệt' : 'Đề xuất môn bị từ chối',
            message: dto.approved
                ? `Hiệu trưởng đã duyệt môn ${proposal.code} - ${proposal.name}.`
                : `Hiệu trưởng từ chối đề xuất môn ${proposal.code}. Lý do: ${dto.reason}`,
            data: { proposalPublicId: proposal.publicId, status: result.status }
        });
        if (dto.approved) {
            await this.notifications.create({
                recipientId: proposal.proposedById,
                type: 'SUBJECT_AVAILABLE_FOR_CLASS_PROPOSAL',
                title: 'Môn học đã sẵn sàng mở lớp học phần',
                message: `Môn ${proposal.code} đã được công khai. Bạn có thể đề xuất mở lớp học phần.`,
                data: { proposalPublicId: proposal.publicId }
            });
        }
        return result;
    }

    async addPrerequisite(subjectPublicId: string, dto: AddPrerequisiteDto, actorPublicId: string) {
        const [subject, prerequisite] = await Promise.all([
            this.prisma.subject.findUnique({ where: { publicId: subjectPublicId } }),
            this.prisma.subject.findUnique({ where: { publicId: dto.prerequisitePublicId } })
        ]);
        if (!subject || !prerequisite) throw new NotFoundException('Không tìm thấy môn học');
        if (subject.id === prerequisite.id) throw new BadRequestException('Môn học không thể là tiên quyết của chính nó');
        const edges = await this.prisma.subjectPrerequisite.findMany({ select: { subjectId: true, prerequisiteId: true } });
        const graph = new Map<number, number[]>();
        for (const edge of edges) graph.set(edge.subjectId, [...(graph.get(edge.subjectId) ?? []), edge.prerequisiteId]);
        const stack = [prerequisite.id];
        const visited = new Set<number>();
        while (stack.length) {
            const current = stack.pop()!;
            if (current === subject.id) throw new BadRequestException('Quan hệ tiên quyết tạo thành vòng lặp');
            if (visited.has(current)) continue;
            visited.add(current);
            stack.push(...(graph.get(current) ?? []));
        }
        await this.prisma.subjectPrerequisite.upsert({
            where: { subjectId_prerequisiteId: { subjectId: subject.id, prerequisiteId: prerequisite.id } },
            create: { subjectId: subject.id, prerequisiteId: prerequisite.id }, update: {}
        });
        await this.record(actorPublicId, AuditAction.UPDATE, 'mon-hoc', 'Subject', subjectPublicId, { prerequisiteCode: prerequisite.code });
        return { message: 'Đã thêm môn học tiên quyết' };
    }

    async listClassProposals(actor: { sub: string; role: UserRole }) {
        let departmentId: number | undefined;
        if (actor.role === UserRole.DEPARTMENT_HEAD) {
            const user = await this.prisma.user.findUnique({ where: { publicId: actor.sub }, select: { departmentId: true } });
            if (!user?.departmentId) throw new BadRequestException('Trưởng bộ môn chưa được gán bộ môn');
            departmentId = user.departmentId;
        }
        return this.prisma.classProposal.findMany({
            where: departmentId ? { subject: { departmentId } } : undefined,
            orderBy: { createdAt: 'desc' },
            include: {
                subject: true,
                proposedBy: { select: { publicId: true, fullName: true } },
                reviewedBy: { select: { publicId: true, fullName: true } },
                _count: { select: { classes: true } }
            }
        });
    }

    async createClassProposal(dto: CreateClassProposalDto, actorPublicId: string) {
        const actor = await this.requireActor(actorPublicId, UserRole.DEPARTMENT_HEAD);
        const subject = await this.prisma.subject.findUnique({ where: { publicId: dto.subjectPublicId } });
        if (!subject || subject.status !== SubjectStatus.PUBLIC) throw new NotFoundException('Không tìm thấy môn học đã công khai');
        if (!actor.departmentId || actor.departmentId !== subject.departmentId) throw new ForbiddenException('Bạn chỉ được đề xuất lớp học phần cho môn thuộc bộ môn của mình');
        const registrationStart = new Date(dto.registrationStart);
        const registrationEnd = new Date(dto.registrationEnd);
        if (registrationStart >= registrationEnd) throw new BadRequestException('Thời gian bắt đầu đăng ký phải trước thời gian kết thúc');
        const pendingProposal = await this.prisma.classProposal.findFirst({
            where: { subjectId: subject.id, status: ClassProposalStatus.PENDING },
            select: { publicId: true }
        });
        if (pendingProposal) throw new ConflictException('Môn học đã có đề xuất mở lớp học phần đang chờ Phòng đào tạo xử lý');
        const proposal = await this.prisma.classProposal.create({ data: {
            subjectId: subject.id, proposedById: actor.id,
            requestedClassCount: dto.requestedClassCount, maxStudentsPerClass: dto.maxStudentsPerClass,
            registrationStart, registrationEnd, note: dto.note
        } });
        await this.record(actorPublicId, AuditAction.CREATE, 'de-xuat-lop-hoc-phan', 'ClassProposal', proposal.publicId, { subjectCode: subject.code, requestedClassCount: dto.requestedClassCount });
        return proposal;
    }

    async reviewClassProposal(publicId: string, dto: ReviewProposalDto, actorPublicId: string) {
        const reviewer = await this.requireActor(actorPublicId, UserRole.TRAINING_OFFICER);
        const proposal = await this.prisma.classProposal.findUnique({ where: { publicId }, include: { subject: true } });
        if (!proposal) throw new NotFoundException('Không tìm thấy đề xuất lớp');
        if (proposal.status !== ClassProposalStatus.PENDING) throw new BadRequestException('Đề xuất lớp đã được xử lý');
        if (!dto.approved && !dto.reason?.trim()) throw new BadRequestException('Phải nhập lý do từ chối');

        const updated = await this.prisma.$transaction(async (tx) => {
            const status = dto.approved ? ClassProposalStatus.APPROVED : ClassProposalStatus.REJECTED;
            const result = await tx.classProposal.update({ where: { id: proposal.id }, data: { status, rejectionReason: dto.approved ? null : dto.reason, reviewedById: reviewer.id, reviewedAt: new Date() } });
            if (dto.approved) {
                const existingCount = await tx.class.count({ where: { subjectId: proposal.subjectId } });
                await tx.class.createMany({ data: Array.from({ length: proposal.requestedClassCount }, (_, index) => {
                    const order = existingCount + index + 1;
                    return {
                        code: `${proposal.subject.code}-${String(order).padStart(3, '0')}`,
                        name: `${proposal.subject.name} - Lớp ${order}`,
                        subjectId: proposal.subjectId, departmentId: proposal.subject.departmentId,
                        managerId: proposal.proposedById, classProposalId: proposal.id, maxStudents: proposal.maxStudentsPerClass,
                        registrationStart: proposal.registrationStart, registrationEnd: proposal.registrationEnd
                    };
                }) });
            }
            return result;
        });
        await this.record(actorPublicId, dto.approved ? AuditAction.APPROVE : AuditAction.REJECT, 'de-xuat-lop-hoc-phan', 'ClassProposal', publicId, { status: updated.status, reason: dto.reason });
        await this.notifications.create({
            recipientId: proposal.proposedById,
            type: dto.approved ? 'CLASS_PROPOSAL_APPROVED' : 'CLASS_PROPOSAL_REJECTED',
            title: dto.approved ? 'Đề xuất mở lớp học phần đã được duyệt' : 'Đề xuất mở lớp học phần bị từ chối',
            message: dto.approved
                ? `Phòng đào tạo đã duyệt mở ${proposal.requestedClassCount} lớp học phần cho môn ${proposal.subject.code}.`
                : `Phòng đào tạo từ chối đề xuất mở lớp học phần môn ${proposal.subject.code}. Lý do: ${dto.reason}`,
            data: { proposalPublicId: proposal.publicId, status: updated.status }
        });
        return updated;
    }

    async listClasses(actor: { sub: string; role: UserRole }) {
        const historyRoles = new Set<UserRole>([
            UserRole.ADMIN,
            UserRole.PRINCIPAL,
            UserRole.TRAINING_OFFICER,
            UserRole.DEPARTMENT_HEAD,
            UserRole.LECTURER
        ]);
        let departmentId: number | undefined;
        let lecturerId: number | undefined;

        if (actor.role === UserRole.DEPARTMENT_HEAD || actor.role === UserRole.LECTURER) {
            const user = await this.prisma.user.findUnique({
                where: { publicId: actor.sub },
                select: { id: true, departmentId: true }
            });
            if (!user) throw new NotFoundException('Không tìm thấy người dùng');
            if (actor.role === UserRole.DEPARTMENT_HEAD) {
                if (!user.departmentId) throw new BadRequestException('Trưởng bộ môn chưa được gán bộ môn');
                departmentId = user.departmentId;
            } else {
                lecturerId = user.id;
            }
        }

        return this.prisma.class.findMany({
            where: {
                ...(departmentId ? { departmentId } : {}),
                ...(lecturerId ? { lecturerId } : {}),
                ...(historyRoles.has(actor.role) ? {} : { status: { not: ClassStatus.COMPLETED } })
            },
            orderBy: { createdAt: 'desc' },
            include: {
                subject: true,
                department: true,
                manager: { select: { publicId: true, fullName: true } },
                lecturer: { select: { publicId: true, fullName: true } },
                schedules: true
            }
        });
    }

    async updateClass(publicId: string, dto: UpdateClassDto, actor: { sub: string; role: UserRole }) {
        const current = await this.prisma.class.findUnique({ where: { publicId }, include: { manager: true, subject: true } });
        if (!current) throw new NotFoundException('Không tìm thấy lớp học');
        if (current.status === ClassStatus.COMPLETED) throw new BadRequestException('Lớp học phần đã hoàn thành và chỉ được phép xem dữ liệu');
        if (actor.role === UserRole.DEPARTMENT_HEAD) {
            const departmentHead = await this.prisma.user.findUnique({ where: { publicId: actor.sub }, select: { departmentId: true } });
            if (!departmentHead?.departmentId || departmentHead.departmentId !== current.departmentId) {
                throw new ForbiddenException('Bạn chỉ được quản lý lớp học phần thuộc bộ môn hiện tại của mình');
            }
        }
        let lecturerId: number | undefined;
        if (dto.lecturerPublicId) {
            const lecturer = await this.prisma.user.findUnique({ where: { publicId: dto.lecturerPublicId } });
            if (!lecturer || lecturer.role !== UserRole.LECTURER || lecturer.departmentId !== current.departmentId) throw new BadRequestException('Giảng viên không hợp lệ hoặc không cùng bộ môn');
            lecturerId = lecturer.id;
        }
        if (dto.schedules?.some((item) => item.startTime >= item.endTime)) throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
        const updated = await this.prisma.$transaction(async (tx) => {
            const value = await tx.class.update({ where: { id: current.id }, data: {
                name: dto.name, maxStudents: dto.maxStudents,
                registrationStart: dto.registrationStart ? new Date(dto.registrationStart) : undefined,
                registrationEnd: dto.registrationEnd ? new Date(dto.registrationEnd) : undefined,
                status: dto.status, lecturerId
            } });
            if (dto.schedules) {
                await tx.classSchedule.deleteMany({ where: { classId: current.id } });
                if (dto.schedules.length) await tx.classSchedule.createMany({ data: dto.schedules.map((item) => ({ ...item, classId: current.id })) });
            }
            return value;
        });
        await this.record(actor.sub, lecturerId ? AuditAction.ASSIGN : AuditAction.UPDATE, 'lop-hoc', 'Class', publicId, { status: updated.status, lecturerPublicId: dto.lecturerPublicId });
        if (current.status !== ClassStatus.OPEN_REGISTRATION && updated.status === ClassStatus.OPEN_REGISTRATION) {
            const students = await this.prisma.user.findMany({
                where: {
                    role: UserRole.STUDENT,
                    status: UserStatus.ACTIVE
                },
                select: { id: true }
            });
            await this.notifications.createMany(students.map((student) => ({
                recipientId: student.id,
                type: 'CLASS_REGISTRATION_OPENED',
                title: 'Lớp học mới đã mở đăng ký',
                message: `Lớp ${updated.code} - ${updated.name} đã mở đăng ký.`,
                data: { classPublicId: updated.publicId }
            })));
        }
        return this.prisma.class.findUnique({ where: { id: current.id }, include: { schedules: true, lecturer: { select: { publicId: true, fullName: true } } } });
    }

    private async requireActor(publicId: string, expectedRole: UserRole) {
        const actor = await this.prisma.user.findUnique({ where: { publicId } });
        if (!actor || actor.role !== expectedRole) throw new ForbiddenException('Vai trò không hợp lệ');
        return actor;
    }

    private assertWeights(dto: CreateSubjectProposalDto) {
        const total = dto.assignmentWeight + dto.quizWeight + dto.midtermWeight + dto.finalWeight;
        if (Math.abs(total - 100) > 0.001) throw new BadRequestException('Tổng tỷ lệ các nhóm điểm phải bằng 100%');
    }

    private record(actorPublicId: string, action: AuditAction, module: string, targetType: string, targetPublicId: string, newValue: Prisma.InputJsonValue) {
        return this.audit.record({ actorPublicId, action, module, targetType, targetPublicId, newValue });
    }
}
