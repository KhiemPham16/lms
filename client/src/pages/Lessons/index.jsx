import { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    FiArchive,
    FiBookOpen,
    FiCheckCircle,
    FiClock,
    FiCopy,
    FiDownload,
    FiEdit3,
    FiEye,
    FiEyeOff,
    FiFileText,
    FiFilter,
    FiLayers,
    FiLink,
    FiList,
    FiPlayCircle,
    FiPlus,
    FiRefreshCw,
    FiSave,
    FiSearch,
    FiShield,
    FiTrash2,
    FiUpload,
    FiUsers,
    FiVideo,
    FiX
} from 'react-icons/fi';
import { toast } from 'sonner';

import AppSidebar from '~/components/AppSidebar';
import { getApiErrorMessage, unwrapApiPayload } from '~/lib/apiPayload';
import { classService } from '~/services/classService';
import { courseService } from '~/services/courseService';
import { departmentService } from '~/services/departmentService';
import { lessonService } from '~/services/lessonService';
import { userService } from '~/services/userService';
import { useAuthStore } from '~/stores/useAuthStore';
import { userHasBackendPermission } from '~/utils/permissions';
import layoutStyles from '~/pages/FlowWorkbench/FlowWorkbench.module.scss';
import lessonStyles from './Lessons.module.scss';

const styles = { ...layoutStyles, ...lessonStyles };
const cx = classNames.bind(styles);

const statusLabels = {
    DRAFT: 'Nháp',
    PUBLISHED: 'Đã xuất bản',
    HIDDEN: 'Đang ẩn',
    ARCHIVED: 'Đã lưu trữ'
};

const contentTypeLabels = {
    TEXT: 'Văn bản',
    VIDEO: 'Video',
    FILE: 'Tệp',
    IMAGE: 'Hình ảnh',
    LINK: 'Liên kết',
    CODE: 'Code',
    ASSIGNMENT: 'Bài tập',
    EXAM: 'Bài kiểm tra'
};

const emptyBlock = { type: 'TEXT', title: '', content: '', fileUrl: '', fileName: '', orderIndex: 1 };
const emptyForm = {
    classPublicId: '',
    title: '',
    description: '',
    chapter: '',
    orderIndex: 1,
    durationMinutes: 45,
    status: 'DRAFT',
    primaryContentType: 'TEXT',
    allowStudentView: true,
    allowDownload: true,
    requirePreviousCompletion: false,
    availableFrom: '',
    availableUntil: '',
    trackProgress: true,
    blocks: [{ ...emptyBlock }]
};

const normalizeItems = (payload) => {
    const unwrapped = unwrapApiPayload(payload);
    return unwrapped?.items || unwrapped || [];
};
const asNumber = (value) => (value === '' || value === undefined || value === null ? undefined : Number(value));
const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

function StatusBadge({ status }) {
    return <span className={cx('lessons__status', `is-${String(status).toLowerCase()}`)}>{statusLabels[status] || status}</span>;
}

function KpiCard({ icon: Icon, label, value, trend, active, onClick }) {
    return (
        <button type="button" className={cx('lessons__kpi', { 'is-active': active })} onClick={onClick}>
            <span><Icon /></span>
            <strong>{Number(value || 0).toLocaleString('vi-VN')}</strong>
            <small>{label}</small>
            <em>{trend || '0%'}</em>
        </button>
    );
}

function FilterField({ label, children, wide }) {
    return <label className={cx('lessons__filter-field', { 'is-wide': wide })}><span>{label}</span>{children}</label>;
}

function Field({ label, children, error }) {
    return <label className={cx('lessons__field')}><span>{label}</span>{children}{error ? <em>{error}</em> : null}</label>;
}

