import { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiSave, FiTrash2 } from 'react-icons/fi';
import { toast } from 'sonner';

import AppSidebar from '~/components/AppSidebar';
import { getApiErrorMessage, unwrapApiPayload } from '~/lib/apiPayload';
import { classService } from '~/services/classService';
import { lessonService } from '~/services/lessonService';
import { useAuthStore } from '~/stores/useAuthStore';
import { userHasBackendPermission } from '~/utils/permissions';
import layoutStyles from '~/pages/FlowWorkbench/FlowWorkbench.module.scss';
import lessonStyles from './Lessons.module.scss';

const styles = { ...layoutStyles, ...lessonStyles };
const cx = classNames.bind(styles);

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

const statusLabels = {
    DRAFT: 'Nháp',
    PUBLISHED: 'Đã xuất bản',
    HIDDEN: 'Đang ẩn',
    ARCHIVED: 'Đã lưu trữ'
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

function Field({ label, children, error }) {
    return <label className={cx('lessons__field')}><span>{label}</span>{children}{error ? <em>{error}</em> : null}</label>;
}

export default function LessonEditorPage() {
    const { workspaceKey = 'teacher', lessonPublicId } = useParams();
    const navigate = useNavigate();
    const currentUser = useAuthStore((state) => state.user);
    const isEdit = Boolean(lessonPublicId);
    const canAccess = userHasBackendPermission(currentUser, isEdit ? 'lessons.update' : 'lessons.create');
    const [classes, setClasses] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const selectedClass = useMemo(() => classes.find((item) => item.publicId === form.classPublicId), [classes, form.classPublicId]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const classPayload = await classService.getClasses({ page: 1, limit: 200 });
                setClasses(normalizeItems(classPayload));
                if (lessonPublicId) {
                    const lesson = await lessonService.getLesson(lessonPublicId);
                    setForm({
                        ...emptyForm,
                        ...lesson,
                        classPublicId: lesson.class?.publicId || '',
                        availableFrom: lesson.availableFrom?.slice(0, 10) || '',
                        availableUntil: lesson.availableUntil?.slice(0, 10) || '',
                        blocks: lesson.blocks?.length
                            ? lesson.blocks.map((block, index) => ({ ...emptyBlock, ...block, orderIndex: index + 1 }))
                            : [{ ...emptyBlock }]
                    });
                }
            } catch (error) {
                toast.error(getApiErrorMessage(error, 'Không tải được dữ liệu bài học'));
            }
        };
        loadData();
    }, [lessonPublicId]);

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

    const submit = async () => {
        const nextErrors = {};
        if (!form.classPublicId) nextErrors.classPublicId = 'Chọn lớp học';
        if (!form.title.trim()) nextErrors.title = 'Nhập tiêu đề bài học';
        if (form.status === 'PUBLISHED' && !form.blocks.length) nextErrors.blocks = 'Cần ít nhất một block trước khi xuất bản';
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) return;

        setLoading(true);
        try {
            const payload = {
                ...form,
                orderIndex: Number(form.orderIndex),
                durationMinutes: asNumber(form.durationMinutes),
                availableFrom: form.availableFrom || undefined,
                availableUntil: form.availableUntil || undefined,
                blocks: form.blocks.map((block, index) => ({ ...block, orderIndex: index + 1, fileSize: asNumber(block.fileSize) }))
            };
            const saved = isEdit
                ? await lessonService.updateLesson(lessonPublicId, payload)
                : await lessonService.createLesson(payload);
            toast.success(isEdit ? 'Đã cập nhật bài học' : 'Đã tạo bài học');
            navigate(`/${workspaceKey}/lessons/${saved.publicId}`);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không lưu được bài học'));
        } finally {
            setLoading(false);
        }
    };

    if (!canAccess) {
        return <div className={cx('flow-shell')}><AppSidebar workspaceKey={workspaceKey} /><main className={cx('flow-main', 'lessons')}><section className={cx('lessons__empty')}><h1>Bạn chưa có quyền thao tác bài học</h1></section></main></div>;
    }

    return (
        <div className={cx('flow-shell')}>
            <AppSidebar workspaceKey={workspaceKey} />
            <main className={cx('flow-main', 'lessons')}>
                <section className={cx('lessons__hero')}>
                    <div><span>Quản lý học tập / Bài học</span><h1>{isEdit ? 'Chỉnh sửa bài học' : 'Tạo bài học'}</h1><p>Soạn nội dung học tập theo block, cấu hình hiển thị và tiến độ học.</p></div>
                    <div><button type="button" onClick={() => navigate(`/${workspaceKey}/lessons`)}><FiArrowLeft /> Quay lại</button><button type="button" className={cx('is-primary')} onClick={submit} disabled={loading}><FiSave /> Lưu bài học</button></div>
                </section>

                <section className={cx('lessons__panel', 'lessons__page-form')}>
                    <div className={cx('lessons__form-grid')}>
                        <Field label="Lớp học" error={errors.classPublicId}><select value={form.classPublicId} onChange={(event) => setValue('classPublicId', event.target.value)}><option value="">Chọn lớp được phân công</option>{classes.map((item) => <option key={item.publicId} value={item.publicId}>{item.code} - {item.name}</option>)}</select></Field>
                        <Field label="Môn học"><input value={selectedClass ? `${selectedClass.course?.code} - ${selectedClass.course?.name}` : 'Tự động theo lớp'} disabled /></Field>
                        <Field label="Tiêu đề bài học" error={errors.title}><input value={form.title} onChange={(event) => setValue('title', event.target.value)} /></Field>
                        <Field label="Chương hoặc tuần học"><input value={form.chapter} onChange={(event) => setValue('chapter', event.target.value)} /></Field>
                        <Field label="Thứ tự"><input type="number" min="1" value={form.orderIndex} onChange={(event) => setValue('orderIndex', event.target.value)} /></Field>
                        <Field label="Thời lượng dự kiến"><input type="number" min="0" value={form.durationMinutes} onChange={(event) => setValue('durationMinutes', event.target.value)} /></Field>
                        <Field label="Trạng thái"><select value={form.status} onChange={(event) => setValue('status', event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                        <Field label="Loại nội dung chính"><select value={form.primaryContentType} onChange={(event) => setValue('primaryContentType', event.target.value)}>{Object.entries(contentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                        <Field label="Hiển thị sau"><input type="date" value={form.availableFrom} onChange={(event) => setValue('availableFrom', event.target.value)} /></Field>
                        <Field label="Ẩn sau"><input type="date" value={form.availableUntil} onChange={(event) => setValue('availableUntil', event.target.value)} /></Field>
                        <Field label="Mô tả"><textarea value={form.description} onChange={(event) => setValue('description', event.target.value)} /></Field>
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
                                <select value={block.type} onChange={(event) => setBlock(index, 'type', event.target.value)}>{Object.entries(contentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                                <div className={cx('lessons__field')}><input value={block.title} onChange={(event) => setBlock(index, 'title', event.target.value)} placeholder="Tiêu đề block" /><textarea value={block.content} onChange={(event) => setBlock(index, 'content', event.target.value)} placeholder="Nội dung, code hoặc mô tả" /><input value={block.fileUrl} onChange={(event) => setBlock(index, 'fileUrl', event.target.value)} placeholder="File hoặc URL nếu có" /></div>
                                <input type="number" min="1" value={index + 1} disabled />
                                <button type="button" className={cx('is-danger')} onClick={() => removeBlock(index)}><FiTrash2 /></button>
                            </article>
                        ))}
                        <button type="button" onClick={addBlock}><FiPlus /> Thêm block</button>
                    </div>
                </section>
            </main>
        </div>
    );
}
