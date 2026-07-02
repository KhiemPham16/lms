import { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { useSearchParams } from 'react-router-dom';
import {
    FiAlertCircle,
    FiBookOpen,
    FiCheckCircle,
    FiClipboard,
    FiEdit3,
    FiEye,
    FiFilter,
    FiPauseCircle,
    FiPlayCircle,
    FiPlus,
    FiRefreshCw,
    FiSave,
    FiSearch,
    FiSend,
    FiShield,
    FiUserCheck,
    FiUsers,
    FiX,
    FiXCircle
} from 'react-icons/fi';
import { toast } from 'sonner';

import AppSidebar from '~/components/AppSidebar';
import { getApiErrorMessage, getPayloadItems, unwrapApiPayload } from '~/lib/apiPayload';
import { courseService } from '~/services/courseService';
import { departmentService } from '~/services/departmentService';
import { userService } from '~/services/userService';
import { useAuthStore } from '~/stores/useAuthStore';
import { normalizeRole, userHasBackendPermission } from '~/utils/permissions';
import layoutStyles from '~/pages/FlowWorkbench/FlowWorkbench.module.scss';
import courseStyles from './Courses.module.scss';

const styles = { ...layoutStyles, ...courseStyles };
const cx = classNames.bind(styles);

const draftStorageKey = 'edulms-course-drafts';

const workspaceLabels = {
    admin: 'Quản trị hệ thống',
    training: 'Phòng đào tạo',
    department: 'Trưởng bộ môn',
    principal: 'Hiệu trưởng',
    teacher: 'Giảng viên'
};

const statusLabels = {
    DRAFT: 'Draft',
    PENDING_PDT: 'pending-approval',
    PDT_APPROVED: 'APPROVED',
    PENDING_PRINCIPAL: 'pending-approval',
    PRINCIPAL_APPROVED: 'APPROVED',
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    PDT_REJECTED: 'REJECTED',
    PRINCIPAL_REJECTED: 'REJECTED'
};

const statusDescriptions = {
    DRAFT: 'Bản nháp đang chuẩn bị đề xuất',
    PENDING_PDT: 'Đợi Phòng đào tạo kiểm tra',
    PDT_APPROVED: 'Phòng đào tạo đã duyệt',
    PENDING_PRINCIPAL: 'Đợi Hiệu trưởng duyệt',
    PRINCIPAL_APPROVED: 'Đã được duyệt, chờ kích hoạt',
    ACTIVE: 'Đang hoạt động, có thể tạo lớp',
    INACTIVE: 'Ngừng hoạt động, không tạo lớp mới',
    PDT_REJECTED: 'Phòng đào tạo từ chối',
    PRINCIPAL_REJECTED: 'Hiệu trưởng từ chối'
};

const statusOptions = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'PENDING_PDT', label: 'Đợi Phòng đào tạo' },
    { value: 'PENDING_PRINCIPAL', label: 'Đợi Hiệu trưởng' },
    { value: 'ACTIVE', label: 'ACTIVE' },
    { value: 'INACTIVE', label: 'INACTIVE' },
    { value: 'PDT_REJECTED', label: 'PDT từ chối' },
    { value: 'PRINCIPAL_REJECTED', label: 'Hiệu trưởng từ chối' }
];

const emptyCourseForm = {
    code: '',
    name: '',
    description: '',
    credits: 3,
    requestedClassCount: 1,
    departmentId: ''
};

const getRoleCode = (user) => normalizeRole(user?.role?.code || user?.role || user?.roleDetail?.code);
const getCourseId = (course) => course?.publicId || course?.localId;
const isDraftCourseId = (value) => String(value || '').startsWith('draft-');
const isActiveCourse = (course) => course?.status === 'ACTIVE';
const isLocalDraft = (course) => Boolean(course?.localDraft);
const isRejectedCourse = (course) => ['PDT_REJECTED', 'PRINCIPAL_REJECTED'].includes(course?.status);
const isNonActiveCourse = (course) => !isActiveCourse(course);
const asNumber = (value) => (value === '' || value === null || value === undefined ? undefined : Number(value));
const normalizeItems = (payload) => {
    const unwrapped = unwrapApiPayload(payload);
    return unwrapped?.items || unwrapped || [];
};

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const normalizeDepartmentValue = (department) =>
    String(department?.id || department?.departmentId || department?.publicId || '');

const readDrafts = () => {
    if (typeof window === 'undefined') return [];

    try {
        return JSON.parse(window.localStorage.getItem(draftStorageKey) || '[]');
    } catch (error) {
        console.error(error);
        return [];
    }
};

const writeDrafts = (drafts) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(draftStorageKey, JSON.stringify(drafts));
};

