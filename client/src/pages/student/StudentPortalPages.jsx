import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiArrowRight,
    FiAward,
    FiBell,
    FiBookOpen,
    FiCalendar,
    FiClock,
    FiFilter,
    FiLock,
    FiMapPin,
    FiRefreshCw,
    FiSearch,
    FiUser,
    FiUsers
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { getApiMessage } from '~/shared/api/http.js';
import { studentApi } from '~/shared/api/studentApi.js';
import { useAuthStore } from '~/shared/store/authStore.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './StudentPortalPages.module.scss';
import { categoryLabels, classLabels, enrollmentLabels, formatDateTime, formatSchedule, weekdayLabels } from './studentUi.js';

const asList = (value) => (Array.isArray(value) ? value : value?.items ?? value?.data ?? []);
const activeEnrollment = (item) => item.status === 'ACTIVE';
const todayKeys = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const categoryScoreLabels = { ASSIGNMENT: 'Bài tập', QUIZ: 'Kiểm tra', MIDTERM: 'Giữa kỳ', FINAL: 'Cuối kỳ' };
const getCategoryScore = (item, category) => {
    if (Array.isArray(item.categoryScores)) {
        return item.categoryScores.find((score) => score.category === category) ?? null;
    }
    const score = item.categoryScores?.[category];
    return score === undefined ? null : { category, score };
};

