import classNames from 'classnames';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
    FiAlertTriangle,
    FiArrowLeft,
    FiBookOpen,
    FiCheck,
    FiCheckCircle,
    FiChevronDown,
    FiClock,
    FiCode,
    FiDownload,
    FiFileText,
    FiFlag,
    FiHelpCircle,
    FiLock,
    FiPlayCircle,
    FiUser
} from 'react-icons/fi';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { getApiMessage } from '~/shared/api/http.js';
import { ModalBackdrop } from '~/shared/components/ModalBackdrop.jsx';
import { studentApi } from '~/shared/api/studentApi.js';
import ui from '~/shared/styles/ui.module.scss';
import { categoryLabels, classLabels, formatDateTime, formatSchedule } from './studentUi.js';
import styles from './StudentClassPage.module.scss';

const lessonIcons = { TEXT: FiFileText, VIDEO: FiPlayCircle, PDF: FiBookOpen };
const questionIcons = { CODE: FiCode, HTML_CSS: FiCode, ESSAY: FiFileText, SINGLE_CHOICE: FiHelpCircle, MULTIPLE_CHOICE: FiHelpCircle };
const asList = (value) => (Array.isArray(value) ? value : value?.items ?? value?.data ?? []);

const getYoutubeEmbedUrl = (lesson) => {
    if (lesson.youtubeVideoId) return `https://www.youtube.com/embed/${lesson.youtubeVideoId}`;
    const match = lesson.resourceUrl?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/]+)/i);
    return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : '';
};

const buildCurriculumItems = (sections, assessments) => {
    const assessmentsByLesson = new Map();
    const unlinkedAssessments = [];
    assessments.forEach((assessment) => {
        if (assessment.lessonId === null || assessment.lessonId === undefined) {
            unlinkedAssessments.push(assessment);
            return;
        }
        const linked = assessmentsByLesson.get(assessment.lessonId) ?? [];
        linked.push(assessment);
        assessmentsByLesson.set(assessment.lessonId, linked);
    });
    const items = sections.flatMap((section) => (section.lessons ?? []).flatMap((lesson) => [
        { kind: 'lesson', value: lesson },
        ...(assessmentsByLesson.get(lesson.id) ?? []).map((assessment) => ({ kind: 'assessment', value: assessment }))
    ]));
    return [...items, ...unlinkedAssessments.map((assessment) => ({ kind: 'assessment', value: assessment }))];
};

function PdfViewer({ lesson }) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let objectUrl = '';
        let active = true;
        const load = async () => {
            try {
                if (lesson.media?.publicId ?? lesson.mediaPublicId) {
                    const blob = await studentApi.mediaBlob(lesson.media?.publicId ?? lesson.mediaPublicId);
                    objectUrl = URL.createObjectURL(blob);
                    if (active) setUrl(`${objectUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`);
                } else if (lesson.resourceUrl) {
                    if (active) setUrl(lesson.resourceUrl);
                }
            } catch (error) {
                toast.error(getApiMessage(error, 'Không thể mở tài liệu PDF'));
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [lesson]);

    if (loading) return <div className={styles.contentState}>Đang tải PDF...</div>;
    if (!url) return <div className={styles.contentState}>Tài liệu chưa được đính kèm.</div>;
    return <div className={styles.pdfFrame}><div><strong>{lesson.media?.originalName ?? lesson.title}</strong><a href={url} target="_blank" rel="noreferrer"><FiDownload /> Mở riêng</a></div><iframe src={url} title={lesson.title} /></div>;
}

