import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiAlertTriangle,
    FiArrowRight,
    FiAward,
    FiBookOpen,
    FiCalendar,
    FiCheckCircle,
    FiClock,
    FiCode,
    FiEdit3,
    FiFileText,
    FiFilter,
    FiRefreshCw,
    FiSave,
    FiSearch,
    FiSend,
    FiUsers
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { adminModulesApi } from '~/shared/api/adminModulesApi.js';
import { getApiMessage } from '~/shared/api/http.js';
import { useAuthStore } from '~/shared/store/authStore.js';
import ui from '~/shared/styles/ui.module.scss';
import {
    asList,
    categoryLabels,
    classStatusLabels,
    formatDateTime,
    formatSchedule,
    isManualAnswer,
    isPendingManualAnswer,
    lecturerClasses,
    todayKeys
} from './lecturerUi.js';
import styles from './LecturerPortalPages.module.scss';

const categoryScoreLabels = { ASSIGNMENT: 'Bài tập', QUIZ: 'Kiểm tra', MIDTERM: 'Giữa kỳ', FINAL: 'Cuối kỳ' };
const automaticQuestionTypes = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'CODE'];
const automaticQuestionTypeLabels = {
    SINGLE_CHOICE: 'Một đáp án',
    MULTIPLE_CHOICE: 'Nhiều đáp án',
    CODE: 'Code'
};
const judgeStatusLabels = {
    NOT_REQUIRED: 'Đã chấm',
    QUEUED: 'Đang chờ chấm',
    PROCESSING: 'Đang chấm',
    ACCEPTED: 'Đạt',
    WRONG_ANSWER: 'Sai kết quả',
    ERROR: 'Lỗi máy chấm',
    COMPILE_ERROR: 'Lỗi biên dịch',
    RUNTIME_ERROR: 'Lỗi thực thi',
    TIME_LIMIT_EXCEEDED: 'Quá thời gian',
    SYSTEM_ERROR: 'Lỗi hệ thống'
};
const getCategoryScoreValue = (row, category) => {
    if (Array.isArray(row.categoryScores)) {
        return row.categoryScores.find((score) => score.category === category)?.score ?? '-';
    }
    return row.categoryScores?.[category] ?? '-';
};

const loadClassBundle = async (courseClass) => {
    const [assessmentResult, gradebookResult, contentResult] = await Promise.allSettled([
        adminModulesApi.classAssessments(courseClass.publicId),
        adminModulesApi.classGradebook(courseClass.publicId),
        adminModulesApi.classContent(courseClass.publicId)
    ]);
    const assessments = assessmentResult.status === 'fulfilled' ? asList(assessmentResult.value) : [];
    const attemptResults = await Promise.allSettled(assessments.map((item) => adminModulesApi.assessmentAttempts(item.publicId)));
    const attempts = attemptResults.flatMap((result, index) => result.status === 'fulfilled'
        ? asList(result.value).map((attempt) => ({ ...attempt, assessment: assessments[index], courseClass }))
        : []);
    return {
        courseClass,
        assessments,
        attempts,
        gradebook: gradebookResult.status === 'fulfilled' ? gradebookResult.value : null,
        content: contentResult.status === 'fulfilled' ? asList(contentResult.value) : []
    };
};

function StatePanel({ children }) {
    return <div className={styles.statePanel}>{children}</div>;
}

function PageTitle({ eyebrow, title, children }) {
    return <section className={styles.pageTitle}><div><p className={ui.eyebrow}>{eyebrow}</p><h2>{title}</h2></div>{children ? <div className={styles.pageActions}>{children}</div> : null}</section>;
}

function statusClass(status) {
    if (['IN_PROGRESS', 'COMPLETED'].includes(status)) return styles.statusGood;
    if (['CANCELLED'].includes(status)) return styles.statusDanger;
    return styles.statusWarning;
}