const getStatusTone = (status) => {
    if (['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'OPEN_REGISTRATION'].includes(status)) return styles.statusGood;
    if (['DROPPED', 'CANCELLED'].includes(status)) return styles.statusMuted;
    return styles.statusWarning;
};

function LoadingState() {
    return <div className={styles.statePanel}><FiRefreshCw className={styles.spin} /><span>Đang tải dữ liệu...</span></div>;
}

function EmptyState({ title, action }) {
    return (
        <div className={styles.statePanel}>
            <FiBookOpen />
            <strong>{title}</strong>
            {action}
        </div>
    );
}

function PageTitle({ eyebrow, title, children }) {
    return (
        <section className={styles.pageTitle}>
            <div><p className={ui.eyebrow}>{eyebrow}</p><h2>{title}</h2></div>
            {children ? <div className={styles.pageActions}>{children}</div> : null}
        </section>
    );
}

export function StudentDashboardPage() {
    const user = useAuthStore((state) => state.user);
    const [data, setData] = useState({ enrollments: [], grades: [], notifications: [], assessments: [] });
    const [loading, setLoading] = useState(true);
    const [openedAt] = useState(() => Date.now());

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const [enrollmentValue, gradeValue, notificationValue] = await Promise.all([
                    studentApi.myEnrollments(),
                    studentApi.courseGrades(),
                    studentApi.notifications({ page: 1, limit: 6 })
                ]);
                const enrollments = asList(enrollmentValue).filter(activeEnrollment);
                const learningEnrollments = enrollments.filter((item) => item.class?.status === 'IN_PROGRESS');
                const assessmentValues = await Promise.allSettled(
                    learningEnrollments.map((item) => studentApi.classAssessments(item.class?.publicId))
                );
                const assessments = assessmentValues.flatMap((result, index) => result.status === 'fulfilled'
                    ? asList(result.value).map((assessment) => ({ ...assessment, courseClass: learningEnrollments[index].class }))
                    : []);
                if (active) setData({
                    enrollments,
                    grades: asList(gradeValue),
                    notifications: asList(notificationValue),
                    assessments
                });
            } catch (error) {
                toast.error(getApiMessage(error, 'Không thể tải dashboard sinh viên'));
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, []);

    const today = todayKeys[new Date().getDay()];
    const todaySchedules = data.enrollments.flatMap((item) => (item.class?.schedules ?? [])
        .filter((schedule) => schedule.weekDay === today)
        .map((schedule) => ({ ...schedule, courseClass: item.class })));
    const upcoming = data.assessments
        .filter((item) => new Date(item.closeAt).getTime() >= openedAt)
        .sort((a, b) => new Date(a.closeAt) - new Date(b.closeAt))
        .slice(0, 5);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const learningEnrollments = data.enrollments.filter((item) => item.class?.status === 'IN_PROGRESS');
    const currentQuarterCredits = learningEnrollments.reduce(
        (sum, item) => sum + (Number(item.class?.subject?.credits) || 0),
        0
    );
    const completedThisYear = data.grades.filter((item) => {
        if (!item.isFinalized || !Number.isFinite(Number(item.finalScore)) || !item.finalizedAt) return false;
        return new Date(item.finalizedAt).getFullYear() === currentYear;
    });
    const attemptedCreditsThisYear = completedThisYear.reduce(
        (sum, item) => sum + (Number(item.subject?.credits) || 0),
        0
    );
    const earnedCreditsThisYear = completedThisYear.reduce(
        (sum, item) => sum + (item.passed ? (Number(item.subject?.credits) || 0) : 0),
        0
    );
    const averageThisYear = attemptedCreditsThisYear
        ? completedThisYear.reduce(
            (sum, item) => sum + Number(item.finalScore) * (Number(item.subject?.credits) || 0),
            0
        ) / attemptedCreditsThisYear
        : null;
    const roundedAverageThisYear = averageThisYear === null ? null : Math.round(averageThisYear * 100) / 100;
    const passedCoursesThisYear = completedThisYear.filter((item) => item.passed).length;
    const passRateThisYear = completedThisYear.length
        ? Math.round((passedCoursesThisYear / completedThisYear.length) * 100)
        : 0;

    if (loading) return <LoadingState />;

    return (
        <div className={ui.pageStack}>
            <section className={styles.welcomeBand}>
                <div><p className={ui.eyebrow}>Hoạt động học tập</p><h2>Chào {user?.fullName ?? 'bạn'}, hôm nay học gì?</h2></div>
                <span>{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date())}</span>
            </section>

            <section className={styles.metricGrid}>
                <article><span className={styles.metricIconBlue}><FiBookOpen /></span><div><strong>{currentQuarterCredits}</strong><span>Tín chỉ đang học quý {currentQuarter}</span></div></article>
                <article><span className={styles.metricIconGreen}><FiAward /></span><div><strong>{earnedCreditsThisYear}</strong><span>Tín chỉ đạt năm {currentYear}</span></div></article>
                <article><span className={styles.metricIconRose}><FiAward /></span><div><strong>{roundedAverageThisYear ?? '-'}</strong><span>Điểm TB môn hoàn thành năm {currentYear}</span></div></article>
                <article><span className={styles.metricIconAmber}><FiClock /></span><div><strong>{upcoming.length}</strong><span>Bài sắp đến hạn</span></div></article>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelHeading}>
                    <div><p className={ui.eyebrow}>Tổng kết năm {currentYear}</p><h3>Tiến độ học tập</h3></div>
                    <Link to="/student/grades">Xem bảng điểm <FiArrowRight /></Link>
                </div>
                <div className={styles.yearProgress}>
                    <div
                        className={styles.scoreRing}
                        style={{ '--score-progress': `${Math.min(100, Math.max(0, (roundedAverageThisYear ?? 0) * 10))}%` }}
                    >
                        <div><strong>{roundedAverageThisYear ?? '-'}</strong><span>/ 10 điểm</span></div>
                    </div>
                    <div className={styles.yearStats}>
                        <div><span>Môn đã hoàn thành</span><strong>{completedThisYear.length}</strong></div>
                        <div><span>Tín chỉ đã học</span><strong>{attemptedCreditsThisYear}</strong></div>
                        <div><span>Tỷ lệ đạt</span><strong>{passRateThisYear}%</strong></div>
                        <div><span>Lớp đang tiến hành</span><strong>{learningEnrollments.length}</strong></div>
                    </div>
                </div>
            </section>

            <div className={styles.dashboardGrid}>
                <section className={styles.panel}>
                    <div className={styles.panelHeading}><div><p className={ui.eyebrow}>Hôm nay</p><h3>Lịch học</h3></div><Link to="/student/classes">Xem lớp <FiArrowRight /></Link></div>
                    <div className={styles.timelineList}>
                        {todaySchedules.length ? todaySchedules.map((item) => (
                            <article key={`${item.courseClass.publicId}-${item.id ?? item.startTime}`}>
                                <time>{item.startTime}</time>
                                <div><strong>{item.courseClass.subject?.name ?? item.courseClass.name}</strong><span>{item.courseClass.code}</span><small><FiMapPin /> {item.room ?? 'Chưa có phòng'} · đến {item.endTime}</small></div>
                            </article>
                        )) : <EmptyState title="Hôm nay không có lịch học" />}
                    </div>
                </section>

                <section className={styles.panel}>
                    <div className={styles.panelHeading}><div><p className={ui.eyebrow}>Ưu tiên</p><h3>Sắp đến hạn</h3></div></div>
                    <div className={styles.deadlineList}>
                        {upcoming.length ? upcoming.map((item) => (
                            <Link to={`/student/classes/${item.courseClass.publicId}`} key={item.publicId}>
                                <span className={styles.assessmentType}>{categoryLabels[item.category] ?? 'Đánh giá'}</span>
                                <strong>{item.title}</strong>
                                <small>{item.courseClass.code} · {formatDateTime(item.closeAt)}</small>
                            </Link>
                        )) : <EmptyState title="Không có bài sắp đến hạn" />}
                    </div>
                </section>
            </div>

            <section className={styles.panel}>
                <div className={styles.panelHeading}><div><p className={ui.eyebrow}>Mới nhất</p><h3>Thông báo</h3></div><Link to="/notifications">Xem tất cả <FiArrowRight /></Link></div>
                <div className={styles.notificationGrid}>
                    {data.notifications.length ? data.notifications.slice(0, 4).map((item) => (
                        <article className={classNames({ [styles.unread]: !item.readAt })} key={item.publicId}>
                            <span><FiBell /></span><div><strong>{item.title}</strong><p>{item.message}</p><small>{formatDateTime(item.createdAt)}</small></div>
                        </article>
                    )) : <EmptyState title="Chưa có thông báo" />}
                </div>
            </section>
        </div>
    );
}

