import { useEffect, useState } from 'react';
import classNames from 'classnames/bind';
import { useNavigate, useParams } from 'react-router-dom';
import {
    FiArrowLeft,
    FiCheckCircle,
    FiClock,
    FiDownload,
    FiEdit3,
    FiEyeOff,
    FiFileText,
    FiPlayCircle,
    FiUpload
} from 'react-icons/fi';
import { toast } from 'sonner';

import AppSidebar from '~/components/AppSidebar';
import { getApiErrorMessage } from '~/lib/apiPayload';
import { lessonService } from '~/services/lessonService';
import { useAuthStore } from '~/stores/useAuthStore';
import { userHasBackendPermission } from '~/utils/permissions';
import layoutStyles from '~/pages/FlowWorkbench/FlowWorkbench.module.scss';
import lessonStyles from './Lessons.module.scss';

const styles = { ...layoutStyles, ...lessonStyles };
const cx = classNames.bind(styles);

const statusLabels = { DRAFT: 'Nháp', PUBLISHED: 'Đã xuất bản', HIDDEN: 'Đang ẩn', ARCHIVED: 'Đã lưu trữ' };
const contentTypeLabels = { TEXT: 'Văn bản', VIDEO: 'Video', FILE: 'Tệp', IMAGE: 'Hình ảnh', LINK: 'Liên kết', CODE: 'Code', ASSIGNMENT: 'Bài tập', EXAM: 'Bài kiểm tra' };

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

function StatusBadge({ status }) {
    return <span className={cx('lessons__status', `is-${String(status).toLowerCase()}`)}>{statusLabels[status] || status}</span>;
}

function LessonBlockView({ block, index }) {
    const title = block.title || `Nội dung ${index + 1}`;
    const typeLabel = contentTypeLabels[block.type] || block.type;

    return (
        <article id={`block-${index + 1}`} className={cx('lessons__reader-block')}>
            <header>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                    <strong>{title}</strong>
                    <small>{typeLabel}</small>
                </div>
            </header>
            {block.type === 'VIDEO' && block.fileUrl ? (
                <div className={cx('lessons__media-box')}>
                    <FiPlayCircle />
                    <a href={block.fileUrl} target="_blank" rel="noreferrer">Mở video bài học</a>
                </div>
            ) : null}
            {block.type === 'IMAGE' && block.fileUrl ? <img className={cx('lessons__reader-image')} src={block.fileUrl} alt={title} /> : null}
            {block.type === 'CODE' ? <pre>{block.content || ''}</pre> : <p>{block.content || block.fileUrl || 'Chưa có nội dung cho block này.'}</p>}
            {['FILE', 'LINK', 'ASSIGNMENT', 'EXAM'].includes(block.type) && block.fileUrl ? (
                <a className={cx('lessons__resource-link')} href={block.fileUrl} target="_blank" rel="noreferrer"><FiDownload /> Mở tài nguyên</a>
            ) : null}
        </article>
    );
}