export function LecturerDashboardPage() {
    const user = useAuthStore((state) => state.user);
    const userPublicId = user?.publicId ?? user?.id;
    const [bundles, setBundles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openedAt] = useState(() => Date.now());

    useEffect(() => {
        const task = window.setTimeout(async () => {
            try {
                const classes = lecturerClasses(await adminModulesApi.listClasses(), userPublicId);
                const values = await Promise.all(classes.map(loadClassBundle));
                setBundles(values);
            } catch (error) {
                toast.error(getApiMessage(error, 'Không thể tải dashboard giảng viên'));
            } finally {
                setLoading(false);
            }
        }, 0);
        return () => window.clearTimeout(task);
    }, [userPublicId]);

    if (loading) return <StatePanel><FiRefreshCw className={styles.spin} /> Đang tải công việc giảng dạy...</StatePanel>;

    const today = todayKeys[new Date(openedAt).getDay()];
    const todaySchedules = bundles.flatMap((bundle) => (bundle.courseClass.schedules ?? [])
        .filter((item) => item.weekDay === today)
        .map((item) => ({ ...item, courseClass: bundle.courseClass })));
    const assessments = bundles.flatMap((bundle) => bundle.assessments.map((item) => ({ ...item, courseClass: bundle.courseClass })));
    const upcoming = assessments.filter((item) => new Date(item.closeAt).getTime() >= openedAt).sort((a, b) => new Date(a.closeAt) - new Date(b.closeAt));
    const exams = assessments.filter((item) => ['MIDTERM', 'FINAL'].includes(item.category) && new Date(item.openAt).getTime() >= openedAt).sort((a, b) => new Date(a.openAt) - new Date(b.openAt));
    const pendingAnswers = bundles.flatMap((bundle) => bundle.attempts.flatMap((attempt) => attempt.answers?.filter(isPendingManualAnswer).map((answer) => ({ answer, attempt })) ?? []));
    const atRisk = bundles.flatMap((bundle) => (bundle.gradebook?.students ?? []).filter((row) => row.passed === false).map((row) => ({ ...row, courseClass: bundle.courseClass })));

    return (
        <div className={ui.pageStack}>
            <section className={styles.welcomeBand}><div><p className={ui.eyebrow}>Công việc giảng dạy</p><h2>Chào {user?.fullName ?? 'Giảng viên'}</h2></div><span>{bundles.length} lớp được phân công</span></section>
            <section className={styles.metricGrid}>
                <article><span className={styles.blueIcon}><FiBookOpen /></span><div><strong>{bundles.length}</strong><small>Lớp phụ trách</small></div></article>
                <article><span className={styles.greenIcon}><FiCalendar /></span><div><strong>{todaySchedules.length}</strong><small>Lịch dạy hôm nay</small></div></article>
                <article><span className={styles.amberIcon}><FiEdit3 /></span><div><strong>{pendingAnswers.length}</strong><small>Tự luận chờ chấm</small></div></article>
                <article><span className={styles.roseIcon}><FiAlertTriangle /></span><div><strong>{atRisk.length}</strong><small>Sinh viên có nguy cơ</small></div></article>
            </section>

            <div className={styles.dashboardGrid}>
                <section className={styles.panel}><div className={styles.panelHeading}><div><p className={ui.eyebrow}>Hôm nay</p><h3>Lịch dạy</h3></div><Link to="/lecturer/classes">Xem lớp <FiArrowRight /></Link></div><div className={styles.scheduleList}>{todaySchedules.length ? todaySchedules.map((item) => <article key={`${item.courseClass.publicId}-${item.id ?? item.startTime}`}><time>{item.startTime}</time><div><strong>{item.courseClass.subject?.name}</strong><span>{item.courseClass.code} · {item.room ?? 'Chưa có phòng'} · đến {item.endTime}</span></div></article>) : <StatePanel>Hôm nay không có lịch dạy</StatePanel>}</div></section>
                <section className={styles.panel}><div className={styles.panelHeading}><div><p className={ui.eyebrow}>Đánh giá</p><h3>Sắp hết hạn</h3></div></div><div className={styles.deadlineList}>{upcoming.length ? upcoming.slice(0, 5).map((item) => <Link to={`/lecturer/classes/${item.courseClass.publicId}`} key={item.publicId}><span>{categoryLabels[item.category]}</span><strong>{item.title}</strong><small>{item.courseClass.code} · {formatDateTime(item.closeAt)}</small></Link>) : <StatePanel>Không có bài sắp hết hạn</StatePanel>}</div></section>
            </div>

            <div className={styles.dashboardGrid}>
                <section className={styles.panel}><div className={styles.panelHeading}><div><p className={ui.eyebrow}>Lịch thi</p><h3>Bài thi sắp diễn ra</h3></div></div><div className={styles.compactList}>{exams.length ? exams.slice(0, 5).map((item) => <article key={item.publicId}><span><FiClock /></span><div><strong>{item.title}</strong><small>{item.courseClass.code} · Mở {formatDateTime(item.openAt)}</small></div></article>) : <StatePanel>Chưa có lịch thi sắp tới</StatePanel>}</div></section>
                <section className={styles.panel}><div className={styles.panelHeading}><div><p className={ui.eyebrow}>Cần chú ý</p><h3>Sinh viên có nguy cơ không đạt</h3></div><Link to="/lecturer/grades">Xem bảng điểm <FiArrowRight /></Link></div><div className={styles.compactList}>{atRisk.length ? atRisk.slice(0, 5).map((row) => <article key={`${row.courseClass.publicId}-${row.student.publicId}`}><span><FiAlertTriangle /></span><div><strong>{row.student.fullName}</strong><small>{row.courseClass.code} · Tạm tính {row.calculatedScore}</small></div></article>) : <StatePanel>Chưa ghi nhận sinh viên có nguy cơ</StatePanel>}</div></section>
            </div>
        </div>
    );
}