export function StudentEnrollmentsPage() {
    const [classes, setClasses] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState('');
    const [filters, setFilters] = useState({ search: '', subject: 'ALL', weekday: 'ALL', slots: false });
    const [openedAt] = useState(() => Date.now());

    const load = useCallback(async () => {
        await Promise.resolve();
        setLoading(true);
        try {
            const [classValue, enrollmentValue, subjectValue] = await Promise.all([
                studentApi.availableClasses(), studentApi.myEnrollments(), studentApi.subjects()
            ]);
            setClasses(asList(classValue));
            setEnrollments(asList(enrollmentValue));
            setSubjects(asList(subjectValue));
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể tải danh sách lớp mở'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const task = window.setTimeout(load, 0);
        return () => window.clearTimeout(task);
    }, [load]);

    const activeByClass = useMemo(() => new Map(enrollments.filter(activeEnrollment).map((item) => [item.class?.publicId, item])), [enrollments]);
    const filtered = classes.filter((item) => {
        const keyword = filters.search.trim().toLowerCase();
        const matchesSearch = !keyword || [item.code, item.name, item.subject?.code, item.subject?.name, item.lecturer?.fullName].some((value) => value?.toLowerCase().includes(keyword));
        const matchesSubject = filters.subject === 'ALL' || item.subject?.publicId === filters.subject;
        const matchesDay = filters.weekday === 'ALL' || item.schedules?.some((schedule) => schedule.weekDay === filters.weekday);
        const matchesSlots = !filters.slots || item.remainingSlots > 0;
        return matchesSearch && matchesSubject && matchesDay && matchesSlots;
    });

    const handleEnroll = async (courseClass) => {
        setBusyId(courseClass.publicId);
        try {
            await studentApi.enroll(courseClass.publicId);
            toast.success(`Đã đăng ký lớp ${courseClass.code}`);
            await load();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể đăng ký lớp'));
        } finally {
            setBusyId('');
        }
    };

    const handleDrop = async (enrollment) => {
        if (!window.confirm(`Hủy đăng ký lớp ${enrollment.class?.code}?`)) return;
        setBusyId(enrollment.class?.publicId);
        try {
            await studentApi.dropEnrollment(enrollment.publicId);
            toast.success('Đã hủy đăng ký lớp');
            await load();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể hủy đăng ký'));
        } finally {
            setBusyId('');
        }
    };

    return (
        <div className={ui.pageStack}>
            <PageTitle eyebrow="Học kỳ hiện tại" title="Đăng ký lớp" />
            <section className={styles.filterBar}>
                <label className={styles.searchField}><FiSearch /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Tìm môn, lớp hoặc giảng viên" /></label>
                <label><FiBookOpen /><select value={filters.subject} onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))}><option value="ALL">Tất cả môn</option>{subjects.map((item) => <option value={item.publicId} key={item.publicId}>{item.code} - {item.name}</option>)}</select></label>
                <label><FiCalendar /><select value={filters.weekday} onChange={(event) => setFilters((current) => ({ ...current, weekday: event.target.value }))}><option value="ALL">Tất cả lịch học</option>{Object.entries(weekdayLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label className={styles.checkFilter}><input type="checkbox" checked={filters.slots} onChange={(event) => setFilters((current) => ({ ...current, slots: event.target.checked }))} /><FiFilter /> Còn chỗ</label>
            </section>

            {loading ? <LoadingState /> : filtered.length ? (
                <section className={styles.classGrid}>
                    {filtered.map((item) => {
                        const enrollment = activeByClass.get(item.publicId);
                        const canDrop = enrollment && openedAt <= new Date(item.registrationEnd).getTime();
                        return (
                            <article className={styles.registrationCard} key={item.publicId}>
                                <div className={styles.cardTop}><span>{item.subject?.code}</span><span className={classNames(styles.status, getStatusTone(item.status))}>{classLabels[item.status] ?? item.status}</span></div>
                                <div><h3>{item.subject?.name ?? item.name}</h3><p>{item.code} · {item.name}</p></div>
                                <dl>
                                    <div><dt><FiUser /> Giảng viên</dt><dd>{item.lecturer?.fullName ?? 'Chưa phân công'}</dd></div>
                                    <div><dt><FiCalendar /> Lịch học</dt><dd>{formatSchedule(item.schedules)}</dd></div>
                                    <div><dt><FiBookOpen /> Môn tiên quyết</dt><dd>{item.subject?.prerequisites?.map((value) => value.code ?? value.name).join(', ') || 'Theo chương trình đào tạo'}</dd></div>
                                    <div><dt><FiUsers /> Chỗ trống</dt><dd><strong>{item.remainingSlots}</strong> / {item.maxStudents}</dd></div>
                                </dl>
                                <div className={styles.capacityBar}><span style={{ width: `${Math.min(100, ((item.enrolledCount ?? 0) / Math.max(1, item.maxStudents)) * 100)}%` }} /></div>
                                <div className={styles.cardFooter}>
                                    <small>Đóng đăng ký {formatDateTime(item.registrationEnd)}</small>
                                    {enrollment ? <button className={ui.secondaryButton} type="button" disabled={!canDrop || busyId === item.publicId} onClick={() => handleDrop(enrollment)}>Hủy đăng ký</button> : <button className={ui.primaryButton} type="button" disabled={!item.remainingSlots || busyId === item.publicId} onClick={() => handleEnroll(item)}>Đăng ký</button>}
                                </div>
                            </article>
                        );
                    })}
                </section>
            ) : <EmptyState title="Không tìm thấy lớp phù hợp" />}
        </div>
    );
}