function LessonForm({ initialValue, classes, loading, onCancel, onSubmit }) {
    const [form, setForm] = useState(initialValue || emptyForm);
    const [errors, setErrors] = useState({});
    const selectedClass = classes.find((item) => item.publicId === form.classPublicId);

    const setValue = (key, value) => {
        setForm((current) => ({ ...current, [key]: value }));
        setErrors((current) => ({ ...current, [key]: '' }));
    };
    const setBlock = (index, key, value) => {
        setForm((current) => ({
            ...current,
            blocks: current.blocks.map((block, blockIndex) => blockIndex === index ? { ...block, [key]: value } : block)
        }));
    };
    const addBlock = () => setForm((current) => ({ ...current, blocks: [...current.blocks, { ...emptyBlock, orderIndex: current.blocks.length + 1 }] }));
    const removeBlock = (index) => setForm((current) => ({ ...current, blocks: current.blocks.filter((_, blockIndex) => blockIndex !== index).map((block, blockIndex) => ({ ...block, orderIndex: blockIndex + 1 })) }));
    const moveBlock = (index, direction) => {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= form.blocks.length) return;
        const blocks = [...form.blocks];
        [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
        setForm((current) => ({ ...current, blocks: blocks.map((block, blockIndex) => ({ ...block, orderIndex: blockIndex + 1 })) }));
    };

    const submit = () => {
        const nextErrors = {};
        if (!form.classPublicId) nextErrors.classPublicId = 'Chọn lớp học';
        if (!form.title.trim()) nextErrors.title = 'Nhập tiêu đề bài học';
        if (form.status === 'PUBLISHED' && !form.blocks.length) nextErrors.blocks = 'Cần ít nhất một block trước khi xuất bản';
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) return;
        onSubmit({
            ...form,
            orderIndex: Number(form.orderIndex),
            durationMinutes: asNumber(form.durationMinutes),
            availableFrom: form.availableFrom || undefined,
            availableUntil: form.availableUntil || undefined,
            blocks: form.blocks.map((block, index) => ({ ...block, orderIndex: index + 1, fileSize: asNumber(block.fileSize) }))
        });
    };

    return (
        <section className={cx('lessons__drawer-form')}>
            <div className={cx('lessons__form-grid')}>
                <Field label="Lớp học" error={errors.classPublicId}>
                    <select value={form.classPublicId} onChange={(event) => setValue('classPublicId', event.target.value)}>
                        <option value="">Chọn lớp được phân công</option>
                        {classes.map((item) => <option key={item.publicId} value={item.publicId}>{item.code} - {item.name}</option>)}
                    </select>
                </Field>
                <Field label="Môn học"><input value={selectedClass ? `${selectedClass.course?.code} - ${selectedClass.course?.name}` : 'Tự động theo lớp'} disabled /></Field>
                <Field label="Tiêu đề bài học" error={errors.title}><input value={form.title} onChange={(event) => setValue('title', event.target.value)} /></Field>
                <Field label="Chương hoặc tuần học"><input value={form.chapter} onChange={(event) => setValue('chapter', event.target.value)} placeholder="VD: Tuần 1" /></Field>
                <Field label="Thứ tự hiển thị"><input type="number" min="1" value={form.orderIndex} onChange={(event) => setValue('orderIndex', event.target.value)} /></Field>
                <Field label="Thời lượng dự kiến"><input type="number" min="0" value={form.durationMinutes} onChange={(event) => setValue('durationMinutes', event.target.value)} /></Field>
                <Field label="Trạng thái ban đầu">
                    <select value={form.status} onChange={(event) => setValue('status', event.target.value)}>
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                </Field>
                <Field label="Loại nội dung chính">
                    <select value={form.primaryContentType} onChange={(event) => setValue('primaryContentType', event.target.value)}>
                        {Object.entries(contentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                </Field>
                <Field label="Hiển thị sau"><input type="date" value={form.availableFrom} onChange={(event) => setValue('availableFrom', event.target.value)} /></Field>
                <Field label="Ẩn sau"><input type="date" value={form.availableUntil} onChange={(event) => setValue('availableUntil', event.target.value)} /></Field>
                <Field label="Mô tả ngắn"><textarea value={form.description} onChange={(event) => setValue('description', event.target.value)} /></Field>
            </div>
            <div className={cx('lessons__toggles')}>
                <label><input type="checkbox" checked={form.allowStudentView} onChange={(event) => setValue('allowStudentView', event.target.checked)} /> Cho phép sinh viên xem bài</label>
                <label><input type="checkbox" checked={form.allowDownload} onChange={(event) => setValue('allowDownload', event.target.checked)} /> Cho phép tải tài liệu</label>
                <label><input type="checkbox" checked={form.requirePreviousCompletion} onChange={(event) => setValue('requirePreviousCompletion', event.target.checked)} /> Yêu cầu hoàn thành bài trước</label>
                <label><input type="checkbox" checked={form.trackProgress} onChange={(event) => setValue('trackProgress', event.target.checked)} /> Ghi nhận tiến độ</label>
            </div>
            <div className={cx('lessons__blocks')}>
                <strong>Nội dung bài học dạng block</strong>
                {errors.blocks ? <em>{errors.blocks}</em> : null}
                {form.blocks.map((block, index) => (
                    <article className={cx('lessons__block')} key={`${block.orderIndex}-${index}`}>
                        <select value={block.type} onChange={(event) => setBlock(index, 'type', event.target.value)}>
                            {Object.entries(contentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        <div className={cx('lessons__field')}>
                            <input value={block.title} onChange={(event) => setBlock(index, 'title', event.target.value)} placeholder="Tiêu đề block" />
                            <textarea value={block.content} onChange={(event) => setBlock(index, 'content', event.target.value)} placeholder="Nội dung, mã code, mô tả bài tập hoặc URL" />
                            <input value={block.fileUrl} onChange={(event) => setBlock(index, 'fileUrl', event.target.value)} placeholder="File hoặc URL nếu có" />
                        </div>
                        <div>
                            <button type="button" onClick={() => moveBlock(index, -1)}>Lên</button>
                            <button type="button" onClick={() => moveBlock(index, 1)}>Xuống</button>
                        </div>
                        <button type="button" className={cx('is-danger')} onClick={() => removeBlock(index)}><FiTrash2 /></button>
                    </article>
                ))}
                <button type="button" onClick={addBlock}><FiPlus /> Thêm block</button>
            </div>
            <footer>
                <button type="button" onClick={onCancel}>Hủy</button>
                <button type="button" className={cx('is-primary')} onClick={submit} disabled={loading}><FiSave /> Lưu bài học</button>
            </footer>
        </section>
    );
}

export default function LessonsPage({ workspaceKey = 'teacher' }) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentUser = useAuthStore((state) => state.user);
    const canRead = userHasBackendPermission(currentUser, 'lessons.read');
    const canCreate = userHasBackendPermission(currentUser, 'lessons.create');
    const canUpdate = userHasBackendPermission(currentUser, 'lessons.update');
    const canPublish = userHasBackendPermission(currentUser, 'lessons.publish');
    const canDelete = userHasBackendPermission(currentUser, 'lessons.delete');
    const isStudent = String(currentUser?.role || currentUser?.roleDetail?.code || '').toUpperCase() === 'STUDENT';
    const canReadClasses = userHasBackendPermission(currentUser, 'classes.read');
    const canReadCourses = userHasBackendPermission(currentUser, 'courses.read');
    const canReadDepartments = userHasBackendPermission(currentUser, 'departments.read');
    const canReadUsers = userHasBackendPermission(currentUser, 'users.read');

    const [summary, setSummary] = useState({});
    const [lessons, setLessons] = useState([]);
    const [classes, setClasses] = useState([]);
    const [courses, setCourses] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [selectedLesson, setSelectedLesson] = useState(null);
    const [drawerMode, setDrawerMode] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState(searchParams.get('q') || '');
    const [filters, setFilters] = useState({
        classPublicId: searchParams.get('classPublicId') || '',
        courseId: searchParams.get('courseId') || '',
        departmentId: searchParams.get('departmentId') || '',
        lecturerId: searchParams.get('lecturerId') || '',
        status: searchParams.get('status') || '',
        contentType: searchParams.get('contentType') || '',
        hasLinkedExam: searchParams.get('hasLinkedExam') || '',
        hasVideo: searchParams.get('hasVideo') || '',
        hasAttachment: searchParams.get('hasAttachment') || '',
        createdFrom: searchParams.get('createdFrom') || '',
        publishedFrom: searchParams.get('publishedFrom') || '',
        page: Number(searchParams.get('page') || 1),
        limit: Number(searchParams.get('limit') || 10)
    });

    const queryParams = useMemo(() => ({
        keyword: search || undefined,
        ...filters,
        courseId: asNumber(filters.courseId),
        departmentId: asNumber(filters.departmentId),
        lecturerId: asNumber(filters.lecturerId),
        hasLinkedExam: filters.hasLinkedExam === '' ? undefined : filters.hasLinkedExam === 'true',
        hasVideo: filters.hasVideo === '' ? undefined : filters.hasVideo === 'true',
        hasAttachment: filters.hasAttachment === '' ? undefined : filters.hasAttachment === 'true'
    }), [filters, search]);

    const loadLessons = useCallback(async () => {
        if (!canRead) return;
        setLoading(true);
        try {
            const [summaryPayload, listPayload] = await Promise.all([
                lessonService.getSummary(queryParams),
                lessonService.getLessons(queryParams)
            ]);
            setSummary(summaryPayload || {});
            setLessons(normalizeItems(listPayload));
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không tải được danh sách bài học'));
        } finally {
            setLoading(false);
        }
    }, [canRead, queryParams]);

    useEffect(() => {
        const handle = window.setTimeout(loadLessons, 400);
        return () => window.clearTimeout(handle);
    }, [loadLessons]);

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
                const [classPayload, coursePayload, departmentPayload, lecturerPayload] = await Promise.all([
                    canReadClasses ? classService.getClasses({ page: 1, limit: 200 }) : Promise.resolve([]),
                    canReadCourses ? courseService.getCourses({ page: 1, limit: 200 }) : Promise.resolve([]),
                    canReadDepartments ? departmentService.getDepartments() : Promise.resolve([]),
                    canReadUsers ? userService.getUsers({ role: 'LECTURER', status: 'ACTIVE', page: 1, limit: 200 }) : Promise.resolve([])
                ]);
                setClasses(normalizeItems(classPayload));
                setCourses(normalizeItems(coursePayload));
                setDepartments(normalizeItems(departmentPayload));
                setLecturers(normalizeItems(lecturerPayload));
            } catch (error) {
                toast.error(getApiErrorMessage(error, 'Không tải được dữ liệu chọn'));
            }
        };
        loadLookups();
    }, [canReadClasses, canReadCourses, canReadDepartments, canReadUsers]);

    const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
    const clearFilters = () => {
        setSearch('');
        setFilters((current) => ({ classPublicId: '', courseId: '', departmentId: '', lecturerId: '', status: '', contentType: '', hasLinkedExam: '', hasVideo: '', hasAttachment: '', createdFrom: '', publishedFrom: '', page: 1, limit: current.limit }));
    };
    const closeDrawer = () => { setSelectedLesson(null); setDrawerMode(''); };
    const openCreate = () => navigate(`/${workspaceKey}/lessons/create`);
    const openDetail = (item) => navigate(`/${workspaceKey}/lessons/${item.publicId}`);
    const openEdit = (item) => navigate(`/${workspaceKey}/lessons/${item.publicId}/edit`);

    const formInitial = selectedLesson ? {
        ...emptyForm,
        ...selectedLesson,
        classPublicId: selectedLesson.class?.publicId || '',
        availableFrom: selectedLesson.availableFrom?.slice(0, 10) || '',
        availableUntil: selectedLesson.availableUntil?.slice(0, 10) || '',
        blocks: selectedLesson.blocks?.length ? selectedLesson.blocks.map((block, index) => ({ ...emptyBlock, ...block, orderIndex: index + 1 })) : [{ ...emptyBlock }]
    } : emptyForm;

    const submitLesson = async (payload) => {
        setSubmitting(true);
        try {
            if (selectedLesson?.publicId) {
                const updated = await lessonService.updateLesson(selectedLesson.publicId, payload);
                setSelectedLesson(updated);
                toast.success('Đã cập nhật bài học');
            } else {
                await lessonService.createLesson(payload);
                toast.success('Đã tạo bài học');
                closeDrawer();
            }
            loadLessons();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không lưu được bài học'));
        } finally {
            setSubmitting(false);
        }
    };

    const runAction = async (action, successMessage) => {
        setSubmitting(true);
        try {
            const updated = await action();
            if (updated?.publicId) setSelectedLesson(updated);
            toast.success(successMessage);
            loadLessons();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Thao tác không thành công'));
        } finally {
            setSubmitting(false);
        }
    };
    const hideLesson = (item) => {
        const reason = window.prompt('Lý do ẩn bài học');
        if (!reason) return;
        runAction(() => lessonService.hideLesson(item.publicId, { reason, notifyStudents: false }), 'Đã ẩn bài học');
    };
    const deleteLesson = (item) => {
        if (!window.confirm('Xóa bài học? Bài đã có tiến độ sẽ được lưu trữ thay vì xóa cứng.')) return;
        runAction(() => lessonService.deleteLesson(item.publicId), 'Đã xóa hoặc lưu trữ bài học');
    };
    const startLesson = (item) => runAction(() => lessonService.startLesson(item.publicId), 'Đã bắt đầu bài học');
    const completeLesson = (item) => runAction(() => lessonService.completeLesson(item.publicId), 'Đã hoàn thành bài học');

    const kpis = [
        ['total', FiLayers, 'Tổng bài học', {}, summary.total],
        ['draft', FiClock, 'Bài học nháp', { status: 'DRAFT' }, summary.draft],
        ['published', FiCheckCircle, 'Đã xuất bản', { status: 'PUBLISHED' }, summary.published],
        ['hidden', FiEyeOff, 'Đang ẩn', { status: 'HIDDEN' }, summary.hidden],
        ['withVideo', FiVideo, 'Có video', { hasVideo: 'true' }, summary.withVideo],
        ['withExam', FiFileText, 'Có bài kiểm tra', { hasLinkedExam: 'true' }, summary.withExam],
        ['completedCount', FiUsers, 'Lượt hoàn thành', {}, summary.completedCount],
        ['averageCompletionRate', FiPlayCircle, 'Tỷ lệ hoàn thành TB', {}, summary.averageCompletionRate]
    ];

    if (!canRead) {
        return (
            <div className={cx('flow-shell')}>
                <AppSidebar workspaceKey={workspaceKey} />
                <main className={cx('flow-main', 'lessons')}><section className={cx('lessons__empty')}><FiShield /><h1>Bạn chưa có quyền xem bài học</h1></section></main>
            </div>
        );
    }

    return (
        <div className={cx('flow-shell')}>
            <AppSidebar workspaceKey={workspaceKey} />
            <main className={cx('flow-main', 'lessons')}>
                <section className={cx('lessons__hero')}>
                    <div><span>Quản lý học tập / Bài học</span><h1>Quản lý bài học</h1><p>Quản lý nội dung học tập, tài liệu và tiến độ bài học trong từng lớp</p></div>
                    <div>
                        <button type="button" onClick={loadLessons} disabled={loading}><FiRefreshCw /> Làm mới</button>
                        <button type="button" onClick={() => toast.info('Có thể xuất danh sách từ API /lessons với bộ lọc hiện tại.')}><FiDownload /> Xuất danh sách</button>
                        {canCreate ? <button type="button" className={cx('is-primary')} onClick={openCreate}><FiPlus /> Tạo bài học</button> : null}
                    </div>
                </section>

                <section className={cx('lessons__kpis')}>
                    {kpis.map(([key, Icon, label, filter, value]) => <KpiCard key={key} icon={Icon} label={label} value={value} trend={summary.trends?.[key]} active={filters.status === filter.status || filters.hasVideo === filter.hasVideo || filters.hasLinkedExam === filter.hasLinkedExam} onClick={() => setFilters((current) => ({ ...current, ...filter, page: 1 }))} />)}
                </section>

                <section className={cx('lessons__filters')}>
                    <div className={cx('lessons__filters-head')}><div><FiFilter /><div><strong>Bộ lọc bài học</strong><span>Tìm kiếm theo bài học, lớp, môn học và giảng viên</span></div></div><button type="button" onClick={clearFilters}>Xóa lọc</button></div>
                    <label className={cx('lessons__search')}><FiSearch /><input value={search} onChange={(event) => { setSearch(event.target.value); setFilter('page', 1); }} placeholder="Tìm tiêu đề bài học, mã lớp, môn học, giảng viên..." /></label>
                    <div className={cx('lessons__filter-grid')}>
                        <FilterField label="Lớp học" wide><select value={filters.classPublicId} onChange={(event) => setFilter('classPublicId', event.target.value)}><option value="">Tất cả lớp</option>{classes.map((item) => <option key={item.publicId} value={item.publicId}>{item.code} - {item.name}</option>)}</select></FilterField>
                        <FilterField label="Môn học" wide><select value={filters.courseId} onChange={(event) => setFilter('courseId', event.target.value)}><option value="">Tất cả môn học</option>{courses.map((item) => <option key={item.publicId} value={item.id}>{item.code} - {item.name}</option>)}</select></FilterField>
                        <FilterField label="Bộ môn"><select value={filters.departmentId} onChange={(event) => setFilter('departmentId', event.target.value)}><option value="">Tất cả bộ môn</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FilterField>
                        <FilterField label="Giảng viên"><select value={filters.lecturerId} onChange={(event) => setFilter('lecturerId', event.target.value)}><option value="">Tất cả giảng viên</option>{lecturers.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></FilterField>
                        <FilterField label="Trạng thái"><select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FilterField>
                        <FilterField label="Loại nội dung"><select value={filters.contentType} onChange={(event) => setFilter('contentType', event.target.value)}><option value="">Tất cả loại</option>{Object.entries(contentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FilterField>
                        <FilterField label="Có video"><select value={filters.hasVideo} onChange={(event) => setFilter('hasVideo', event.target.value)}><option value="">Tất cả</option><option value="true">Có video</option><option value="false">Không có video</option></select></FilterField>
                        <FilterField label="Có tài liệu"><select value={filters.hasAttachment} onChange={(event) => setFilter('hasAttachment', event.target.value)}><option value="">Tất cả</option><option value="true">Có tài liệu</option><option value="false">Không có tài liệu</option></select></FilterField>
                        <FilterField label="Có bài kiểm tra"><select value={filters.hasLinkedExam} onChange={(event) => setFilter('hasLinkedExam', event.target.value)}><option value="">Tất cả</option><option value="true">Có liên kết</option><option value="false">Không có</option></select></FilterField>
                        <FilterField label="Ngày tạo"><input type="date" value={filters.createdFrom} onChange={(event) => setFilter('createdFrom', event.target.value)} /></FilterField>
                        <FilterField label="Ngày xuất bản"><input type="date" value={filters.publishedFrom} onChange={(event) => setFilter('publishedFrom', event.target.value)} /></FilterField>
                    </div>
                </section>

                <section className={cx('lessons__panel')}>
                    {isStudent ? (
                        <div className={cx('lessons__student-grid')}>
                            {lessons.map((item) => (
                                <article key={item.publicId} className={cx('lessons__student-card')}>
                                    <header>
                                        <span>{contentTypeLabels[item.primaryContentType] || item.primaryContentType}</span>
                                        <StatusBadge status={item.status} />
                                    </header>
                                    <h2>{item.title}</h2>
                                    <p>{item.description || `${item.class?.code || ''} - ${item.class?.name || ''}`}</p>
                                    <div className={cx('lessons__student-meta')}>
                                        <span>{item.class?.course?.name || '-'}</span>
                                        <span>{item.durationMinutes || 0} phút</span>
                                        <span>{item.blockCount || 0} nội dung</span>
                                    </div>
                                    <div className={cx('lessons__student-progress')}>
                                        <div><span style={{ width: `${item.averageProgress || 0}%` }} /></div>
                                        <strong>{item.averageProgress || 0}%</strong>
                                    </div>
                                    <footer>
                                        <button type="button" onClick={() => openDetail(item)}><FiPlayCircle /> Vào học</button>
                                    </footer>
                                </article>
                            ))}
                        </div>
                    ) : (
                    <div className={cx('lessons__table-wrap')}>
                        <table className={cx('lessons__table')}>
                            <thead><tr><th><input type="checkbox" /></th><th>Tiêu đề bài học</th><th>Lớp học</th><th>Môn học</th><th>Loại nội dung</th><th>Thứ tự</th><th>Thời lượng</th><th>Tiến độ</th><th>Trạng thái</th><th>Người tạo</th><th>Cập nhật</th><th>Thao tác</th></tr></thead>
                            <tbody>
                                {lessons.map((item) => (
                                    <tr key={item.publicId}>
                                        <td><input type="checkbox" /></td>
                                        <td><strong>{item.title}</strong><br /><small>{item.chapter || '-'}</small></td>
                                        <td>{item.class?.code} - {item.class?.name}</td>
                                        <td>{item.class?.course?.code} - {item.class?.course?.name}</td>
                                        <td>{contentTypeLabels[item.primaryContentType] || item.primaryContentType}</td>
                                        <td>{item.orderIndex}</td>
                                        <td>{item.durationMinutes || 0} phút</td>
                                        <td><div className={cx('lessons__progress')}><span style={{ width: `${item.averageProgress || 0}%` }} /></div><small>{item.averageProgress || 0}%</small></td>
                                        <td><StatusBadge status={item.status} /></td>
                                        <td>{item.createdBy?.fullName || '-'}</td>
                                        <td>{formatDate(item.updatedAt)}</td>
                                        <td><div className={cx('lessons__actions-menu')}>
                                            <button type="button" onClick={() => openDetail(item)}><FiEye /> Xem</button>
                                            {canUpdate ? <button type="button" onClick={() => openEdit(item)}><FiEdit3 /> Sửa</button> : null}
                                            {canCreate ? <button type="button" onClick={() => runAction(() => lessonService.duplicateLesson(item.publicId), 'Đã sao chép bài học')}><FiCopy /> Sao chép</button> : null}
                                            {canPublish && ['DRAFT', 'HIDDEN'].includes(item.status) ? <button type="button" onClick={() => runAction(() => lessonService.publishLesson(item.publicId), 'Đã xuất bản bài học')}><FiUpload /> Xuất bản</button> : null}
                                            {canPublish && item.status === 'PUBLISHED' ? <button type="button" onClick={() => hideLesson(item)}><FiEyeOff /> Ẩn</button> : null}
                                            {canUpdate ? <button type="button" onClick={() => runAction(() => lessonService.archiveLesson(item.publicId), 'Đã lưu trữ bài học')}><FiArchive /> Lưu trữ</button> : null}
                                            {canDelete ? <button type="button" className={cx('is-danger')} onClick={() => deleteLesson(item)}><FiTrash2 /> Xóa</button> : null}
                                        </div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    )}
                    {!lessons.length ? <div className={cx('lessons__empty')}><FiBookOpen /><h2>Chưa có bài học</h2><p>Giảng viên tạo bài học trong lớp được phân công để sinh viên theo dõi tiến độ.</p></div> : null}
                </section>

                <section className={cx('lessons__pagination')}>
                    <button type="button" disabled={filters.page <= 1} onClick={() => setFilter('page', filters.page - 1)}>Trước</button>
                    <strong>Trang {filters.page}</strong>
                    <button type="button" onClick={() => setFilter('page', filters.page + 1)}>Sau</button>
                </section>

                {drawerMode ? (
                    <div className={cx('lessons__backdrop')}>
                        <aside className={cx('lessons__drawer')}>
                            <header><div><span>Bài học</span><h2>{drawerMode === 'form' ? (selectedLesson ? 'Chỉnh sửa bài học' : 'Tạo bài học') : selectedLesson?.title}</h2></div><button type="button" onClick={closeDrawer}><FiX /></button></header>
                            {drawerMode === 'form' ? (
                                <LessonForm initialValue={formInitial} classes={classes} loading={submitting} onCancel={closeDrawer} onSubmit={submitLesson} />
                            ) : (
                                <div className={cx('lessons__detail')}>
                                    <nav>{['overview', 'content', 'attachments', 'exams', 'progress', 'history'].map((tab) => <button key={tab} type="button" className={cx({ 'is-active': activeTab === tab })} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
                                    {activeTab === 'overview' ? <section><StatusBadge status={selectedLesson.status} /><dl><div><dt>Lớp học</dt><dd>{selectedLesson.class?.code}</dd></div><div><dt>Môn học</dt><dd>{selectedLesson.class?.course?.name}</dd></div><div><dt>Thứ tự</dt><dd>{selectedLesson.orderIndex}</dd></div><div><dt>Thời lượng</dt><dd>{selectedLesson.durationMinutes || 0} phút</dd></div></dl><p>{selectedLesson.description || 'Chưa có mô tả.'}</p></section> : null}
                                    {activeTab === 'content' ? <section>{(selectedLesson.blocks || []).map((block) => <article key={block.publicId}><strong>{contentTypeLabels[block.type] || block.type}: {block.title || 'Không tiêu đề'}</strong><p>{block.content || block.fileUrl || '-'}</p></article>)}</section> : null}
                                    {activeTab === 'attachments' ? <section>{(selectedLesson.attachments || []).map((file) => <article key={file.publicId}><strong>{file.fileName}</strong><span>{file.fileSize || 0} bytes · {formatDate(file.uploadedAt)}</span></article>)}{!selectedLesson.attachments?.length ? <p>Chưa có tài liệu đính kèm.</p> : null}</section> : null}
                                    {activeTab === 'exams' ? <section><p>Chưa có module bài kiểm tra liên kết. Các block loại EXAM đã được đánh dấu để nối khi module Exam hoàn thiện.</p></section> : null}
                                    {activeTab === 'progress' ? <section>{(selectedLesson.progresses || []).map((progress) => <article key={progress.publicId}><strong>{progress.student?.code} - {progress.student?.fullName}</strong><span>{progress.status} · {progress.progressPercent}% · {formatDate(progress.lastViewedAt)}</span></article>)}{!selectedLesson.progresses?.length ? <p>Chưa có tiến độ sinh viên.</p> : null}</section> : null}
                                    {activeTab === 'history' ? <section><p>Lịch sử thao tác đã được ghi Audit Log ở backend. Có thể lọc module `lessons` trong màn Audit Log.</p></section> : null}
                                    <footer>
                                        {canPublish && ['DRAFT', 'HIDDEN'].includes(selectedLesson.status) ? <button type="button" onClick={() => runAction(() => lessonService.publishLesson(selectedLesson.publicId), 'Đã xuất bản bài học')}>Xuất bản</button> : null}
                                        {canPublish && selectedLesson.status === 'PUBLISHED' ? <button type="button" onClick={() => hideLesson(selectedLesson)}>Ẩn bài học</button> : null}
                                        {isStudent && selectedLesson.status === 'PUBLISHED' ? <button type="button" onClick={() => startLesson(selectedLesson)}>Bắt đầu học</button> : null}
                                        {isStudent && selectedLesson.status === 'PUBLISHED' ? <button type="button" className={cx('is-primary')} onClick={() => completeLesson(selectedLesson)}>Đánh dấu hoàn thành</button> : null}
                                        {canUpdate ? <button type="button" onClick={() => setDrawerMode('form')}>Chỉnh sửa</button> : null}
                                        {canDelete ? <button type="button" className={cx('is-danger')} onClick={() => deleteLesson(selectedLesson)}>Xóa</button> : null}
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