export function LecturerClassesPage() {
    const user = useAuthStore((state) => state.user);
    const userPublicId = user?.publicId ?? user?.id;
    const [bundles, setBundles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', subject: 'ALL', status: 'ALL' });

    useEffect(() => {
        const task = window.setTimeout(async () => {
            try {
                const classes = lecturerClasses(await adminModulesApi.listClasses(), userPublicId);
                setBundles(await Promise.all(classes.map(loadClassBundle)));
            } catch (error) {
                toast.error(getApiMessage(error, 'Không thể tải lớp được phân công'));
            } finally {
                setLoading(false);
            }
        }, 0);
        return () => window.clearTimeout(task);
    }, [userPublicId]);

    const subjects = useMemo(() => Array.from(new Map(bundles.map((bundle) => [bundle.courseClass.subject?.publicId, bundle.courseClass.subject])).values()).filter(Boolean), [bundles]);
    const filtered = bundles.filter((bundle) => {
        const item = bundle.courseClass;
        const keyword = filters.search.trim().toLowerCase();
        return (!keyword || [item.code, item.name, item.subject?.code, item.subject?.name].some((value) => value?.toLowerCase().includes(keyword)))
            && (filters.subject === 'ALL' || item.subject?.publicId === filters.subject)
            && (filters.status === 'ALL' || item.status === filters.status);
    });

    return <div className={ui.pageStack}>
        <PageTitle eyebrow="Phân công giảng dạy" title="Lớp học của tôi" />
        <section className={styles.filterBar}><label className={styles.searchField}><FiSearch /><input placeholder="Tìm mã lớp hoặc môn học" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></label><label><FiBookOpen /><select value={filters.subject} onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))}><option value="ALL">Tất cả môn</option>{subjects.map((item) => <option value={item.publicId} key={item.publicId}>{item.code} - {item.name}</option>)}</select></label><label><FiFilter /><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="ALL">Tất cả trạng thái</option>{Object.entries(classStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></section>
        {loading ? <StatePanel><FiRefreshCw className={styles.spin} /> Đang tải lớp học...</StatePanel> : filtered.length ? <section className={styles.classList}>{filtered.map((bundle) => {
            const item = bundle.courseClass;
            const students = bundle.gradebook?.students?.length ?? 0;
            const lessonCount = bundle.content.reduce((sum, section) => sum + (section.lessons?.length ?? 0), 0);
            const publishedCount = bundle.content.reduce((sum, section) => sum + (section.lessons?.filter((lesson) => lesson.isPublished).length ?? 0), 0);
            const contentProgress = lessonCount ? Math.round((publishedCount / lessonCount) * 100) : 0;
            return <article key={item.publicId}><div className={styles.classMark}><FiBookOpen /></div><div className={styles.classInfo}><div><span>{item.subject?.code} · {item.code}</span><h3>{item.subject?.name ?? item.name}</h3></div><div className={styles.classMeta}><span><FiUsers /> {students}/{item.maxStudents} sinh viên</span><span><FiCalendar /> {formatSchedule(item.schedules)}</span><span><FiFileText /> {lessonCount} nội dung</span></div><div className={styles.progressRow}><span>Đã công khai {contentProgress}% nội dung</span><div><i style={{ width: `${contentProgress}%` }} /></div></div></div><div className={styles.classAction}><span className={classNames(styles.status, statusClass(item.status))}>{classStatusLabels[item.status] ?? item.status}</span><Link className={ui.secondaryButton} to={`/lecturer/classes/${item.publicId}`}>Mở chi tiết <FiArrowRight /></Link></div></article>;
        })}</section> : <StatePanel>Không có lớp phù hợp với bộ lọc</StatePanel>}
    </div>;
}

export function LecturerGradingPage() {
    const user = useAuthStore((state) => state.user);
    const userPublicId = user?.publicId ?? user?.id;
    const [bundles, setBundles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pendingOnly, setPendingOnly] = useState(true);
    const [classFilter, setClassFilter] = useState('ALL');
    const [drafts, setDrafts] = useState({});
    const [savingId, setSavingId] = useState('');

    const load = useCallback(async () => {
        await Promise.resolve();
        setLoading(true);
        try {
            const classes = lecturerClasses(await adminModulesApi.listClasses(), userPublicId);
            setBundles(await Promise.all(classes.map(loadClassBundle)));
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể tải bài cần chấm'));
        } finally {
            setLoading(false);
        }
    }, [userPublicId]);

    useEffect(() => { const task = window.setTimeout(load, 0); return () => window.clearTimeout(task); }, [load]);

    const rows = bundles.flatMap((bundle) => bundle.attempts.flatMap((attempt) => (attempt.answers ?? [])
        .filter(isManualAnswer)
        .map((answer) => ({ answer, attempt, assessment: attempt.assessment, courseClass: bundle.courseClass }))));
    const filteredRows = rows.filter((row) => (!pendingOnly || isPendingManualAnswer(row.answer)) && (classFilter === 'ALL' || row.courseClass.publicId === classFilter));

    const grade = async (row) => {
        const draft = drafts[row.answer.id] ?? {};
        const points = Number(draft.points ?? row.answer.awardedPoints);
        if (!Number.isFinite(points) || points < 0 || points > Number(row.answer.question?.points ?? 0)) {
            toast.error('Điểm chấm không hợp lệ');
            return;
        }
        setSavingId(row.answer.id);
        try {
            await adminModulesApi.gradeAnswer(row.answer.id, { awardedPoints: points, feedback: draft.feedback ?? row.answer.feedback ?? '' });
            toast.success('Đã lưu điểm và nhận xét');
            await load();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể lưu điểm'));
        } finally {
            setSavingId('');
        }
    };

    return <div className={ui.pageStack}>
        <PageTitle eyebrow="Đánh giá bài làm" title="Chấm bài"><button className={ui.secondaryButton} type="button" onClick={load}><FiRefreshCw /> Tải lại</button></PageTitle>
        <section className={styles.filterBar}><label><FiBookOpen /><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="ALL">Tất cả lớp</option>{bundles.map((bundle) => <option value={bundle.courseClass.publicId} key={bundle.courseClass.publicId}>{bundle.courseClass.code}</option>)}</select></label><label className={styles.checkFilter}><input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} /> Chỉ bài chưa chấm</label><span className={styles.resultCount}>{filteredRows.length} câu trả lời</span></section>
        {loading ? <StatePanel><FiRefreshCw className={styles.spin} /> Đang tải bài làm...</StatePanel> : filteredRows.length ? <section className={styles.gradingList}>{filteredRows.map((row) => {
            const draft = drafts[row.answer.id] ?? {};
            return <article key={row.answer.id}><header><div><span>{row.courseClass.code} · {categoryLabels[row.assessment?.category]}</span><h3>{row.assessment?.title}</h3><small>{row.attempt.student?.code} · {row.attempt.student?.fullName} · Nộp {formatDateTime(row.attempt.submittedAt)}</small></div><span className={classNames(styles.status, row.answer.awardedPoints == null ? styles.statusWarning : styles.statusGood)}>{row.answer.awardedPoints == null ? 'Chưa chấm' : 'Đã chấm'}</span></header><section className={styles.answerGrid}><div><strong>Đề bài</strong><div className={styles.answerContent} dangerouslySetInnerHTML={{ __html: row.answer.question?.content ?? '' }} />{row.answer.sourceCode ? <pre>{row.answer.sourceCode}</pre> : <p>{row.answer.textAnswer || 'Sinh viên chưa nhập câu trả lời.'}</p>}</div><div className={styles.gradingForm}><label>Điểm <span>/ {row.answer.question?.points}</span><input type="number" min="0" max={row.answer.question?.points} step="0.25" value={draft.points ?? row.answer.awardedPoints ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [row.answer.id]: { ...current[row.answer.id], points: event.target.value } }))} /></label><label>Nhận xét<textarea value={draft.feedback ?? row.answer.feedback ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [row.answer.id]: { ...current[row.answer.id], feedback: event.target.value } }))} /></label><button className={ui.primaryButton} type="button" disabled={savingId === row.answer.id} onClick={() => grade(row)}><FiSave /> Lưu điểm</button></div></section></article>;
        })}</section> : <StatePanel><FiCheckCircle /> Không còn bài tự luận chờ chấm</StatePanel>}
    </div>;
}