function Field({ label, children, hint, error }) {
    return (
        <label className={cx('courses__field')}>
            <span>{label}</span>
            {children}
            {hint ? <small>{hint}</small> : null}
            {error ? <em>{error}</em> : null}
        </label>
    );
}

function StatusPill({ status }) {
    return (
        <span className={cx('courses__status', `is-${String(status || 'DRAFT').toLowerCase().replaceAll('_', '-')}`)}>
            {statusLabels[status] || status || 'Draft'}
        </span>
    );
}

function EmptyState({ icon: Icon = FiBookOpen, title, message }) {
    return (
        <section className={cx('courses__empty')}>
            <Icon />
            <h2>{title}</h2>
            <p>{message}</p>
        </section>
    );
}

function CourseRow({ course, onDetail, canCreateClass }) {
    return (
        <article className={cx('courses__row', { 'is-active-course': isActiveCourse(course) })}>
            <div className={cx('courses__course-main')}>
                <strong>{course.code}</strong>
                <span>{course.name}</span>
                <small>{course.department?.name || course.departmentName || 'Chưa chọn bộ môn'}</small>
            </div>
            <div>
                <StatusPill status={course.status} />
                <small>{statusDescriptions[course.status] || 'Đang xử lý'}</small>
            </div>
            <div>
                <strong>{course.credits || 0}</strong>
                <small>Tín chỉ</small>
            </div>
            <div>
                <strong>{course.classCount || 0}</strong>
                <small>Lớp đã có</small>
            </div>
            <div>
                <strong>{course.requestedClassCount || 0}</strong>
                <small>Lớp đề xuất</small>
            </div>
            <footer>
                {canCreateClass && isActiveCourse(course) ? (
                    <button type="button" onClick={() => toast.info('Chọn module Lớp học để tạo lớp từ môn ACTIVE này.')}>
                        <FiPlus /> Tạo lớp
                    </button>
                ) : null}
                <button type="button" className={cx('is-primary')} onClick={() => onDetail(course)}>
                    <FiEye /> Chi tiết
                </button>
            </footer>
        </article>
    );
}

