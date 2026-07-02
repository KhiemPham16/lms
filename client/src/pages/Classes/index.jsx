import { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { useSearchParams } from 'react-router-dom';
import {
    FiBookOpen,
    FiCheckCircle,
    FiClock,
    FiEdit3,
    FiEye,
    FiFilter,
    FiLayers,
    FiLock,
    FiMoreVertical,
    FiPauseCircle,
    FiPlayCircle,
    FiPlus,
    FiRefreshCw,
    FiSave,
    FiSearch,
    FiShield,
    FiTrash2,
    FiUserCheck,
    FiUsers,
    FiX,
    FiXCircle
} from 'react-icons/fi';
import { toast } from 'sonner';

import AppSidebar from '~/components/AppSidebar';
import { getApiErrorMessage, unwrapApiPayload } from '~/lib/apiPayload';
import { classService } from '~/services/classService';
import { courseService } from '~/services/courseService';
import { departmentService } from '~/services/departmentService';
import { enrollmentService } from '~/services/enrollmentService';
import { userService } from '~/services/userService';
import { useAuthStore } from '~/stores/useAuthStore';
import { userHasBackendPermission } from '~/utils/permissions';
import layoutStyles from '~/pages/FlowWorkbench/FlowWorkbench.module.scss';
import classStyles from './Classes.module.scss';

const styles = { ...layoutStyles, ...classStyles };
const cx = classNames.bind(styles);

const statusLabels = {
    DRAFT: 'Nháp',
    OPEN_REGISTRATION: 'Đang mở đăng ký',
    CLOSED_REGISTRATION: 'Đã đóng đăng ký',
    IN_PROGRESS: 'Đang học',
    COMPLETED: 'Đã hoàn thành',
    CANCELLED: 'Đã hủy',
    FULL: 'Đã đầy'
};

const emptyForm = {
    coursePublicId: '',
    code: '',
    name: '',
    description: '',
    semester: '',
    academicYear: '',
    status: 'DRAFT',
    maxStudents: 40,
    minStudents: 0,
    allowWaitlist: false,
    startDate: '',
    endDate: '',
    weeklySchedule: '',
    studyShift: '',
    room: '',
    onlineUrl: '',
    registrationStartDate: '',
    registrationEndDate: '',
    allowStudentDrop: true,
    checkScheduleConflict: false,
    autoCloseWhenFull: true,
    departmentHeadId: '',
    lecturerId: '',
    assistantId: ''
};

const normalizeItems = (payload) => {
    const unwrapped = unwrapApiPayload(payload);
    return unwrapped?.items || unwrapped || [];
};
const getClassId = (item) => item?.publicId;
const asNumber = (value) => (value === '' || value === null || value === undefined ? undefined : Number(value));
const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

function Field({ label, children, error }) {
    return (
        <label className={cx('classes__field')}>
            <span>{label}</span>
            {children}
            {error ? <em>{error}</em> : null}
        </label>
    );
}

function StatusBadge({ status, isFull }) {
    return <span className={cx('classes__status', `is-${String(status).toLowerCase().replaceAll('_', '-')}`)}>{isFull ? 'Đã đầy' : statusLabels[status] || status}</span>;
}

function KpiCard({ icon: Icon, label, value, trend, active, onClick }) {
    return (
        <button type="button" className={cx('classes__kpi', { 'is-active': active })} onClick={onClick}>
            <span><Icon /></span>
            <strong>{Number(value || 0).toLocaleString('vi-VN')}</strong>
            <small>{label}</small>
            <em>{trend || '0%'}</em>
        </button>
    );
}

function FilterField({ label, children, wide }) {
    return (
        <label className={cx('classes__filter-field', { 'is-wide': wide })}>
            <span>{label}</span>
            {children}
        </label>
    );
}

function ClassForm({ initialValue, activeCourses, heads, lecturers, loading, onCancel, onSubmit }) {
    const [form, setForm] = useState(initialValue || emptyForm);
    const [errors, setErrors] = useState({});

    const setValue = (key, value) => {
        setForm((current) => ({ ...current, [key]: value }));
        setErrors((current) => ({ ...current, [key]: '' }));
    };

    const validate = () => {
        const nextErrors = {};
        if (!form.coursePublicId) nextErrors.coursePublicId = 'Chọn môn học ACTIVE';
        if (!form.code.trim()) nextErrors.code = 'Nhập mã lớp';
        if (!form.name.trim()) nextErrors.name = 'Nhập tên lớp';
        if (Number(form.maxStudents) <= 0) nextErrors.maxStudents = 'Sĩ số tối đa phải lớn hơn 0';
        if (!form.startDate) nextErrors.startDate = 'Chọn ngày bắt đầu';
        if (!form.endDate) nextErrors.endDate = 'Chọn ngày kết thúc';
        if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
            nextErrors.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
        }
        if (form.registrationStartDate && form.registrationEndDate && new Date(form.registrationEndDate) <= new Date(form.registrationStartDate)) {
            nextErrors.registrationEndDate = 'Ngày đóng đăng ký phải sau ngày mở';
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const submit = () => {
        if (!validate()) return;
        onSubmit({
            ...form,
            maxStudents: Number(form.maxStudents),
            minStudents: asNumber(form.minStudents),
            departmentHeadId: asNumber(form.departmentHeadId),
            lecturerId: asNumber(form.lecturerId),
            assistantId: asNumber(form.assistantId)
        });
    };

    return (
        <section className={cx('classes__drawer-form')}>
            <div className={cx('classes__form-grid')}>
                <Field label="Môn học" error={errors.coursePublicId}>
                    <select value={form.coursePublicId} onChange={(event) => setValue('coursePublicId', event.target.value)}>
                        <option value="">Chọn môn ACTIVE</option>
                        {activeCourses.map((course) => <option key={course.publicId} value={course.publicId}>{course.code} - {course.name}</option>)}
                    </select>
                </Field>
                <Field label="Mã lớp" error={errors.code}><input value={form.code} onChange={(event) => setValue('code', event.target.value)} /></Field>
                <Field label="Tên lớp" error={errors.name}><input value={form.name} onChange={(event) => setValue('name', event.target.value)} /></Field>
                <Field label="Học kỳ"><input value={form.semester} onChange={(event) => setValue('semester', event.target.value)} placeholder="HK1" /></Field>
                <Field label="Năm học"><input value={form.academicYear} onChange={(event) => setValue('academicYear', event.target.value)} placeholder="2026-2027" /></Field>
                <Field label="Trạng thái ban đầu">
                    <select value={form.status} onChange={(event) => setValue('status', event.target.value)}>
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                </Field>
                <Field label="Sĩ số tối đa" error={errors.maxStudents}><input type="number" min="1" value={form.maxStudents} onChange={(event) => setValue('maxStudents', event.target.value)} /></Field>
                <Field label="Sĩ số tối thiểu"><input type="number" min="0" value={form.minStudents} onChange={(event) => setValue('minStudents', event.target.value)} /></Field>
                <Field label="Ngày bắt đầu" error={errors.startDate}><input type="date" value={form.startDate} onChange={(event) => setValue('startDate', event.target.value)} /></Field>
                <Field label="Ngày kết thúc" error={errors.endDate}><input type="date" value={form.endDate} onChange={(event) => setValue('endDate', event.target.value)} /></Field>
                <Field label="Lịch học trong tuần"><input value={form.weeklySchedule} onChange={(event) => setValue('weeklySchedule', event.target.value)} placeholder="Thứ 2, Thứ 4" /></Field>
                <Field label="Ca học"><input value={form.studyShift} onChange={(event) => setValue('studyShift', event.target.value)} /></Field>
                <Field label="Phòng học"><input value={form.room} onChange={(event) => setValue('room', event.target.value)} /></Field>
                <Field label="Link học online"><input value={form.onlineUrl} onChange={(event) => setValue('onlineUrl', event.target.value)} /></Field>
                <Field label="Ngày mở đăng ký"><input type="date" value={form.registrationStartDate} onChange={(event) => setValue('registrationStartDate', event.target.value)} /></Field>
                <Field label="Ngày đóng đăng ký" error={errors.registrationEndDate}><input type="date" value={form.registrationEndDate} onChange={(event) => setValue('registrationEndDate', event.target.value)} /></Field>
                <Field label="Trưởng bộ môn quản lý">
                    <select value={form.departmentHeadId} onChange={(event) => setValue('departmentHeadId', event.target.value)}>
                        <option value="">Theo môn học</option>
                        {heads.map((user) => <option key={user.id} value={user.id}>{user.fullName} - {user.code}</option>)}
                    </select>
                </Field>
                <Field label="Giảng viên chính">
                    <select value={form.lecturerId} onChange={(event) => setValue('lecturerId', event.target.value)}>
                        <option value="">Chưa gán</option>
                        {lecturers.map((user) => <option key={user.id} value={user.id}>{user.fullName} - {user.code}</option>)}
                    </select>
                </Field>
                <Field label="Trợ giảng">
                    <select value={form.assistantId} onChange={(event) => setValue('assistantId', event.target.value)}>
                        <option value="">Không có</option>
                        {lecturers.map((user) => <option key={user.id} value={user.id}>{user.fullName} - {user.code}</option>)}
                    </select>
                </Field>
                <Field label="Mô tả"><textarea value={form.description} onChange={(event) => setValue('description', event.target.value)} /></Field>
            </div>
            <div className={cx('classes__toggles')}>
                <label><input type="checkbox" checked={form.allowWaitlist} onChange={(event) => setValue('allowWaitlist', event.target.checked)} /> Cho phép danh sách chờ</label>
                <label><input type="checkbox" checked={form.allowStudentDrop} onChange={(event) => setValue('allowStudentDrop', event.target.checked)} /> Cho phép sinh viên hủy đăng ký</label>
                <label><input type="checkbox" checked={form.checkScheduleConflict} onChange={(event) => setValue('checkScheduleConflict', event.target.checked)} /> Kiểm tra trùng lịch</label>
                <label><input type="checkbox" checked={form.autoCloseWhenFull} onChange={(event) => setValue('autoCloseWhenFull', event.target.checked)} /> Tự đóng khi đủ sĩ số</label>
            </div>
            <footer>
                <button type="button" onClick={onCancel}>Hủy</button>
                <button type="button" className={cx('is-primary')} onClick={submit} disabled={loading}><FiSave /> Lưu lớp học</button>
            </footer>
        </section>
    );
}

function AssignHeadModal({ classItem, heads, loading, onCancel, onSubmit }) {
    const [form, setForm] = useState({
        departmentHeadId: classItem?.departmentHeadId || '',
        startsAt: new Date().toISOString().slice(0, 10),
        note: ''
    });

    return (
        <section className={cx('classes__drawer-form')}>
            <div className={cx('classes__form-grid')}>
                <Field label="Lớp học"><input value={`${classItem?.code || ''} - ${classItem?.name || ''}`} disabled /></Field>
                <Field label="Môn học"><input value={`${classItem?.course?.code || ''} - ${classItem?.course?.name || ''}`} disabled /></Field>
                <Field label="Bộ môn"><input value={classItem?.course?.department?.name || ''} disabled /></Field>
                <Field label="Trưởng bộ môn hiện tại"><input value={classItem?.departmentHead?.fullName || 'Chưa gán'} disabled /></Field>
                <Field label="Trưởng bộ môn mới">
                    <select value={form.departmentHeadId} onChange={(event) => setForm((current) => ({ ...current, departmentHeadId: event.target.value }))}>
                        <option value="">Chọn trưởng bộ môn</option>
                        {heads.map((user) => <option key={user.id} value={user.id}>{user.fullName} - {user.code}</option>)}
                    </select>
                </Field>
                <Field label="Ngày bắt đầu quản lý"><input type="date" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></Field>
                <Field label="Ghi chú"><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></Field>
            </div>
            <footer>
                <button type="button" onClick={onCancel}>Hủy</button>
                <button type="button" className={cx('is-primary')} disabled={loading || !form.departmentHeadId} onClick={() => onSubmit({ ...form, departmentHeadId: Number(form.departmentHeadId) })}>Gán trưởng bộ môn</button>
            </footer>
        </section>
    );
}

function AssignTeacherModal({ classItem, lecturers, loading, onCancel, onSubmit }) {
    const [form, setForm] = useState({
        lecturerId: classItem?.lecturerId || '',
        role: 'PRIMARY',
        startsAt: new Date().toISOString().slice(0, 10),
        note: ''
    });

    return (
        <section className={cx('classes__drawer-form')}>
            <div className={cx('classes__form-grid')}>
                <Field label="Lớp học"><input value={`${classItem?.code || ''} - ${classItem?.name || ''}`} disabled /></Field>
                <Field label="Môn học"><input value={`${classItem?.course?.code || ''} - ${classItem?.course?.name || ''}`} disabled /></Field>
                <Field label="Danh sách giảng viên">
                    <select value={form.lecturerId} onChange={(event) => setForm((current) => ({ ...current, lecturerId: event.target.value }))}>
                        <option value="">Chọn giảng viên</option>
                        {lecturers.map((user) => <option key={user.id} value={user.id}>{user.fullName} - {user.code}</option>)}
                    </select>
                </Field>
                <Field label="Vai trò trong lớp">
                    <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
                        <option value="PRIMARY">Giảng viên chính</option>
                        <option value="ASSISTANT">Trợ giảng</option>
                    </select>
                </Field>
                <Field label="Ngày bắt đầu giảng dạy"><input type="date" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></Field>
                <Field label="Ghi chú"><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></Field>
            </div>
            <footer>
                <button type="button" onClick={onCancel}>Hủy</button>
                <button type="button" className={cx('is-primary')} disabled={loading || !form.lecturerId} onClick={() => onSubmit({ ...form, lecturerId: Number(form.lecturerId) })}>Gán giảng viên</button>
            </footer>
        </section>
    );
}

export default function ClassesPage({ workspaceKey = 'training' }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const currentUser = useAuthStore((state) => state.user);
    const canRead = userHasBackendPermission(currentUser, 'classes.read');
    const canCreate = userHasBackendPermission(currentUser, 'classes.create');
    const canAssignLecturer = userHasBackendPermission(currentUser, 'classes.assign_lecturer');
    const canToggleRegistration = userHasBackendPermission(currentUser, 'classes.registration.toggle');
    const canEnroll = userHasBackendPermission(currentUser, 'enrollments.create');

    const [summary, setSummary] = useState({});
    const [classes, setClasses] = useState([]);
    const [activeCourses, setActiveCourses] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [heads, setHeads] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [drawerMode, setDrawerMode] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState(searchParams.get('q') || '');
    const [filters, setFilters] = useState({
        status: searchParams.get('status') || '',
        courseId: searchParams.get('courseId') || '',
        departmentId: searchParams.get('departmentId') || '',
        semester: searchParams.get('semester') || '',
        academicYear: searchParams.get('academicYear') || '',
        departmentHeadId: searchParams.get('departmentHeadId') || '',
        lecturerId: searchParams.get('lecturerId') || '',
        isFull: searchParams.get('isFull') || '',
        registrationStatus: searchParams.get('registrationStatus') || '',
        startFrom: searchParams.get('startFrom') || '',
        endTo: searchParams.get('endTo') || '',
        page: Number(searchParams.get('page') || 1),
        limit: Number(searchParams.get('limit') || 10)
    });

    const queryParams = useMemo(() => ({
        keyword: search || undefined,
        ...filters,
        courseId: asNumber(filters.courseId),
        departmentId: asNumber(filters.departmentId),
        departmentHeadId: asNumber(filters.departmentHeadId),
        lecturerId: asNumber(filters.lecturerId),
        isFull: filters.isFull === '' ? undefined : filters.isFull === 'true'
    }), [filters, search]);

    const loadClasses = useCallback(async () => {
        if (!canRead) return;
        setLoading(true);
        try {
            const [summaryPayload, listPayload] = await Promise.all([
                classService.getSummary(queryParams),
                classService.getClasses(queryParams)
            ]);
            setSummary(summaryPayload || {});
            setClasses(normalizeItems(listPayload));
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không tải được danh sách lớp học'));
        } finally {
            setLoading(false);
        }
    }, [canRead, queryParams]);

    useEffect(() => {
        const handle = window.setTimeout(loadClasses, 400);
        return () => window.clearTimeout(handle);
    }, [loadClasses]);

    useEffect(() => {
        const nextParams = new URLSearchParams();
        if (search) nextParams.set('q', search);
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== '' && value !== undefined && value !== null) nextParams.set(key, String(value));
        });
        setSearchParams(nextParams, { replace: true });
    }, [filters, search, setSearchParams]);

    useEffect(() => {
        const loadLookups = async () => {
            try {
                const [coursePayload, departmentPayload, headsPayload, lecturersPayload] = await Promise.all([
                    courseService.getCourses({ status: 'ACTIVE', page: 1, limit: 200 }),
                    departmentService.getDepartments(),
                    userService.getUsers({ role: 'DEPARTMENT_HEAD', status: 'ACTIVE', page: 1, limit: 200 }),
                    userService.getUsers({ role: 'LECTURER', status: 'ACTIVE', page: 1, limit: 200 })
                ]);
                setActiveCourses(normalizeItems(coursePayload));
                setDepartments(normalizeItems(departmentPayload));
                setHeads(normalizeItems(headsPayload));
                setLecturers(normalizeItems(lecturersPayload));
            } catch (error) {
                toast.error(getApiErrorMessage(error, 'Không tải được dữ liệu chọn'));
            }
        };
        loadLookups();
    }, []);

    const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
    const clearFilters = () => {
        setSearch('');
        setFilters({
            status: '',
            courseId: '',
            departmentId: '',
            semester: '',
            academicYear: '',
            departmentHeadId: '',
            lecturerId: '',
            isFull: '',
            registrationStatus: '',
            startFrom: '',
            endTo: '',
            page: 1,
            limit: filters.limit
        });
    };
    const openCreate = () => {
        setSelectedClass(null);
        setDrawerMode('form');
    };
    const openDetail = async (item) => {
        try {
            const detail = await classService.getClass(item.publicId);
            setSelectedClass(detail);
            setActiveTab('overview');
            setDrawerMode('detail');
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không tải được chi tiết lớp học'));
        }
    };
    const closeDrawer = () => {
        setSelectedClass(null);
        setDrawerMode('');
    };

    const openClassAction = async (item, mode) => {
        try {
            const detail = await classService.getClass(item.publicId);
            setSelectedClass(detail);
            setDrawerMode(mode);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không tải được chi tiết lớp học'));
        }
    };

    const formInitial = selectedClass ? {
        ...emptyForm,
        ...selectedClass,
        coursePublicId: selectedClass.course?.publicId || '',
        startDate: selectedClass.startDate?.slice(0, 10) || '',
        endDate: selectedClass.endDate?.slice(0, 10) || '',
        registrationStartDate: selectedClass.registrationStartDate?.slice(0, 10) || '',
        registrationEndDate: selectedClass.registrationEndDate?.slice(0, 10) || '',
        weeklySchedule: selectedClass.weeklyScheduleText || ''
    } : emptyForm;

    const submitClass = async (payload) => {
        setSubmitting(true);
        try {
            if (selectedClass?.publicId) {
                const { coursePublicId: _coursePublicId, ...data } = payload;
                const updated = await classService.updateClass(selectedClass.publicId, data);
                setSelectedClass(updated);
                toast.success('Đã cập nhật lớp học');
            } else {
                await classService.createClass(payload);
                toast.success('Đã tạo lớp học');
                closeDrawer();
            }
            loadClasses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không lưu được lớp học'));
        } finally {
            setSubmitting(false);
        }
    };

    const changeStatus = async (item, status) => {
        setSubmitting(true);
        try {
            const updated = await classService.updateStatus(item.publicId, status);
            setSelectedClass(updated);
            toast.success('Đã cập nhật trạng thái lớp');
            loadClasses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không cập nhật được trạng thái'));
        } finally {
            setSubmitting(false);
        }
    };

    const assignDepartmentHead = async (payload) => {
        setSubmitting(true);
        try {
            const updated = await classService.assignDepartmentHead(selectedClass.publicId, payload);
            setSelectedClass(updated);
            setDrawerMode('detail');
            setActiveTab('teachers');
            toast.success('Đã gán trưởng bộ môn');
            loadClasses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không gán được trưởng bộ môn'));
        } finally {
            setSubmitting(false);
        }
    };

    const assignLecturer = async (payload) => {
        setSubmitting(true);
        try {
            const updated = await classService.assignLecturer(selectedClass.publicId, payload);
            setSelectedClass(updated);
            setDrawerMode('detail');
            setActiveTab('teachers');
            toast.success('Đã gán giảng viên');
            loadClasses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không gán được giảng viên'));
        } finally {
            setSubmitting(false);
        }
    };

    const enrollClass = async (item) => {
        setSubmitting(true);
        try {
            await enrollmentService.enrollClass(item.publicId);
            toast.success('Đã đăng ký lớp học');
            const detail = await classService.getClass(item.publicId);
            setSelectedClass(detail);
            loadClasses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không đăng ký được lớp học'));
        } finally {
            setSubmitting(false);
        }
    };

    const deleteClass = async (item) => {
        if (!window.confirm('Xóa lớp học chưa phát sinh dữ liệu?')) return;
        try {
            await classService.deleteClass(item.publicId);
            toast.success('Đã xóa lớp học');
            closeDrawer();
            loadClasses();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không xóa được lớp học'));
        }
    };

    const kpis = [
        ['total', FiLayers, 'Tổng lớp học', {}, summary.total],
        ['draft', FiClock, 'Lớp nháp', { status: 'DRAFT' }, summary.draft],
        ['openRegistration', FiPlayCircle, 'Đang mở đăng ký', { status: 'OPEN_REGISTRATION' }, summary.openRegistration],
        ['closedRegistration', FiLock, 'Đã đóng đăng ký', { status: 'CLOSED_REGISTRATION' }, summary.closedRegistration],
        ['inProgress', FiBookOpen, 'Đang học', { status: 'IN_PROGRESS' }, summary.inProgress],
        ['completed', FiCheckCircle, 'Đã hoàn thành', { status: 'COMPLETED' }, summary.completed],
        ['full', FiUsers, 'Lớp đã đầy', { isFull: 'true' }, summary.full],
        ['totalRegistered', FiUserCheck, 'Tổng sinh viên đăng ký', {}, summary.totalRegistered]
    ];

    if (!canRead) {
        return (
            <div className={cx('flow-shell')}>
                <AppSidebar workspaceKey={workspaceKey} />
                <main className={cx('flow-main', 'classes')}><section className={cx('classes__empty')}><FiShield /><h1>Bạn chưa có quyền xem lớp học</h1></section></main>
            </div>
        );
    }

    return (
        <div className={cx('flow-shell')}>
            <AppSidebar workspaceKey={workspaceKey} />
            <main className={cx('flow-main', 'classes')}>
                <section className={cx('classes__hero')}>
                    <div><span>EduLMS / Lớp học</span><h1>Quản lý lớp học</h1><p>Quản lý lớp mở từ môn ACTIVE, phân công và theo dõi đăng ký.</p></div>
                    <div>
                        <button type="button" onClick={loadClasses} disabled={loading}><FiRefreshCw /> Làm mới</button>
                        {canCreate ? <button type="button" className={cx('is-primary')} onClick={openCreate}><FiPlus /> Tạo lớp</button> : null}
                    </div>
                </section>

                <section className={cx('classes__kpis')}>
                    {kpis.map(([key, Icon, label, filter, value]) => (
                        <KpiCard key={key} icon={Icon} label={label} value={value} trend={summary.trends?.[key]} active={filters.status === filter.status || filters.isFull === filter.isFull} onClick={() => setFilters((current) => ({ ...current, ...filter, page: 1 }))} />
                    ))}
                </section>

                <section className={cx('classes__filters')}>
                    <div className={cx('classes__filters-head')}>
                        <div>
                            <FiFilter />
                            <div>
                                <strong>Bộ lọc lớp học</strong>
                                <span>Tìm kiếm và lọc nhanh theo thông tin quản lý lớp</span>
                            </div>
                        </div>
                        <button type="button" onClick={clearFilters}>Xóa lọc</button>
                    </div>
                    <label className={cx('classes__search')}>
                        <FiSearch />
                        <input value={search} onChange={(event) => { setSearch(event.target.value); setFilter('page', 1); }} placeholder="Tìm mã lớp, tên lớp, mã môn, tên môn, giảng viên, trưởng bộ môn..." />
                    </label>
                    <div className={cx('classes__filter-grid')}>
                        <FilterField label="Trạng thái lớp">
                            <select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                        </FilterField>
                        <FilterField label="Môn học" wide>
                            <select value={filters.courseId} onChange={(event) => setFilter('courseId', event.target.value)}><option value="">Tất cả môn học</option>{activeCourses.map((course) => <option key={course.publicId} value={course.id}>{course.code} - {course.name}</option>)}</select>
                        </FilterField>
                        <FilterField label="Bộ môn">
                            <select value={filters.departmentId} onChange={(event) => setFilter('departmentId', event.target.value)}><option value="">Tất cả bộ môn</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
                        </FilterField>
                        <FilterField label="Học kỳ">
                            <input value={filters.semester} onChange={(event) => setFilter('semester', event.target.value)} placeholder="VD: HK1" />
                        </FilterField>
                        <FilterField label="Năm học">
                            <input value={filters.academicYear} onChange={(event) => setFilter('academicYear', event.target.value)} placeholder="VD: 2026-2027" />
                        </FilterField>
                        <FilterField label="Trưởng bộ môn">
                            <select value={filters.departmentHeadId} onChange={(event) => setFilter('departmentHeadId', event.target.value)}><option value="">Tất cả TBM</option>{heads.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select>
                        </FilterField>
                        <FilterField label="Giảng viên">
                            <select value={filters.lecturerId} onChange={(event) => setFilter('lecturerId', event.target.value)}><option value="">Tất cả giảng viên</option>{lecturers.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select>
                        </FilterField>
                        <FilterField label="Sĩ số">
                            <select value={filters.isFull} onChange={(event) => setFilter('isFull', event.target.value)}><option value="">Tất cả sĩ số</option><option value="false">Còn chỗ trống</option><option value="true">Đã đầy</option></select>
                        </FilterField>
                        <FilterField label="Đăng ký">
                            <select value={filters.registrationStatus} onChange={(event) => setFilter('registrationStatus', event.target.value)}><option value="">Tất cả đăng ký</option><option value="open">Đang mở</option><option value="closed">Đã đóng</option></select>
                        </FilterField>
                        <FilterField label="Từ ngày">
                            <input type="date" value={filters.startFrom} onChange={(event) => setFilter('startFrom', event.target.value)} />
                        </FilterField>
                        <FilterField label="Đến ngày">
                            <input type="date" value={filters.endTo} onChange={(event) => setFilter('endTo', event.target.value)} />
                        </FilterField>
                    </div>
                </section>

                <section className={cx('classes__panel')}>
                    <div className={cx('classes__table-wrap')}>
                        <table className={cx('classes__table')}>
                            <thead><tr><th><input type="checkbox" /></th><th>Mã lớp</th><th>Tên lớp</th><th>Môn học</th><th>Học kỳ</th><th>Năm học</th><th>Trưởng bộ môn</th><th>Giảng viên</th><th>Sĩ số</th><th>Thời gian học</th><th>Trạng thái</th><th>Cập nhật</th><th>Thao tác</th></tr></thead>
                            <tbody>
                                {classes.map((item) => (
                                    <tr key={getClassId(item)}>
                                        <td><input type="checkbox" /></td>
                                        <td><strong>{item.code}</strong></td>
                                        <td>{item.name}</td>
                                        <td>{item.course?.code} - {item.course?.name}</td>
                                        <td>{item.semester || '-'}</td>
                                        <td>{item.academicYear || '-'}</td>
                                        <td>{item.departmentHead?.fullName || '-'}</td>
                                        <td>{item.lecturer?.fullName || '-'}</td>
                                        <td><strong>{item.enrolledCount} / {item.maxStudents}</strong>{item.isFull ? <small>Đã đầy</small> : null}</td>
                                        <td>{formatDate(item.startDate)} - {formatDate(item.endDate)}</td>
                                        <td><StatusBadge status={item.status} isFull={item.isFull} /></td>
                                        <td>{formatDate(item.updatedAt)}</td>
                                        <td>
                                            <div className={cx('classes__actions-menu')}>
                                                <button type="button" onClick={() => openDetail(item)}><FiEye /> Xem</button>
                                                {canCreate ? <button type="button" onClick={() => { setSelectedClass(item); setDrawerMode('form'); }}><FiEdit3 /> Sửa</button> : null}
                                                {canCreate ? <button type="button" onClick={() => openClassAction(item, 'assignHead')}><FiUserCheck /> Gán TBM</button> : null}
                                                {canToggleRegistration && ['DRAFT', 'CLOSED_REGISTRATION'].includes(item.status) ? <button type="button" onClick={() => changeStatus(item, 'OPEN_REGISTRATION')}><FiPlayCircle /> Mở đăng ký</button> : null}
                                                {canToggleRegistration && item.status === 'OPEN_REGISTRATION' ? <button type="button" onClick={() => changeStatus(item, 'CLOSED_REGISTRATION')}><FiPauseCircle /> Đóng đăng ký</button> : null}
                                                {canAssignLecturer ? <button type="button" onClick={() => openClassAction(item, 'assignTeacher')}><FiMoreVertical /> Gán GV</button> : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {!classes.length ? <div className={cx('classes__empty')}><FiLayers /><h2>Chưa có lớp học</h2><p>Tạo lớp từ môn ACTIVE để bắt đầu quản lý.</p></div> : null}
                </section>

                <section className={cx('classes__pagination')}>
                    <button type="button" disabled={filters.page <= 1} onClick={() => setFilter('page', filters.page - 1)}>Trước</button>
                    <strong>Trang {filters.page}</strong>
                    <button type="button" onClick={() => setFilter('page', filters.page + 1)}>Sau</button>
                </section>

                {drawerMode ? (
                    <div className={cx('classes__backdrop')}>
                        <aside className={cx('classes__drawer')}>
                            <header><div><span>Lớp học</span><h2>{drawerMode === 'form' ? (selectedClass ? 'Chỉnh sửa lớp' : 'Tạo lớp học') : drawerMode === 'assignHead' ? 'Gán trưởng bộ môn' : drawerMode === 'assignTeacher' ? 'Gán giảng viên' : selectedClass?.name}</h2></div><button type="button" onClick={closeDrawer}><FiX /></button></header>
                            {drawerMode === 'form' ? (
                                <ClassForm initialValue={formInitial} activeCourses={activeCourses} heads={heads} lecturers={lecturers} loading={submitting} onCancel={closeDrawer} onSubmit={submitClass} />
                            ) : drawerMode === 'assignHead' ? (
                                <AssignHeadModal classItem={selectedClass} heads={heads} loading={submitting} onCancel={() => setDrawerMode('detail')} onSubmit={assignDepartmentHead} />
                            ) : drawerMode === 'assignTeacher' ? (
                                <AssignTeacherModal classItem={selectedClass} lecturers={lecturers} loading={submitting} onCancel={() => setDrawerMode('detail')} onSubmit={assignLecturer} />
                            ) : (
                                <div className={cx('classes__detail')}>
                                    <nav>{['overview', 'schedule', 'students', 'teachers', 'lessons', 'exams', 'grades', 'history'].map((tab) => <button key={tab} type="button" className={cx({ 'is-active': activeTab === tab })} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
                                    {activeTab === 'overview' ? <section><StatusBadge status={selectedClass.status} isFull={selectedClass.isFull} /><dl><div><dt>Mã lớp</dt><dd>{selectedClass.code}</dd></div><div><dt>Môn học</dt><dd>{selectedClass.course?.name}</dd></div><div><dt>Bộ môn</dt><dd>{selectedClass.course?.department?.name}</dd></div><div><dt>Sĩ số</dt><dd>{selectedClass.enrolledCount} / {selectedClass.maxStudents}</dd></div></dl><p>{selectedClass.description || 'Chưa có mô tả.'}</p></section> : null}
                                    {activeTab === 'schedule' ? <section><p>{selectedClass.weeklyScheduleText || 'Chưa có lịch học.'}</p><p>{selectedClass.studyShift || '-'} · {selectedClass.room || '-'}</p><p>{selectedClass.onlineUrl || '-'}</p></section> : null}
                                    {activeTab === 'students' ? <section>{(selectedClass.enrollments || []).map((enrollment) => <article key={enrollment.id}><strong>{enrollment.student.fullName}</strong><span>{enrollment.student.code} · {enrollment.status} · {formatDate(enrollment.enrolledAt)}</span></article>)}</section> : null}
                                    {activeTab === 'teachers' ? <section><p>Giảng viên chính: {selectedClass.lecturer?.fullName || 'Chưa gán'}</p><p>Trợ giảng: {selectedClass.assistant?.fullName || 'Không có'}</p><p>Trưởng bộ môn: {selectedClass.departmentHead?.fullName || '-'}</p></section> : null}
                                    {['lessons', 'exams', 'grades', 'history'].includes(activeTab) ? <section><p>Chưa có model/API dữ liệu cho tab này. Khung tab đã sẵn sàng để nối khi backend bài học, bài kiểm tra và bảng điểm được bổ sung.</p></section> : null}
                                    <footer>
                                        {canCreate ? <button type="button" onClick={() => setDrawerMode('assignHead')}>Gán trưởng bộ môn</button> : null}
                                        {canAssignLecturer ? <button type="button" onClick={() => setDrawerMode('assignTeacher')}>Gán giảng viên</button> : null}
                                        {canToggleRegistration ? <button type="button" onClick={() => changeStatus(selectedClass, 'IN_PROGRESS')}>Bắt đầu lớp</button> : null}
                                        {canToggleRegistration ? <button type="button" onClick={() => changeStatus(selectedClass, 'COMPLETED')}>Hoàn thành</button> : null}
                                        {canToggleRegistration ? <button type="button" onClick={() => changeStatus(selectedClass, 'CANCELLED')}>Hủy lớp</button> : null}
                                        {canEnroll && selectedClass.status === 'OPEN_REGISTRATION' ? <button type="button" className={cx('is-primary')} disabled={submitting} onClick={() => enrollClass(selectedClass)}>Đăng ký lớp</button> : null}
                                        {canCreate ? <button type="button" className={cx('is-danger')} onClick={() => deleteClass(selectedClass)}><FiTrash2 /> Xóa</button> : null}
                                    </footer>
                                </div>
                            )}
                        </aside>
                    </div>
                ) : null}
            </main>
        </div>
    );
}