export function StudentClassesPage() {
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        studentApi.myEnrollments()
            .then((value) => setEnrollments(asList(value)))
            .catch((error) => toast.error(getApiMessage(error, 'Không thể tải lớp học')))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <LoadingState />;

    return (
        <div className={ui.pageStack}>
            <PageTitle eyebrow="Không gian học tập" title="Lớp học của tôi"><Link className={ui.primaryButton} to="/student/enrollments">Đăng ký lớp</Link></PageTitle>
            {enrollments.length ? <section className={styles.myClassList}>
                {enrollments.map((item) => {
                    const courseClass = item.class ?? {};
                    return (
                        <article key={item.publicId}>
                            <div className={styles.classAccent}><FiBookOpen /></div>
                            <div className={styles.classMain}>
                                <div className={styles.classTitleRow}><div><span>{courseClass.subject?.code} · {courseClass.code}</span><h3>{courseClass.subject?.name ?? courseClass.name}</h3></div><span className={classNames(styles.status, getStatusTone(item.status))}>{enrollmentLabels[item.status] ?? item.status}</span></div>
                                <div className={styles.classMeta}><span><FiUser /> {courseClass.lecturer?.fullName ?? 'Chưa phân công'}</span><span><FiCalendar /> {formatSchedule(courseClass.schedules)}</span><span><FiAward /> {courseClass.subject?.credits ?? '-'} tín chỉ</span></div>
                                <div className={styles.progressRow}><div><span>Tiến độ cá nhân</span><small>Được cập nhật khi hoàn thành bài học</small></div><div className={styles.progressTrack}><span style={{ width: '0%' }} /></div></div>
                            </div>
                            {item.status === 'ACTIVE' && courseClass.status === 'IN_PROGRESS'
                                ? <Link className={ui.secondaryButton} to={`/student/classes/${courseClass.publicId}`}>Vào lớp <FiArrowRight /></Link>
                                : <span className={classNames(styles.status, getStatusTone(courseClass.status))}><FiLock /> {classLabels[courseClass.status] ?? 'Chưa thể vào lớp'}</span>}
                        </article>
                    );
                })}
            </section> : <EmptyState title="Bạn chưa đăng ký lớp nào" action={<Link className={ui.primaryButton} to="/student/enrollments">Tìm lớp đang mở</Link>} />}
        </div>
    );
}