export function LecturerAutoGradingPage() {
    const user = useAuthStore((state) => state.user);
    const userPublicId = user?.publicId ?? user?.id;
    const [bundles, setBundles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', classId: 'ALL', questionType: 'ALL' });
    const [drafts, setDrafts] = useState({});
    const [savingId, setSavingId] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const classes = lecturerClasses(await adminModulesApi.listClasses(), userPublicId);
            setBundles(await Promise.all(classes.map(loadClassBundle)));
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể tải kết quả chấm tự động'));
        } finally {
            setLoading(false);
        }
    }, [userPublicId]);

    useEffect(() => {
        const task = window.setTimeout(load, 0);
        return () => window.clearTimeout(task);
    }, [load]);

    const attempts = bundles.flatMap((bundle) => bundle.attempts
        .filter((attempt) => attempt.status !== 'IN_PROGRESS')
        .map((attempt) => ({
            ...attempt,
            courseClass: bundle.courseClass,
            automaticAnswers: (attempt.answers ?? []).filter((answer) => automaticQuestionTypes.includes(answer.question?.type))
        }))
        .filter((attempt) => attempt.automaticAnswers.length));

    const filteredAttempts = attempts.map((attempt) => ({
        ...attempt,
        automaticAnswers: attempt.automaticAnswers.filter((answer) =>
            filters.questionType === 'ALL' || answer.question?.type === filters.questionType)
    })).filter((attempt) => {
        const keyword = filters.search.trim().toLowerCase();
        const matchesSearch = !keyword || [
            attempt.assessment?.title,
            attempt.student?.code,
            attempt.student?.fullName,
            attempt.courseClass?.code
        ].some((value) => value?.toLowerCase().includes(keyword));
        return attempt.automaticAnswers.length
            && matchesSearch
            && (filters.classId === 'ALL' || attempt.courseClass?.publicId === filters.classId);
    });

    const saveAdjustedScore = async (attempt, answer) => {
        const draft = drafts[answer.id] ?? {};
        const points = Number(draft.points ?? answer.awardedPoints);
        const maxPoints = Number(answer.question?.points ?? 0);
        const reason = String(draft.reason ?? '').trim();

        if (!Number.isFinite(points) || points < 0 || points > maxPoints) {
            toast.error('Điểm điều chỉnh không hợp lệ');
            return;
        }
        if (!reason) {
            toast.error('Vui lòng nhập lý do điều chỉnh điểm');
            return;
        }

        setSavingId(answer.id);
        try {
            await adminModulesApi.gradeAnswer(answer.id, {
                awardedPoints: points,
                feedback: `Điều chỉnh điểm chấm tự động: ${reason}`
            });
            setDrafts((current) => {
                const next = { ...current };
                delete next[answer.id];
                return next;
            });
            toast.success(`Đã cập nhật điểm cho ${attempt.student?.fullName}`);
            await load();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể điều chỉnh điểm'));
        } finally {
            setSavingId('');
        }
    };

    return (
        <div className={ui.pageStack}>
            <PageTitle eyebrow="Kết quả hệ thống" title="Bài chấm tự động">
                <button className={ui.secondaryButton} type="button" onClick={load} disabled={loading}>
                    <FiRefreshCw /> Tải lại
                </button>
            </PageTitle>

            <section className={classNames(styles.filterBar, styles.autoFilterBar)}>
                <label className={styles.searchField}>
                    <FiSearch />
                    <input
                        placeholder="Tìm sinh viên hoặc bài đánh giá"
                        value={filters.search}
                        onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    />
                </label>
                <label>
                    <FiBookOpen />
                    <select value={filters.classId} onChange={(event) => setFilters((current) => ({ ...current, classId: event.target.value }))}>
                        <option value="ALL">Tất cả lớp</option>
                        {bundles.map((bundle) => (
                            <option value={bundle.courseClass.publicId} key={bundle.courseClass.publicId}>{bundle.courseClass.code}</option>
                        ))}
                    </select>
                </label>
                <label>
                    <FiCode />
                    <select value={filters.questionType} onChange={(event) => setFilters((current) => ({ ...current, questionType: event.target.value }))}>
                        <option value="ALL">Tất cả loại</option>
                        {Object.entries(automaticQuestionTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                </label>
                <span className={styles.resultCount}>{filteredAttempts.length} lượt làm</span>
            </section>

            {loading ? (
                <StatePanel><FiRefreshCw className={styles.spin} /> Đang tải kết quả chấm tự động...</StatePanel>
            ) : filteredAttempts.length ? (
                <section className={styles.autoGradingList}>
                    {filteredAttempts.map((attempt) => {
                        const maxPoints = (attempt.answers ?? []).reduce((sum, answer) => sum + Number(answer.question?.points ?? 0), 0);
                        return (
                            <article key={attempt.publicId}>
                                <header>
                                    <div>
                                        <span>{attempt.courseClass?.code} · {categoryLabels[attempt.assessment?.category] ?? attempt.assessment?.category}</span>
                                        <h3>{attempt.assessment?.title}</h3>
                                        <small>
                                            {attempt.student?.code} · {attempt.student?.fullName} · Lần {attempt.attemptNumber} · Nộp {formatDateTime(attempt.submittedAt)}
                                        </small>
                                    </div>
                                    <div className={styles.autoAttemptScore}>
                                        <span>Điểm bài làm</span>
                                        <strong>{Number(attempt.score ?? 0).toFixed(2)} / {maxPoints.toFixed(2)}</strong>
                                    </div>
                                </header>

                                <div className={styles.autoAnswerList}>
                                    {attempt.automaticAnswers.map((answer, answerIndex) => {
                                        const draft = drafts[answer.id] ?? {};
                                        const selectedOptions = (answer.selectedOptions ?? []).map((item) => item.option).filter(Boolean);
                                        const judgeStatus = answer.judgeStatus ?? 'NOT_REQUIRED';
                                        const judgeClass = ['ACCEPTED', 'NOT_REQUIRED'].includes(judgeStatus)
                                            ? styles.statusGood
                                            : ['QUEUED', 'PROCESSING'].includes(judgeStatus)
                                                ? styles.statusWarning
                                                : styles.statusDanger;

                                        return (
                                            <section className={styles.autoAnswer} key={answer.id}>
                                                <div className={styles.autoAnswerContent}>
                                                    <div className={styles.autoAnswerHeading}>
                                                        <div>
                                                            <span>Câu {answerIndex + 1} · {automaticQuestionTypeLabels[answer.question?.type]}</span>
                                                            <strong>{Number(answer.awardedPoints ?? 0).toFixed(2)} / {Number(answer.question?.points ?? 0).toFixed(2)} điểm</strong>
                                                        </div>
                                                        <span className={classNames(styles.status, judgeClass)}>{judgeStatusLabels[judgeStatus] ?? judgeStatus}</span>
                                                    </div>
                                                    <div className={styles.answerContent} dangerouslySetInnerHTML={{ __html: answer.question?.content ?? '' }} />
                                                    {answer.sourceCode ? <pre>{answer.sourceCode}</pre> : null}
                                                    {selectedOptions.length ? (
                                                        <div className={styles.selectedOptions}>
                                                            {selectedOptions.map((option) => (
                                                                <span className={option.isCorrect ? styles.selectedCorrect : styles.selectedWrong} key={option.publicId ?? option.id}>
                                                                    {option.content}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                    {answer.judgeMessage ? <div className={styles.judgeMessage}>{answer.judgeMessage}</div> : null}
                                                    {answer.feedback ? <small className={styles.previousFeedback}>Nhận xét trước: {answer.feedback}</small> : null}
                                                </div>

                                                <div className={styles.autoAdjustmentForm}>
                                                    <label>
                                                        Điểm điều chỉnh <span>/ {answer.question?.points}</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={answer.question?.points}
                                                            step="0.25"
                                                            value={draft.points ?? answer.awardedPoints ?? ''}
                                                            onChange={(event) => setDrafts((current) => ({
                                                                ...current,
                                                                [answer.id]: { ...current[answer.id], points: event.target.value }
                                                            }))}
                                                        />
                                                    </label>
                                                    <label>
                                                        Lý do điều chỉnh
                                                        <textarea
                                                            placeholder="Nhập lý do khi sửa điểm"
                                                            value={draft.reason ?? ''}
                                                            onChange={(event) => setDrafts((current) => ({
                                                                ...current,
                                                                [answer.id]: { ...current[answer.id], reason: event.target.value }
                                                            }))}
                                                        />
                                                    </label>
                                                    <button
                                                        className={ui.primaryButton}
                                                        type="button"
                                                        disabled={savingId === answer.id || !String(draft.reason ?? '').trim()}
                                                        onClick={() => saveAdjustedScore(attempt, answer)}
                                                    >
                                                        <FiSave /> {savingId === answer.id ? 'Đang lưu...' : 'Cập nhật điểm'}
                                                    </button>
                                                </div>
                                            </section>
                                        );
                                    })}
                                </div>
                            </article>
                        );
                    })}
                </section>
            ) : (
                <StatePanel><FiCheckCircle /> Chưa có bài chấm tự động phù hợp</StatePanel>
            )}
        </div>
    );
}

export function LecturerGradebookPage() {
    const user = useAuthStore((state) => state.user);
    const userPublicId = user?.publicId ?? user?.id;
    const [classes, setClasses] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [gradebook, setGradebook] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const task = window.setTimeout(async () => {
            try {
                const values = lecturerClasses(await adminModulesApi.listClasses(), userPublicId);
                setClasses(values);
                setSelectedId(values[0]?.publicId ?? '');
            } catch (error) { toast.error(getApiMessage(error, 'Không thể tải danh sách lớp')); }
            finally { setLoading(false); }
        }, 0);
        return () => window.clearTimeout(task);
    }, [userPublicId]);

    useEffect(() => {
        if (!selectedId) return undefined;
        const task = window.setTimeout(() => adminModulesApi.classGradebook(selectedId).then(setGradebook).catch((error) => toast.error(getApiMessage(error, 'Không thể tải bảng điểm'))), 0);
        return () => window.clearTimeout(task);
    }, [selectedId]);

    const finalize = async () => {
        if (!selectedId || !window.confirm('Tổng kết và khóa điểm của lớp này?')) return;
        try {
            await adminModulesApi.finalizeClass(selectedId);
            toast.success('Đã tổng kết điểm lớp');
            setGradebook(await adminModulesApi.classGradebook(selectedId));
        } catch (error) { toast.error(getApiMessage(error, 'Chưa thể tổng kết điểm')); }
    };

    const rows = gradebook?.students ?? [];
    return <div className={ui.pageStack}>
        <PageTitle eyebrow="Kết quả học tập" title="Bảng điểm"><button className={ui.secondaryButton} type="button" disabled title="BE chưa có API gửi bảng điểm cho Trưởng bộ môn"><FiSend /> Gửi bảng điểm</button><button className={ui.primaryButton} type="button" disabled={!gradebook?.canFinalize} onClick={finalize}><FiAward /> Tổng kết điểm</button></PageTitle>
        <section className={styles.gradeToolbar}><label>Chọn lớp<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{classes.map((item) => <option value={item.publicId} key={item.publicId}>{item.code} - {item.subject?.name}</option>)}</select></label><div><strong>{gradebook?.subject?.name ?? '-'}</strong><span>Điểm đạt {gradebook?.subject?.passScore ?? '-'}</span></div></section>
        {loading ? <StatePanel>Đang tải bảng điểm...</StatePanel> : <section className={styles.tablePanel}><table><thead><tr><th>Sinh viên</th>{Object.values(categoryScoreLabels).map((label) => <th key={label}>{label}</th>)}<th>Tổng kết</th><th>Trạng thái</th></tr></thead><tbody>{rows.length ? rows.map((row) => { const passed = row.savedPassed ?? row.passed; return <tr key={row.enrollmentPublicId}><td><strong>{row.student.fullName}</strong><span>{row.student.code}</span></td>{Object.keys(categoryScoreLabels).map((key) => <td key={key}>{getCategoryScoreValue(row, key)}</td>)}<td><strong>{row.savedFinalScore ?? row.calculatedScore}</strong></td><td><span className={classNames(styles.status, passed ? styles.statusGood : styles.statusDanger)}>{passed ? 'Đạt' : 'Có nguy cơ'}</span></td></tr>; }) : <tr><td colSpan="7"><StatePanel>Chưa có sinh viên hoặc dữ liệu điểm</StatePanel></td></tr>}</tbody></table></section>}
        {gradebook?.blockers?.length ? <section className={styles.blockerPanel}><strong>Chưa thể tổng kết</strong>{gradebook.blockers.map((item) => <span key={item}><FiAlertTriangle /> {item}</span>)}</section> : null}
    </div>;
}