function LessonContent({ lesson }) {
    if (lesson.type === 'TEXT') return <article className={styles.richText} dangerouslySetInnerHTML={{ __html: lesson.content || '<p>Nội dung đang được cập nhật.</p>' }} />;
    if (lesson.type === 'VIDEO') {
        const embedUrl = getYoutubeEmbedUrl(lesson);
        return embedUrl ? <div className={styles.videoFrame}><iframe src={embedUrl} title={lesson.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : <div className={styles.contentState}>Video chưa được đính kèm.</div>;
    }
    if (lesson.type === 'PDF') return <PdfViewer lesson={lesson} />;
    return <div className={styles.contentState}>Nội dung chưa sẵn sàng.</div>;
}

export function StudentClassPage() {
    const { classPublicId } = useParams();
    const navigate = useNavigate();
    const [courseClass, setCourseClass] = useState(null);
    const [sections, setSections] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [selected, setSelected] = useState(null);
    const [expanded, setExpanded] = useState([]);
    const [completed, setCompleted] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assessmentDialog, setAssessmentDialog] = useState(null);
    const [identityConfirmed, setIdentityConfirmed] = useState(false);
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        let active = true;
        const loadClass = async () => {
            try {
                const enrollmentsValue = await studentApi.myEnrollments();
                if (!active) return;
                const enrollment = asList(enrollmentsValue).find((item) => item.class?.publicId === classPublicId && item.status === 'ACTIVE');
                setCourseClass(enrollment?.class ?? null);
                if (!enrollment || enrollment.class?.status !== 'IN_PROGRESS') return;

                const [contentValue, assessmentValue] = await Promise.all([
                    studentApi.classContent(classPublicId),
                    studentApi.classAssessments(classPublicId)
                ]);
                if (!active) return;
                const content = asList(contentValue);
                const assessmentList = asList(assessmentValue);
                setSections(content);
                setAssessments(assessmentList);
                setExpanded(content.map((item) => item.publicId));
                const completedLessons = content.flatMap((item) => item.lessons ?? [])
                    .filter((lesson) => lesson.isCompleted)
                    .map((lesson) => lesson.publicId);
                setCompleted(completedLessons);
                const curriculum = buildCurriculumItems(content, assessmentList);
                const firstAvailable = curriculum.find((item) => !item.value.isLocked && !item.value.isCompleted)
                    ?? curriculum.find((item) => !item.value.isLocked)
                    ?? null;
                setSelected(firstAvailable);
            } catch (error) {
                toast.error(getApiMessage(error, 'Không thể tải nội dung lớp học'));
            } finally {
                if (active) setLoading(false);
            }
        };
        loadClass();
        return () => { active = false; };
    }, [classPublicId]);

    const curriculumItems = useMemo(() => buildCurriculumItems(sections, assessments), [sections, assessments]);
    const curriculumAccess = useMemo(() => {
        const state = new Map();
        let sequenceOpen = true;
        curriculumItems.forEach((item) => {
            const isCompleted = item.kind === 'lesson'
                ? completed.includes(item.value.publicId)
                : Boolean(item.value.isCompleted);
            state.set(`${item.kind}:${item.value.publicId}`, { isCompleted, isLocked: !sequenceOpen });
            if (!isCompleted) sequenceOpen = false;
        });
        return state;
    }, [completed, curriculumItems]);
    const completedItemCount = [...curriculumAccess.values()].filter((item) => item.isCompleted).length;
    const progress = curriculumItems.length ? Math.round((completedItemCount / curriculumItems.length) * 100) : 0;

    const completeLesson = async () => {
        const lesson = selected?.value;
        if (!lesson || completed.includes(lesson.publicId)) return;
        try {
            await studentApi.completeLesson(lesson.publicId);
            const next = [...completed, lesson.publicId];
            setCompleted(next);
            toast.success('Đã ghi nhận hoàn thành bài học');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể ghi nhận hoàn thành'));
        }
    };

    const openAssessment = (assessment) => {
        if (curriculumAccess.get(`assessment:${assessment.publicId}`)?.isLocked) {
            toast.error('Bạn phải hoàn thành nội dung trước để mở bài đánh giá này');
            return;
        }
        setSelected({ kind: 'assessment', value: assessment });
        setIdentityConfirmed(false);
        setAssessmentDialog(assessment);
    };

    const startAssessment = async () => {
        if (!assessmentDialog || !identityConfirmed) return;
        setStarting(true);
        try {
            if (['MIDTERM', 'FINAL'].includes(assessmentDialog.category) && !document.fullscreenElement) {
                await document.documentElement.requestFullscreen?.();
            }
            const attempt = await studentApi.startAssessment(assessmentDialog.publicId);
            const payload = { attempt, assessment: assessmentDialog, courseClass };
            sessionStorage.setItem(`student-attempt:${attempt.publicId}`, JSON.stringify(payload));
            navigate(`/exam/attempt/${attempt.publicId}`, { state: payload });
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể bắt đầu bài làm'));
            setStarting(false);
        }
    };

    if (loading) return <div className={styles.contentState}>Đang tải lớp học...</div>;
    if (!courseClass) return <div className={styles.contentState}>Bạn không có quyền truy cập lớp học này.</div>;
    if (courseClass.status !== 'IN_PROGRESS') return (
        <section className={classNames(styles.contentState, styles.accessState)}>
            <FiLock />
            <h2>Module học chưa mở</h2>
            <p>Sinh viên chỉ được truy cập nội dung khi lớp ở trạng thái Đang học.</p>
            <Link className={ui.secondaryButton} to="/student/classes"><FiArrowLeft /> Quay lại lớp học của tôi</Link>
        </section>
    );

    return (
        <div className={styles.classWorkspace}>
            <header className={styles.classHeader}>
                <div><Link to="/student/classes"><FiArrowLeft /> Lớp học của tôi</Link><span>{courseClass.subject?.code} · {courseClass.code}</span><h2>{courseClass.subject?.name ?? courseClass.name}</h2></div>
                <div className={styles.classHeaderMeta}><span><FiUser /> {courseClass.lecturer?.fullName ?? 'Chưa phân công'}</span><span><FiClock /> {formatSchedule(courseClass.schedules)}</span><strong>{classLabels[courseClass.status] ?? courseClass.status}</strong></div>
            </header>

            <section className={styles.progressBand}>
                <div><strong>{progress}%</strong><span>Tiến độ cá nhân</span></div>
                <div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div>
                <small>{completedItemCount}/{curriculumItems.length} nội dung đã hoàn thành</small>
            </section>

            <div className={styles.workspaceBody}>
                <aside className={styles.curriculum}>
                    <div className={styles.curriculumTitle}><h3>Nội dung lớp học</h3><span>{sections.length} chương</span></div>
                    {sections.map((section, sectionIndex) => {
                        const isExpanded = expanded.includes(section.publicId);
                        const sectionLessonIds = new Set((section.lessons ?? []).map((lesson) => lesson.id));
                        const unlinkedAssessments = sectionIndex === sections.length - 1
                            ? assessments.filter((item) => !item.lessonId)
                            : [];
                        return (
                            <section className={styles.chapter} key={section.publicId}>
                                <button type="button" onClick={() => setExpanded((current) => isExpanded ? current.filter((id) => id !== section.publicId) : [...current, section.publicId])}><span><small>Chương {sectionIndex + 1}</small><strong>{section.title}</strong></span><FiChevronDown className={classNames({ [styles.rotate]: isExpanded })} /></button>
                                {isExpanded ? <div className={styles.chapterItems}>
                                    {(section.lessons ?? []).map((lesson, lessonIndex) => {
                                        const Icon = lessonIcons[lesson.type] ?? FiFileText;
                                        const lessonState = curriculumAccess.get(`lesson:${lesson.publicId}`);
                                        const linkedAssessments = assessments.filter((item) => item.lessonId === lesson.id);
                                        return <Fragment key={lesson.publicId}>
                                            <button
                                                className={classNames({
                                                    [styles.itemActive]: selected?.kind === 'lesson' && selected.value.publicId === lesson.publicId,
                                                    [styles.itemLocked]: lessonState?.isLocked
                                                })}
                                                type="button"
                                                disabled={lessonState?.isLocked}
                                                onClick={() => setSelected({ kind: 'lesson', value: lesson })}
                                            >
                                                <span className={classNames(styles.itemIcon, { [styles.itemDone]: lessonState?.isCompleted })}>
                                                    {lessonState?.isLocked ? <FiLock /> : lessonState?.isCompleted ? <FiCheck /> : <Icon />}
                                                </span>
                                                <span><strong>{lessonIndex + 1}. {lesson.title}</strong><small>{lessonState?.isLocked ? 'Hoàn thành nội dung trước để mở khóa' : lesson.type === 'TEXT' ? 'Bài đọc' : lesson.type === 'VIDEO' ? 'Video' : 'Tài liệu PDF'}</small></span>
                                            </button>
                                            {linkedAssessments.map((assessment) => {
                                                const AssessmentIcon = questionIcons[assessment.questionType] ?? FiFlag;
                                                const assessmentState = curriculumAccess.get(`assessment:${assessment.publicId}`);
                                                return <button
                                                    className={classNames(styles.assessmentItem, {
                                                        [styles.itemActive]: selected?.kind === 'assessment' && selected.value.publicId === assessment.publicId,
                                                        [styles.itemLocked]: assessmentState?.isLocked
                                                    })}
                                                    type="button"
                                                    key={assessment.publicId}
                                                    disabled={assessmentState?.isLocked}
                                                    onClick={() => setSelected({ kind: 'assessment', value: assessment })}
                                                >
                                                    <span className={classNames(styles.itemIcon, { [styles.itemDone]: assessmentState?.isCompleted })}>
                                                        {assessmentState?.isLocked ? <FiLock /> : assessmentState?.isCompleted ? <FiCheck /> : <AssessmentIcon />}
                                                    </span>
                                                    <span><strong>{assessment.title}</strong><small>{assessmentState?.isLocked ? 'Hoàn thành nội dung trước để mở khóa' : `${categoryLabels[assessment.category] ?? 'Đánh giá'} · Hạn ${formatDateTime(assessment.closeAt)}`}</small></span>
                                                </button>;
                                            })}
                                        </Fragment>;
                                    })}
                                    {unlinkedAssessments.map((assessment) => {
                                        const Icon = questionIcons[assessment.questionType] ?? FiFlag;
                                        const assessmentState = curriculumAccess.get(`assessment:${assessment.publicId}`);
                                        return <button className={classNames(styles.assessmentItem, { [styles.itemActive]: selected?.kind === 'assessment' && selected.value.publicId === assessment.publicId, [styles.itemLocked]: assessmentState?.isLocked })} type="button" key={assessment.publicId} disabled={assessmentState?.isLocked} onClick={() => setSelected({ kind: 'assessment', value: assessment })}><span className={classNames(styles.itemIcon, { [styles.itemDone]: assessmentState?.isCompleted })}>{assessmentState?.isLocked ? <FiLock /> : assessmentState?.isCompleted ? <FiCheck /> : <Icon />}</span><span><strong>{assessment.title}</strong><small>{assessmentState?.isLocked ? 'Hoàn thành nội dung trước để mở khóa' : `${categoryLabels[assessment.category] ?? 'Đánh giá'} · Hạn ${formatDateTime(assessment.closeAt)}`}</small></span></button>;
                                    })}
                                </div> : null}
                            </section>
                        );
                    })}
                </aside>

                <main className={styles.learningContent}>
                    {selected?.kind === 'lesson' ? <>
                        <div className={styles.contentHeader}><div><span>{selected.value.type === 'TEXT' ? 'Bài đọc' : selected.value.type === 'VIDEO' ? 'Video' : 'Tài liệu PDF'}</span><h2>{selected.value.title}</h2></div><button className={completed.includes(selected.value.publicId) ? ui.secondaryButton : ui.primaryButton} type="button" disabled={completed.includes(selected.value.publicId)} onClick={completeLesson}><FiCheckCircle /> {completed.includes(selected.value.publicId) ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}</button></div>
                        <LessonContent lesson={selected.value} />
                    </> : selected?.kind === 'assessment' ? <section className={styles.assessmentOverview}>
                        <span className={styles.assessmentBadge}>{categoryLabels[selected.value.category] ?? 'Đánh giá'}</span>
                        <h2>{selected.value.title}</h2>
                        {selected.value.description ? <p>{selected.value.description}</p> : null}
                        <dl><div><dt>Mở bài</dt><dd>{formatDateTime(selected.value.openAt)}</dd></div><div><dt>Hạn nộp</dt><dd>{formatDateTime(selected.value.closeAt)}</dd></div><div><dt>Thời gian</dt><dd>{selected.value.durationMinutes ? `${selected.value.durationMinutes} phút` : 'Không giới hạn'}</dd></div><div><dt>Số lượt</dt><dd>{selected.value.maxAttempts ?? 1} lượt</dd></div></dl>
                        <button className={ui.primaryButton} type="button" onClick={() => openAssessment(selected.value)}><FiPlayCircle /> Đọc nội quy và bắt đầu</button>
                    </section> : <div className={styles.contentState}><FiBookOpen /> Chọn một nội dung để bắt đầu học.</div>}
                </main>
            </div>

            {assessmentDialog ? <ModalBackdrop onClose={() => setAssessmentDialog(null)}>
                <section className={classNames(ui.modal, styles.instructionDialog)} role="dialog" aria-modal="true" aria-labelledby="assessment-title">
                    <div className={ui.modalHeader}><div><p className={ui.eyebrow}>{categoryLabels[assessmentDialog.category] ?? 'Đánh giá'}</p><h3 id="assessment-title">{assessmentDialog.title}</h3></div><button className={ui.iconButton} type="button" onClick={() => setAssessmentDialog(null)}>×</button></div>
                    <div className={styles.rules}><div><FiClock /><span><strong>{assessmentDialog.durationMinutes ? `${assessmentDialog.durationMinutes} phút` : 'Theo hạn đóng bài'}</strong><small>Bài tự nộp khi hết thời gian</small></span></div><div><FiAlertTriangle /><span><strong>Tự động lưu câu trả lời</strong><small>Chuyển tab sẽ được ghi nhận</small></span></div>{['MIDTERM', 'FINAL'].includes(assessmentDialog.category) ? <div><FiLock /><span><strong>Chế độ toàn màn hình</strong><small>Thoát toàn màn hình được tính là vi phạm</small></span></div> : null}</div>
                    <label className={styles.identityCheck}><input type="checkbox" checked={identityConfirmed} onChange={(event) => setIdentityConfirmed(event.target.checked)} /><span>Tôi xác nhận đúng danh tính và đã đọc nội quy làm bài.</span></label>
                    <div className={ui.modalFooter}><button className={ui.secondaryButton} type="button" onClick={() => setAssessmentDialog(null)}>Quay lại</button><button className={ui.primaryButton} type="button" disabled={!identityConfirmed || starting} onClick={startAssessment}>{starting ? 'Đang vào bài...' : 'Bắt đầu làm bài'}</button></div>
                </section>
            </ModalBackdrop> : null}
        </div>
    );
}