export default function LessonDetailPage() {
    const { workspaceKey = 'teacher', lessonPublicId } = useParams();
    const navigate = useNavigate();
    const currentUser = useAuthStore((state) => state.user);
    const canUpdate = userHasBackendPermission(currentUser, 'lessons.update');
    const canPublish = userHasBackendPermission(currentUser, 'lessons.publish');
    const isStudent = String(currentUser?.role || currentUser?.roleDetail?.code || '').toUpperCase() === 'STUDENT';
    const [lesson, setLesson] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    const loadLesson = async () => {
        try {
            setLesson(await lessonService.getLesson(lessonPublicId));
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Không tải được chi tiết bài học'));
        }
    };

    useEffect(() => { loadLesson(); }, [lessonPublicId]);

    const runAction = async (action, message) => {
        try {
            const updated = await action();
            if (updated?.publicId) setLesson(updated);
            toast.success(message);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Thao tác không thành công'));
        }
    };

    const hideLesson = () => {
        const reason = window.prompt('Lý do ẩn bài học');
        if (!reason) return;
        runAction(() => lessonService.hideLesson(lesson.publicId, { reason, notifyStudents: false }), 'Đã ẩn bài học');
    };

    if (!lesson) {
        return (
            <div className={cx('flow-shell')}>
                <AppSidebar workspaceKey={workspaceKey} />
                <main className={cx('flow-main', 'lessons')}>
                    <section className={cx('lessons__empty')}><h1>Đang tải bài học...</h1></section>
                </main>
            </div>
        );
    }

    if (isStudent) {
        const blocks = lesson.blocks || [];
        const progress = lesson.averageProgress || 0;

        return (
            <div className={cx('flow-shell')}>
                <AppSidebar workspaceKey={workspaceKey} />
                <main className={cx('flow-main', 'lessons')}>
                    <section className={cx('lessons__student-hero')}>
                        <button type="button" onClick={() => navigate(`/${workspaceKey}/lessons`)}><FiArrowLeft /> Quay lại danh sách</button>
                        <div>
                            <span>{lesson.class?.code} · {lesson.class?.course?.name}</span>
                            <h1>{lesson.title}</h1>
                            <p>{lesson.description || 'Bài học đã sẵn sàng. Hãy đọc lần lượt các nội dung bên dưới và đánh dấu hoàn thành khi đã học xong.'}</p>
                        </div>
                        <aside>
                            <StatusBadge status={lesson.status} />
                            <strong>{progress}%</strong>
                            <small>Tiến độ trung bình</small>
                        </aside>
                    </section>

                    <section className={cx('lessons__learning-shell')}>
                        <aside className={cx('lessons__learning-nav')}>
                            <strong>Nội dung bài học</strong>
                            <nav>
                                {blocks.map((block, index) => (
                                    <a key={block.publicId || index} href={`#block-${index + 1}`}>
                                        <span>{index + 1}</span>
                                        {block.title || contentTypeLabels[block.type] || 'Nội dung'}
                                    </a>
                                ))}
                            </nav>
                            <div className={cx('lessons__learning-meta')}>
                                <p><FiClock /> {lesson.durationMinutes || 0} phút</p>
                                <p><FiFileText /> {blocks.length} block nội dung</p>
                            </div>
                        </aside>

                        <div className={cx('lessons__reader')}>
                            <div className={cx('lessons__reader-toolbar')}>
                                <button type="button" onClick={() => runAction(() => lessonService.startLesson(lesson.publicId), 'Đã bắt đầu bài học')}><FiPlayCircle /> Bắt đầu học</button>
                                <button type="button" className={cx('is-primary')} onClick={() => runAction(() => lessonService.completeLesson(lesson.publicId), 'Đã đánh dấu hoàn thành')}><FiCheckCircle /> Đánh dấu hoàn thành</button>
                            </div>
                            {blocks.length ? blocks.map((block, index) => <LessonBlockView key={block.publicId || index} block={block} index={index} />) : (
                                <article className={cx('lessons__reader-block')}><p>Bài học chưa có nội dung hiển thị.</p></article>
                            )}
                            {lesson.attachments?.length ? (
                                <article className={cx('lessons__reader-block')}>
                                    <header><span><FiDownload /></span><div><strong>Tài liệu đính kèm</strong><small>{lesson.attachments.length} tài liệu</small></div></header>
                                    {lesson.attachments.map((file) => (
                                        <a key={file.publicId} className={cx('lessons__resource-link')} href={file.fileUrl} target="_blank" rel="noreferrer">
                                            <FiDownload /> {file.fileName} · {file.fileSize || 0} bytes
                                        </a>
                                    ))}
                                </article>
                            ) : null}
                        </div>
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div className={cx('flow-shell')}>
            <AppSidebar workspaceKey={workspaceKey} />
            <main className={cx('flow-main', 'lessons')}>
                <section className={cx('lessons__hero')}>
                    <div><span>Quản lý học tập / Bài học</span><h1>{lesson.title}</h1><p>{lesson.class?.code} - {lesson.class?.name} · {lesson.class?.course?.name}</p></div>
                    <div>
                        <button type="button" onClick={() => navigate(`/${workspaceKey}/lessons`)}><FiArrowLeft /> Quay lại</button>
                        {canUpdate ? <button type="button" onClick={() => navigate(`/${workspaceKey}/lessons/${lesson.publicId}/edit`)}><FiEdit3 /> Chỉnh sửa</button> : null}
                        {canPublish && ['DRAFT', 'HIDDEN'].includes(lesson.status) ? <button type="button" className={cx('is-primary')} onClick={() => runAction(() => lessonService.publishLesson(lesson.publicId), 'Đã xuất bản bài học')}><FiUpload /> Xuất bản</button> : null}
                        {canPublish && lesson.status === 'PUBLISHED' ? <button type="button" onClick={hideLesson}><FiEyeOff /> Ẩn</button> : null}
                    </div>
                </section>

                <section className={cx('lessons__panel', 'lessons__detail')}>
                    <nav>{['overview', 'content', 'attachments', 'exams', 'progress', 'history'].map((tab) => <button key={tab} type="button" className={cx({ 'is-active': activeTab === tab })} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
                    {activeTab === 'overview' ? <section><StatusBadge status={lesson.status} /><dl><div><dt>Lớp học</dt><dd>{lesson.class?.code}</dd></div><div><dt>Môn học</dt><dd>{lesson.class?.course?.name}</dd></div><div><dt>Thứ tự</dt><dd>{lesson.orderIndex}</dd></div><div><dt>Thời lượng</dt><dd>{lesson.durationMinutes || 0} phút</dd></div><div><dt>Người tạo</dt><dd>{lesson.createdBy?.fullName || '-'}</dd></div><div><dt>Ngày tạo</dt><dd>{formatDate(lesson.createdAt)}</dd></div><div><dt>Ngày xuất bản</dt><dd>{formatDate(lesson.publishedAt)}</dd></div><div><dt>Tiến độ TB</dt><dd>{lesson.averageProgress || 0}%</dd></div></dl><p>{lesson.description || 'Chưa có mô tả.'}</p></section> : null}
                    {activeTab === 'content' ? <section>{(lesson.blocks || []).map((block) => <article key={block.publicId}><strong>{contentTypeLabels[block.type] || block.type}: {block.title || 'Không tiêu đề'}</strong><p>{block.content || block.fileUrl || '-'}</p></article>)}</section> : null}
                    {activeTab === 'attachments' ? <section>{(lesson.attachments || []).map((file) => <article key={file.publicId}><strong>{file.fileName}</strong><span>{file.fileSize || 0} bytes · {formatDate(file.uploadedAt)}</span></article>)}{!lesson.attachments?.length ? <p>Chưa có tài liệu đính kèm.</p> : null}</section> : null}
                    {activeTab === 'exams' ? <section><p>Chưa có module bài kiểm tra liên kết. Các block loại EXAM đã được đánh dấu để nối khi module Exam hoàn thiện.</p></section> : null}
                    {activeTab === 'progress' ? <section>{(lesson.progresses || []).map((progress) => <article key={progress.publicId}><strong>{progress.student?.code} - {progress.student?.fullName}</strong><span>{progress.status} · {progress.progressPercent}% · {formatDate(progress.lastViewedAt)}</span></article>)}{!lesson.progresses?.length ? <p>Chưa có tiến độ sinh viên.</p> : null}</section> : null}
                    {activeTab === 'history' ? <section><p>Lịch sử thao tác đã được ghi Audit Log ở backend. Có thể lọc module `lessons` trong màn Audit Log.</p></section> : null}
                </section>
            </main>
        </div>
    );
}