function CourseSection({ title, subtitle, courses, emptyTitle, emptyMessage, onDetail, canCreateClass }) {
    return (
        <section className={cx('courses__section')}>
            <header>
                <div>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>
                <strong>{courses.length.toLocaleString('vi-VN')}</strong>
            </header>
            {courses.length ? (
                <div className={cx('courses__list')}>
                    {courses.map((course) => (
                        <CourseRow
                            key={getCourseId(course)}
                            course={course}
                            onDetail={onDetail}
                            canCreateClass={canCreateClass}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState title={emptyTitle} message={emptyMessage} />
            )}
        </section>
    );
}

function CourseForm({ title, subtitle, departments, initialValue, loading, onCancel, onSaveDraft, onSubmitProposal, onUpdate }) {
    const [form, setForm] = useState(initialValue || emptyCourseForm);
    const [errors, setErrors] = useState({});

    const setValue = (key, value) => {
        setForm((current) => ({ ...current, [key]: value }));
        setErrors((current) => ({ ...current, [key]: '' }));
    };

    const validate = () => {
        const nextErrors = {};

        if (!form.code.trim()) nextErrors.code = 'Nhập mã môn học';
        if (!form.name.trim()) nextErrors.name = 'Nhập tên môn học';
        if (!Number.isFinite(Number(form.credits)) || Number(form.credits) < 1) nextErrors.credits = 'Tín chỉ phải từ 1';
        if (!Number.isFinite(Number(form.requestedClassCount)) || Number(form.requestedClassCount) < 1) {
            nextErrors.requestedClassCount = 'Số lớp đề xuất phải từ 1';
        }
        if (!form.departmentId) nextErrors.departmentId = 'Chọn bộ môn phụ trách';

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const payload = () => ({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        credits: Number(form.credits),
        requestedClassCount: Number(form.requestedClassCount),
        departmentId: asNumber(form.departmentId)
    });

    const handleAction = (action) => {
        if (!validate()) return;
        action(payload());
    };

    return (
        <section className={cx('courses__form-page')}>
            <header>
                <div>
                    <span>Môn học</span>
                    <h1>{title}</h1>
                    <p>{subtitle}</p>
                </div>
                <button type="button" onClick={onCancel}>
                    <FiX /> Đóng
                </button>
            </header>

            <div className={cx('courses__form-grid')}>
                <Field label="Mã môn học" error={errors.code} hint="BR-SUB-01: mã môn không được trùng.">
                    <input value={form.code} onChange={(event) => setValue('code', event.target.value)} placeholder="VD: WEB101" />
                </Field>
                <Field label="Tên môn học" error={errors.name}>
                    <input value={form.name} onChange={(event) => setValue('name', event.target.value)} placeholder="VD: Lập trình Web" />
                </Field>
                <Field label="Bộ môn phụ trách" error={errors.departmentId} hint="Trưởng bộ môn chỉ đề xuất trong bộ môn được phân công.">
                    <select value={form.departmentId} onChange={(event) => setValue('departmentId', event.target.value)}>
                        <option value="">Chọn bộ môn</option>
                        {departments.map((department) => (
                            <option key={normalizeDepartmentValue(department)} value={normalizeDepartmentValue(department)}>
                                {department.name || department.code}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Số tín chỉ" error={errors.credits}>
                    <input type="number" min="1" value={form.credits} onChange={(event) => setValue('credits', event.target.value)} />
                </Field>
                <Field label="Số lớp đề xuất" error={errors.requestedClassCount}>
                    <input
                        type="number"
                        min="1"
                        value={form.requestedClassCount}
                        onChange={(event) => setValue('requestedClassCount', event.target.value)}
                    />
                </Field>
                <Field label="Mô tả môn học">
                    <textarea value={form.description || ''} onChange={(event) => setValue('description', event.target.value)} placeholder="Mục tiêu, phạm vi kiến thức, ghi chú mở môn..." />
                </Field>
            </div>

            <footer>
                {onSaveDraft ? (
                    <button type="button" onClick={() => handleAction(onSaveDraft)} disabled={loading}>
                        <FiSave /> Lưu bản nháp
                    </button>
                ) : null}
                {onUpdate ? (
                    <button type="button" className={cx('is-primary')} onClick={() => handleAction(onUpdate)} disabled={loading}>
                        <FiSave /> Lưu thay đổi
                    </button>
                ) : null}
                {onSubmitProposal ? (
                    <button type="button" className={cx('is-primary')} onClick={() => handleAction(onSubmitProposal)} disabled={loading}>
                        <FiSend /> Đề xuất phê duyệt
                    </button>
                ) : null}
            </footer>
        </section>
    );
}

export default function CoursesPage({ workspaceKey = 'training' }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const currentUser = useAuthStore((state) => state.user);
    const roleCode = getRoleCode(currentUser);
    const canRead = userHasBackendPermission(currentUser, 'courses.read');
    const canUpdate = userHasBackendPermission(currentUser, 'courses.update');
    const canCreateProposal = userHasBackendPermission(currentUser, 'course_proposals.create');
    const canApprove = userHasBackendPermission(currentUser, 'course_proposals.approve');
    const canCreateClass = userHasBackendPermission(currentUser, 'classes.create');
    const canAssignLecturer = userHasBackendPermission(currentUser, 'classes.assign_lecturer');
    const workspaceLabel = workspaceLabels[workspaceKey] || 'EduLMS';

    const [courses, setCourses] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [drafts, setDrafts] = useState(() => readDrafts());
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState(searchParams.get('q') || '');
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
    const [departmentFilter, setDepartmentFilter] = useState(searchParams.get('departmentId') || '');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [assignmentMode, setAssignmentMode] = useState('');
    const [departmentHeads, setDepartmentHeads] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [selectedDepartmentHeadId, setSelectedDepartmentHeadId] = useState('');
    const [selectedLecturerIds, setSelectedLecturerIds] = useState([]);

    const viewMode = searchParams.get('view');
    const selectedCourseId = searchParams.get('course');

    const loadCourses = useCallback(async () => {
        if (!canRead) return;
        setLoading(true);

        try {
            const payload = await courseService.getCourses({
                keyword: search || undefined,
                status: statusFilter || undefined,
                departmentId: asNumber(departmentFilter),
                page: 1,
                limit: 100
            });
            setCourses(getPayloadItems(payload));
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không tải được danh sách môn học'));
        } finally {
            setLoading(false);
        }
    }, [canRead, departmentFilter, search, statusFilter]);

    const loadDepartments = useCallback(async () => {
        try {
            const payload = await departmentService.getDepartments();
            setDepartments(normalizeItems(payload));
        } catch (error) {
            console.error(error);
            setDepartments([]);
        }
    }, []);

    const loadAssignees = useCallback(async (departmentId) => {
        if (!departmentId) return;

        try {
            const [headsPayload, lecturersPayload] = await Promise.all([
                userService.getUsers({ role: 'DEPARTMENT_HEAD', status: 'ACTIVE', departmentId, page: 1, limit: 100 }),
                userService.getUsers({ role: 'LECTURER', status: 'ACTIVE', departmentId, page: 1, limit: 100 })
            ]);
            setDepartmentHeads(normalizeItems(headsPayload));
            setLecturers(normalizeItems(lecturersPayload));
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không tải được danh sách nhân sự bộ môn'));
        }
    }, []);

    useEffect(() => {
        const handle = window.setTimeout(loadDepartments, 0);
        return () => window.clearTimeout(handle);
    }, [loadDepartments]);

    useEffect(() => {
        const handle = window.setTimeout(loadCourses, 300);
        return () => window.clearTimeout(handle);
    }, [loadCourses]);

    useEffect(() => {
        const nextParams = new URLSearchParams(searchParams);
        if (search) nextParams.set('q', search);
        else nextParams.delete('q');
        if (statusFilter) nextParams.set('status', statusFilter);
        else nextParams.delete('status');
        if (departmentFilter) nextParams.set('departmentId', departmentFilter);
        else nextParams.delete('departmentId');
        setSearchParams(nextParams, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, statusFilter, departmentFilter]);

    const mergedCourses = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        const filteredDrafts = drafts.filter((draft) => {
            const matchesSearch =
                !normalizedSearch ||
                draft.code?.toLowerCase().includes(normalizedSearch) ||
                draft.name?.toLowerCase().includes(normalizedSearch);
            const matchesStatus = !statusFilter || draft.status === statusFilter;
            const matchesDepartment = !departmentFilter || String(draft.departmentId) === String(departmentFilter);
            return matchesSearch && matchesStatus && matchesDepartment;
        });

        return [...filteredDrafts, ...courses];
    }, [courses, departmentFilter, drafts, search, statusFilter]);

    const nonActiveCourses = useMemo(() => mergedCourses.filter(isNonActiveCourse), [mergedCourses]);
    const activeCourses = useMemo(() => mergedCourses.filter(isActiveCourse), [mergedCourses]);

    const selectedDraft = useMemo(
        () => drafts.find((draft) => draft.localId === selectedCourseId),
        [drafts, selectedCourseId]
    );

    useEffect(() => {
        if (!selectedCourseId) {
            const handle = window.setTimeout(() => {
                setSelectedCourse(null);
                setEditMode(false);
                setAssignmentMode('');
            }, 0);
            return () => window.clearTimeout(handle);
        }

        if (selectedDraft) {
            const handle = window.setTimeout(() => {
                setSelectedCourse(selectedDraft);
            }, 0);
            return () => window.clearTimeout(handle);
        }

        if (isDraftCourseId(selectedCourseId)) {
            const handle = window.setTimeout(() => {
                setSelectedCourse(null);
            }, 0);
            return () => window.clearTimeout(handle);
        }

        if (!canRead) {
            return;
        }

        const loadDetail = async () => {
            try {
                const detail = await courseService.getCourse(selectedCourseId);
                setSelectedCourse(detail);
                loadAssignees(detail.departmentId);
            } catch (error) {
                toast.error(getApiErrorMessage(error, 'Không tải được chi tiết môn học'));
            }
        };

        loadDetail();
        return undefined;
    }, [canRead, loadAssignees, selectedCourseId, selectedDraft]);

    useEffect(() => {
        if (!selectedCourse) return undefined;

        const handle = window.setTimeout(() => {
            setSelectedDepartmentHeadId(selectedCourse.departmentHeadId ? String(selectedCourse.departmentHeadId) : '');
            setSelectedLecturerIds((selectedCourse.lecturers || []).map((lecturer) => String(lecturer.id)).filter(Boolean));
        }, 0);

        return () => window.clearTimeout(handle);
    }, [selectedCourse]);

    const openCreatePage = () => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('view', 'create');
        nextParams.delete('course');
        setSearchParams(nextParams);
    };

    const closePanel = () => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('view');
        nextParams.delete('course');
        setSearchParams(nextParams);
        setSelectedCourse(null);
        setEditMode(false);
        setAssignmentMode('');
    };

    const openDetail = (course) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('view');
        nextParams.set('course', getCourseId(course));
        setSearchParams(nextParams);
        setSelectedCourse(course);
        if (!isLocalDraft(course)) {
            loadAssignees(course.departmentId);
        }
    };

    const saveDraft = (payload) => {
        const duplicate = mergedCourses.some((course) => course.code === payload.code);

        if (duplicate) {
            toast.error('Mã môn học đã tồn tại. Vui lòng chọn mã khác.');
            return;
        }

        const department = departments.find((item) => normalizeDepartmentValue(item) === String(payload.departmentId));
        const draft = {
            ...payload,
            localId: `draft-${Date.now()}`,
            localDraft: true,
            status: 'DRAFT',
            department: department ? { name: department.name, code: department.code } : undefined,
            createdAt: new Date().toISOString()
        };
        const nextDrafts = [draft, ...drafts];
        setDrafts(nextDrafts);
        writeDrafts(nextDrafts);
        toast.success('Đã lưu bản nháp môn học');
        closePanel();
    };

    const submitProposal = async (payload, draftId) => {
        const duplicateDraft = !draftId && drafts.some((draft) => draft.code === payload.code);

        if (duplicateDraft) {
            toast.error('Mã môn học đang có trong bản nháp. Mở bản nháp để gửi đề xuất hoặc đổi mã.');
            return;
        }

        setSubmitting(true);
        try {
            await courseService.createProposal(payload);
            if (draftId) {
                const nextDrafts = drafts.filter((draft) => draft.localId !== draftId);
                setDrafts(nextDrafts);
                writeDrafts(nextDrafts);
            }
            toast.success('Đã gửi đề xuất môn học');
            closePanel();
            loadCourses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không gửi được đề xuất môn học'));
        } finally {
            setSubmitting(false);
        }
    };

    const updateCourse = async (payload) => {
        if (!selectedCourse?.publicId) return;
        setSubmitting(true);

        try {
            const updated = await courseService.updateCourse(selectedCourse.publicId, payload);
            setSelectedCourse(updated);
            setEditMode(false);
            toast.success('Đã cập nhật môn học');
            loadCourses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không cập nhật được môn học'));
        } finally {
            setSubmitting(false);
        }
    };

    const decideCourse = async (action, level) => {
        if (!selectedCourse?.publicId) return;
        setSubmitting(true);

        try {
            const service =
                level === 'PDT' ? courseService.decideByTrainingOffice : courseService.decideByPrincipal;
            const updated = await service(selectedCourse.publicId, { action });
            setSelectedCourse(updated);
            toast.success(action === 'APPROVED' ? 'Đã duyệt đề xuất môn học' : 'Đã từ chối đề xuất môn học');
            loadCourses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không xử lý được đề xuất'));
        } finally {
            setSubmitting(false);
        }
    };

    const assignDepartmentHead = async () => {
        if (!selectedCourse?.publicId || !selectedDepartmentHeadId) {
            toast.error('Vui lòng chọn Trưởng bộ môn');
            return;
        }

        setSubmitting(true);
        try {
            const updated = await courseService.assignDepartmentHead(selectedCourse.publicId, {
                departmentHeadId: Number(selectedDepartmentHeadId)
            });
            setSelectedCourse(updated);
            setAssignmentMode('');
            toast.success('Đã gán Trưởng bộ môn');
            loadCourses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không gán được Trưởng bộ môn'));
        } finally {
            setSubmitting(false);
        }
    };

    const toggleLecturer = (lecturerId) => {
        setSelectedLecturerIds((current) =>
            current.includes(lecturerId) ? current.filter((id) => id !== lecturerId) : [...current, lecturerId]
        );
    };

    const assignLecturers = async () => {
        if (!selectedCourse?.publicId || selectedLecturerIds.length === 0) {
            toast.error('Vui lòng chọn ít nhất một Giảng viên');
            return;
        }

        setSubmitting(true);
        try {
            const updated = await courseService.assignLecturers(selectedCourse.publicId, {
                lecturerIds: selectedLecturerIds.map(Number)
            });
            setSelectedCourse(updated);
            setAssignmentMode('');
            toast.success('Đã gán Giảng viên');
            loadCourses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không gán được Giảng viên'));
        } finally {
            setSubmitting(false);
        }
    };

    const updateCourseStatus = async (status) => {
        if (!selectedCourse?.publicId) return;

        setSubmitting(true);
        try {
            const updated = await courseService.updateStatus(selectedCourse.publicId, { status });
            setSelectedCourse(updated);
            toast.success(status === 'ACTIVE' ? 'Đã kích hoạt môn học' : 'Đã vô hiệu hóa môn học');
            loadCourses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không cập nhật được trạng thái môn học'));
        } finally {
            setSubmitting(false);
        }
    };

    const reproposeRejectedCourse = async () => {
        if (!selectedCourse?.publicId) return;

        await submitProposal({
            code: selectedCourse.code,
            name: selectedCourse.name,
            description: selectedCourse.description || undefined,
            credits: Number(selectedCourse.credits),
            requestedClassCount: Number(selectedCourse.requestedClassCount || 1),
            departmentId: Number(selectedCourse.departmentId)
        });
    };

    const deleteRejectedCourse = async () => {
        if (!selectedCourse?.publicId) return;
        const confirmed = window.confirm('Xóa đề xuất môn học đã bị từ chối? Thao tác này không thể hoàn tác.');

        if (!confirmed) return;

        setSubmitting(true);
        try {
            await courseService.deleteCourse(selectedCourse.publicId);
            toast.success('Đã xóa đề xuất môn học');
            closePanel();
            loadCourses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không xóa được đề xuất môn học'));
        } finally {
            setSubmitting(false);
        }
    };

    const detailInitialValue = selectedCourse
        ? {
              code: selectedCourse.code || '',
              name: selectedCourse.name || '',
              description: selectedCourse.description || '',
              credits: selectedCourse.credits || 3,
              requestedClassCount: selectedCourse.requestedClassCount || 1,
              departmentId: selectedCourse.departmentId || ''
          }
        : emptyCourseForm;

    if (!canRead) {
        return (
            <div className={cx('flow-shell')}>
                <AppSidebar workspaceKey={workspaceKey} />
                <main className={cx('flow-main', 'courses')}>
                    <EmptyState
                        icon={FiShield}
                        title="Bạn chưa có quyền xem môn học"
                        message="Vui lòng liên hệ Admin để được cấp quyền courses.read."
                    />
                </main>
            </div>
        );
    }

    if (viewMode === 'create') {
        return (
            <div className={cx('flow-shell')}>
                <AppSidebar workspaceKey={workspaceKey} />
                <main className={cx('flow-main', 'courses')}>
                    <CourseForm
                        title="Tạo môn học mới"
                        subtitle="Lưu bản nháp để hoàn thiện sau hoặc gửi đề xuất vào luồng duyệt môn học."
                        departments={departments}
                        loading={submitting}
                        onCancel={closePanel}
                        onSaveDraft={saveDraft}
                        onSubmitProposal={(payload) => submitProposal(payload)}
                    />
                </main>
            </div>
        );
    }

    return (
        <div className={cx('flow-shell')}>
            <AppSidebar workspaceKey={workspaceKey} />
            <main className={cx('flow-main', 'courses')}>
                <section className={cx('courses__hero')}>
                    <div>
                        <span>{workspaceLabel} / Môn học</span>
                        <h1>Quản lý Môn học</h1>
                        <p>Tra cứu danh mục môn, theo dõi đề xuất và chỉ tạo lớp khi môn đã ACTIVE.</p>
                    </div>
                    <div>
                        <button type="button" onClick={loadCourses} disabled={loading}>
                            <FiRefreshCw /> Làm mới
                        </button>
                        {canCreateProposal ? (
                            <button type="button" className={cx('is-primary')} onClick={openCreatePage}>
                                <FiPlus /> Tạo môn
                            </button>
                        ) : null}
                    </div>
                </section>

                <section className={cx('courses__filters')}>
                    <label className={cx('courses__search')}>
                        <FiSearch />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Tìm theo mã hoặc tên môn học"
                        />
                    </label>
                    <label>
                        <FiFilter />
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            {statusOptions.map((option) => (
                                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                        <option value="">Tất cả bộ môn</option>
                        {departments.map((department) => (
                            <option key={normalizeDepartmentValue(department)} value={normalizeDepartmentValue(department)}>
                                {department.name || department.code}
                            </option>
                        ))}
                    </select>
                </section>

                <section className={cx('courses__rules')}>
                    <article><FiShield /><strong>BR-SUB-01</strong><span>Mã môn học không được trùng.</span></article>
                    <article><FiCheckCircle /><strong>BR-SUB-02</strong><span>Chỉ môn ACTIVE mới được tạo lớp.</span></article>
                    <article><FiClipboard /><strong>BR-SUB-03</strong><span>Môn mới phải được Hiệu trưởng duyệt trước.</span></article>
                    <article><FiPauseCircle /><strong>BR-SUB-05</strong><span>Vô hiệu hóa môn vẫn giữ lớp và điểm cũ.</span></article>
                </section>

                <CourseSection
                    title="Môn chưa active và đề xuất"
                    subtitle="Draft, pending-approval, APPROVED chờ kích hoạt, INACTIVE và REJECTED."
                    courses={nonActiveCourses}
                    emptyTitle="Không có môn đang chờ xử lý"
                    emptyMessage="Các bản nháp và đề xuất môn học sẽ xuất hiện tại đây."
                    onDetail={openDetail}
                    canCreateClass={canCreateClass}
                />

                <CourseSection
                    title="Môn đang ACTIVE"
                    subtitle="Danh mục môn chính thức có thể dùng để tạo lớp học."
                    courses={activeCourses}
                    emptyTitle="Chưa có môn ACTIVE"
                    emptyMessage="Sau khi Hiệu trưởng duyệt, môn sẽ chuyển sang ACTIVE và xuất hiện ở danh sách này."
                    onDetail={openDetail}
                    canCreateClass={canCreateClass}
                />

                {selectedCourse ? (
                    <div className={cx('courses__backdrop')}>
                        <aside className={cx('courses__detail')}>
                            <header>
                                <div>
                                    <span>Chi tiết môn học</span>
                                    <h2>{selectedCourse.name}</h2>
                                    <p>{selectedCourse.code}</p>
                                </div>
                                <button type="button" onClick={closePanel} aria-label="Đóng">
                                    <FiX />
                                </button>
                            </header>

                            {editMode ? (
                                <CourseForm
                                    key={selectedCourse.publicId || selectedCourse.localId}
                                    title="Chỉnh sửa môn học"
                                    subtitle="Chỉ các môn chưa khóa luồng duyệt hoặc chưa ACTIVE mới cập nhật được."
                                    departments={departments}
                                    initialValue={detailInitialValue}
                                    loading={submitting}
                                    onCancel={() => setEditMode(false)}
                                    onUpdate={updateCourse}
                                />
                            ) : (
                                <>
                                    <section className={cx('courses__detail-summary')}>
                                        <div>
                                            <StatusPill status={selectedCourse.status} />
                                            <p>{statusDescriptions[selectedCourse.status]}</p>
                                        </div>
                                        <dl>
                                            <div><dt>Bộ môn</dt><dd>{selectedCourse.department?.name || 'Chưa có'}</dd></div>
                                            <div><dt>Trưởng bộ môn</dt><dd>{selectedCourse.departmentHead?.fullName || 'Chưa gán'}</dd></div>
                                            <div><dt>Giảng viên</dt><dd>{(selectedCourse.lecturers || []).length || 'Chưa gán'}</dd></div>
                                            <div><dt>Tín chỉ</dt><dd>{selectedCourse.credits}</dd></div>
                                            <div><dt>Lớp đề xuất</dt><dd>{selectedCourse.requestedClassCount || 0}</dd></div>
                                            <div><dt>Lớp đã có</dt><dd>{selectedCourse.classCount || 0}</dd></div>
                                            <div><dt>Người đề xuất</dt><dd>{selectedCourse.proposedBy?.fullName || 'Bản nháp cục bộ'}</dd></div>
                                            <div><dt>Cập nhật</dt><dd>{formatDateTime(selectedCourse.updatedAt || selectedCourse.createdAt)}</dd></div>
                                        </dl>
                                        <p>{selectedCourse.description || 'Chưa có mô tả môn học.'}</p>
                                    </section>

                                    <section className={cx('courses__actions')}>
                                        {canUpdate && !isLocalDraft(selectedCourse) ? (
                                            <button type="button" onClick={() => setEditMode(true)}>
                                                <FiEdit3 /> Chỉnh sửa
                                            </button>
                                        ) : null}
                                        {canUpdate && !isLocalDraft(selectedCourse) ? (
                                            <button type="button" onClick={() => setAssignmentMode((mode) => (mode === 'head' ? '' : 'head'))}>
                                                <FiUserCheck /> Gán trưởng bộ môn
                                            </button>
                                        ) : null}
                                        {canAssignLecturer && !isLocalDraft(selectedCourse) ? (
                                            <button type="button" onClick={() => setAssignmentMode((mode) => (mode === 'lecturers' ? '' : 'lecturers'))}>
                                                <FiUsers /> Gán giảng viên
                                            </button>
                                        ) : null}
                                        {canUpdate && !isLocalDraft(selectedCourse) ? (
                                            <button
                                                type="button"
                                                disabled={submitting}
                                                onClick={() => updateCourseStatus(isActiveCourse(selectedCourse) ? 'INACTIVE' : 'ACTIVE')}
                                            >
                                                {isActiveCourse(selectedCourse) ? <FiPauseCircle /> : <FiPlayCircle />}
                                                {isActiveCourse(selectedCourse) ? 'Vô hiệu hóa' : 'Kích hoạt'}
                                            </button>
                                        ) : null}
                                        {canCreateClass && isActiveCourse(selectedCourse) ? (
                                            <button type="button" className={cx('is-primary')} onClick={() => toast.info('Sang module Lớp học để tạo lớp từ môn ACTIVE.')}>
                                                <FiPlus /> Tạo lớp học
                                            </button>
                                        ) : null}
                                        {canCreateProposal && isLocalDraft(selectedCourse) ? (
                                            <button type="button" className={cx('is-primary')} disabled={submitting} onClick={() => submitProposal(detailInitialValue, selectedCourse.localId)}>
                                                <FiSend /> Đề xuất phê duyệt
                                            </button>
                                        ) : null}
                                        {canCreateProposal && isRejectedCourse(selectedCourse) ? (
                                            <button type="button" className={cx('is-primary')} disabled={submitting} onClick={reproposeRejectedCourse}>
                                                <FiSend /> Đề xuất lại
                                            </button>
                                        ) : null}
                                        {canUpdate && isRejectedCourse(selectedCourse) ? (
                                            <button type="button" className={cx('is-danger')} disabled={submitting} onClick={deleteRejectedCourse}>
                                                <FiXCircle /> Xóa đề xuất
                                            </button>
                                        ) : null}
                                        {canApprove && ['ADMIN', 'TRAINING_OFFICER'].includes(roleCode) && selectedCourse.status === 'PENDING_PDT' ? (
                                            <>
                                                <button type="button" className={cx('is-primary')} disabled={submitting} onClick={() => decideCourse('APPROVED', 'PDT')}>
                                                    <FiCheckCircle /> PDT duyệt
                                                </button>
                                                <button type="button" className={cx('is-danger')} disabled={submitting} onClick={() => decideCourse('REJECTED', 'PDT')}>
                                                    <FiXCircle /> PDT từ chối
                                                </button>
                                            </>
                                        ) : null}
                                        {canApprove && ['ADMIN', 'PRINCIPAL'].includes(roleCode) && selectedCourse.status === 'PENDING_PRINCIPAL' ? (
                                            <>
                                                <button type="button" className={cx('is-primary')} disabled={submitting} onClick={() => decideCourse('APPROVED', 'PRINCIPAL')}>
                                                    <FiCheckCircle /> Hiệu trưởng duyệt
                                                </button>
                                                <button type="button" className={cx('is-danger')} disabled={submitting} onClick={() => decideCourse('REJECTED', 'PRINCIPAL')}>
                                                    <FiXCircle /> Hiệu trưởng từ chối
                                                </button>
                                            </>
                                        ) : null}
                                    </section>

                                    {assignmentMode === 'head' ? (
                                        <section className={cx('courses__assignment')}>
                                            <h3>Gán trưởng bộ môn</h3>
                                            <Field label="Trưởng bộ môn">
                                                <select
                                                    value={selectedDepartmentHeadId}
                                                    onChange={(event) => setSelectedDepartmentHeadId(event.target.value)}
                                                >
                                                    <option value="">Chọn trưởng bộ môn</option>
                                                    {departmentHeads.map((user) => (
                                                        <option key={user.id || user.publicId} value={user.id}>
                                                            {user.fullName} - {user.code}
                                                        </option>
                                                    ))}
                                                </select>
                                            </Field>
                                            <footer>
                                                <button type="button" onClick={() => setAssignmentMode('')}>Hủy</button>
                                                <button type="button" className={cx('is-primary')} onClick={assignDepartmentHead} disabled={submitting}>
                                                    <FiSave /> Lưu phân công
                                                </button>
                                            </footer>
                                        </section>
                                    ) : null}

                                    {assignmentMode === 'lecturers' ? (
                                        <section className={cx('courses__assignment')}>
                                            <h3>Gán giảng viên</h3>
                                            {lecturers.length ? (
                                                <div className={cx('courses__people-list')}>
                                                    {lecturers.map((user) => {
                                                        const value = String(user.id);

                                                        return (
                                                            <label key={user.id || user.publicId}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedLecturerIds.includes(value)}
                                                                    onChange={() => toggleLecturer(value)}
                                                                />
                                                                <span>
                                                                    <strong>{user.fullName}</strong>
                                                                    <small>{user.code} - {user.email}</small>
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p>Chưa có giảng viên ACTIVE thuộc bộ môn này.</p>
                                            )}
                                            <footer>
                                                <button type="button" onClick={() => setAssignmentMode('')}>Hủy</button>
                                                <button type="button" className={cx('is-primary')} onClick={assignLecturers} disabled={submitting || lecturers.length === 0}>
                                                    <FiSave /> Lưu giảng viên
                                                </button>
                                            </footer>
                                        </section>
                                    ) : null}

                                    {!isActiveCourse(selectedCourse) ? (
                                        <section className={cx('courses__notice')}>
                                            <FiAlertCircle />
                                            <span>BR-SUB-02: môn chưa ACTIVE nên không hiển thị thao tác tạo lớp.</span>
                                        </section>
                                    ) : null}

                                    <section className={cx('courses__timeline')}>
                                        <h3>Lịch sử duyệt</h3>
                                        {(selectedCourse.approvals || []).length ? (
                                            selectedCourse.approvals.map((approval, index) => (
                                                <article key={`${approval.level}-${approval.createdAt}-${index}`}>
                                                    <strong>{approval.level} - {approval.action}</strong>
                                                    <span>{approval.approver?.fullName || 'Hệ thống'} · {formatDateTime(approval.createdAt)}</span>
                                                    {approval.note ? <p>{approval.note}</p> : null}
                                                </article>
                                            ))
                                        ) : (
                                            <p>Chưa có lịch sử duyệt.</p>
                                        )}
                                    </section>
                                </>
                            )}
                        </aside>
                    </div>
                ) : null}
            </main>
        </div>
    );
}