export function StudentGradesPage() {
    const [grades, setGrades] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        studentApi.courseGrades().then((value) => setGrades(asList(value)))
            .catch((error) => toast.error(getApiMessage(error, 'Không thể tải điểm cá nhân')))
            .finally(() => setLoading(false));
    }, []);

    const summary = useMemo(() => {
        const finalized = grades.filter((item) => item.isFinalized && Number.isFinite(Number(item.finalScore)));
        const registeredCredits = grades.reduce((sum, item) => sum + (Number(item.subject?.credits) || 0), 0);
        const publishedCredits = finalized.reduce((sum, item) => sum + (Number(item.subject?.credits) || 0), 0);
        const passedCredits = finalized.reduce((sum, item) => sum + (item.passed ? (Number(item.subject?.credits) || 0) : 0), 0);
        const weightedAverage = publishedCredits
            ? finalized.reduce((sum, item) => sum + Number(item.finalScore) * (Number(item.subject?.credits) || 0), 0) / publishedCredits
            : null;
        return {
            courseCount: grades.length,
            registeredCredits,
            passedCredits,
            weightedAverage: weightedAverage === null ? null : Math.round(weightedAverage * 100) / 100
        };
    }, [grades]);

    if (loading) return <LoadingState />;

    return (
        <div className={ui.pageStack}>
            <PageTitle eyebrow="Kết quả học tập" title="Bảng điểm" />
            <section className={styles.gradeSummary}>
                <div><span>Môn học</span><strong>{summary.courseCount}</strong></div>
                <div><span>Tín chỉ đăng ký</span><strong>{summary.registeredCredits}</strong></div>
                <div><span>Tín chỉ đạt</span><strong>{summary.passedCredits}</strong></div>
                <div><span>Điểm trung bình đã công bố</span><strong>{summary.weightedAverage ?? '-'}</strong></div>
            </section>
            {grades.length ? <section className={styles.gradeList}>{grades.map((item) => (
                <article key={item.enrollmentPublicId}>
                    <div className={styles.gradeCourse}><span>{item.subject?.code} · {item.class?.code}</span><h3>{item.subject?.name}</h3><small>{item.subject?.credits} tín chỉ · Điểm đạt {item.subject?.passScore} · {enrollmentLabels[item.enrollmentStatus] ?? item.enrollmentStatus}</small></div>
                    <div className={styles.scoreGrid}>{Object.entries(categoryScoreLabels).map(([key, label]) => {
                        const categoryScore = getCategoryScore(item, key);
                        return <div key={key}><span>{label}</span><strong>{categoryScore?.score ?? '-'}</strong>{categoryScore ? <small>{categoryScore.weight ?? 0}% · {categoryScore.assessmentCount ?? 0} bài</small> : null}</div>;
                    })}</div>
                    <div className={styles.finalScore}><span>{item.isFinalized ? 'Điểm tổng kết' : 'Điểm tạm tính'}</span><strong>{item.finalScore ?? item.currentScore ?? '-'}</strong><small className={classNames({ [styles.passText]: item.passed === true, [styles.failText]: item.passed === false })}>{item.passed === true ? 'Đạt' : item.passed === false ? 'Không đạt' : 'Chưa công bố'}</small></div>
                </article>
            ))}</section> : <EmptyState title="Chưa có dữ liệu điểm" />}
        </div>
    );
}
