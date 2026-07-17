import Editor from '@monaco-editor/react';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    FiAlertTriangle,
    FiArrowLeft,
    FiArrowRight,
    FiCheck,
    FiCheckCircle,
    FiClock,
    FiCode,
    FiEye,
    FiFlag,
    FiPlay,
    FiSave,
    FiSend,
    FiX
} from 'react-icons/fi';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { getApiMessage } from '~/shared/api/http.js';
import { studentApi } from '~/shared/api/studentApi.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './ExamTakingPage.module.scss';

const questionTypeLabels = {
    SINGLE_CHOICE: 'Một đáp án',
    MULTIPLE_CHOICE: 'Nhiều đáp án',
    ESSAY: 'Tự luận',
    CODE: 'Lập trình',
    HTML_CSS: 'HTML/CSS'
};
const editorLanguageById = { 50: 'c', 54: 'cpp', 51: 'csharp', 62: 'java', 63: 'javascript', 71: 'python' };
const violationTypeLabels = {
    WINDOW_BLUR: 'Mất tập trung khỏi cửa sổ làm bài',
    PAGE_HIDDEN: 'Rời hoặc ẩn trang làm bài',
    EXIT_FULLSCREEN: 'Thoát chế độ toàn màn hình',
    HEARTBEAT_LOST: 'Mất kết nối giám sát'
};

const formatViolationTime = (value) => value
    ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value))
    : '-';

const formatAwayDuration = (milliseconds) => {
    if (!Number.isFinite(milliseconds)) return 'Chưa ghi nhận thời gian quay lại';
    const seconds = Math.max(1, Math.round(milliseconds / 1000));
    return `Quay lại sau ${seconds} giây`;
};

const formatRemaining = (seconds) => {
    const safe = Math.max(0, seconds);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const rest = safe % 60;
    return [hours, minutes, rest].map((value) => String(value).padStart(2, '0')).join(':');
};

const parseStarter = (question) => {
    try {
        const parsed = JSON.parse(question.starterCode ?? '');
        if (parsed?.mode === 'WEB' && parsed.files) return { mode: 'WEB', files: parsed.files };
    } catch {
        // Source code một file không phải JSON.
    }
    if (question.type === 'HTML_CSS') return { mode: 'WEB', files: { html: question.starterCode ?? '', css: '', js: '' } };
    return { mode: 'SINGLE', sourceCode: question.starterCode ?? '' };
};

const initialAnswer = (question) => {
    if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(question.type)) return { selectedOptionPublicIds: [] };
    if (question.type === 'ESSAY') return { textAnswer: '' };
    const starter = parseStarter(question);
    return starter.mode === 'WEB'
        ? { mode: 'WEB', files: starter.files, sourceCode: JSON.stringify({ mode: 'WEB', files: starter.files }), languageId: question.judgeLanguageId ?? 0 }
        : { mode: 'SINGLE', sourceCode: starter.sourceCode, languageId: question.judgeLanguageId };
};

const createPreviewDocument = (files) => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${files.css ?? ''}</style></head>
<body>${files.html ?? ''}<script>
const send=(type,value)=>window.parent.postMessage({type:'student-code-log',level:type,payload:String(value)},'*');
console.log=(...args)=>send('stdout',args.join(' ')); console.error=(...args)=>send('stderr',args.join(' '));
try { ${files.js ?? ''} } catch(error) { send('stderr', error.message); }
</script></body></html>`;

export function ExamTakingPage() {
    const { attemptId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const restored = useMemo(() => {
        if (location.state?.attempt) return location.state;
        try { return JSON.parse(sessionStorage.getItem(`student-attempt:${attemptId}`) ?? 'null'); } catch { return null; }
    }, [attemptId, location.state]);
    const attempt = restored?.attempt;
    const assessment = restored?.assessment ?? {};
    const courseClass = restored?.courseClass ?? {};
    const questions = useMemo(() => attempt?.questions ?? [], [attempt]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState(() => Object.fromEntries(questions.map((question) => [question.publicId, initialAnswer(question)])));
    const [reviewIds, setReviewIds] = useState([]);
    const [saveStates, setSaveStates] = useState({});
    const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((new Date(attempt?.deadlineAt).getTime() - Date.now()) / 1000)));
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [activeFile, setActiveFile] = useState('html');
    const [violationCount, setViolationCount] = useState(Number(attempt?.violationCount ?? 0));
    const [violationWarning, setViolationWarning] = useState(null);
    const [violationHistory, setViolationHistory] = useState([]);
    const [logs, setLogs] = useState([{ level: 'stdout', value: 'Sẵn sàng chạy thử.' }]);
    const saveTimers = useRef(new Map());
    const submittedRef = useRef(false);
    const departureRef = useRef(null);
    const violationSequenceRef = useRef(0);
    const violationQueueRef = useRef(Promise.resolve());
    const currentQuestion = questions[currentIndex];
    const currentAnswer = currentQuestion ? answers[currentQuestion.publicId] : null;
    const maxViolations = Math.max(1, Number(assessment.maxViolations ?? 3));

    const saveAnswer = useCallback(async (question, value, silent = true) => {
        if (!attempt?.publicId || !question) return;
        setSaveStates((current) => ({ ...current, [question.publicId]: 'saving' }));
        const payload = { questionPublicId: question.publicId };
        if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(question.type)) payload.selectedOptionPublicIds = value.selectedOptionPublicIds ?? [];
        if (question.type === 'ESSAY') payload.textAnswer = value.textAnswer ?? '';
        if (['CODE', 'HTML_CSS'].includes(question.type)) {
            payload.sourceCode = value.sourceCode ?? '';
            if (value.languageId) payload.languageId = Number(value.languageId);
        }
        try {
            await studentApi.saveAnswer(attempt.publicId, payload);
            setSaveStates((current) => ({ ...current, [question.publicId]: 'saved' }));
            if (!silent) toast.success('Đã lưu câu trả lời');
        } catch (error) {
            setSaveStates((current) => ({ ...current, [question.publicId]: 'error' }));
            if (!silent) toast.error(getApiMessage(error, 'Không thể lưu câu trả lời'));
        }
    }, [attempt]);

    const updateAnswer = (question, updater) => {
        setAnswers((current) => {
            const nextValue = typeof updater === 'function' ? updater(current[question.publicId]) : updater;
            const next = { ...current, [question.publicId]: nextValue };
            clearTimeout(saveTimers.current.get(question.publicId));
            saveTimers.current.set(question.publicId, setTimeout(() => saveAnswer(question, nextValue), 700));
            return next;
        });
    };

    const submit = useCallback(async (auto = false) => {
        if (!attempt?.publicId || submittedRef.current) return;
        if (!auto && !window.confirm('Nộp bài ngay bây giờ? Bạn sẽ không thể sửa câu trả lời sau khi nộp.')) return;
        submittedRef.current = true;
        setSubmitting(true);
        try {
            await Promise.allSettled(questions.map((question) => saveAnswer(question, answers[question.publicId] ?? initialAnswer(question))));
            const submitted = await studentApi.submitAttempt(attempt.publicId);
            setResult(submitted);
            sessionStorage.removeItem(`student-attempt:${attempt.publicId}`);
            if (document.fullscreenElement) await document.exitFullscreen?.();
            toast.success(auto ? 'Hết giờ, hệ thống đã tự nộp bài' : 'Đã nộp bài');
        } catch (error) {
            submittedRef.current = false;
            toast.error(getApiMessage(error, 'Không thể nộp bài'));
        } finally {
            setSubmitting(false);
        }
    }, [answers, attempt, questions, saveAnswer]);

    const persistViolation = useCallback(async (departure) => {
        if (!attempt?.publicId || submittedRef.current) return;
        try {
            const response = await studentApi.recordViolation(attempt.publicId, departure.type);
            const wasAutoSubmitted = response?.status && response.status !== 'IN_PROGRESS';
            const nextCount = wasAutoSubmitted
                ? maxViolations
                : Number(response?.violationCount ?? violationCount + 1);
            const event = {
                id: departure.id,
                type: departure.type,
                leftAt: departure.leftAt,
                returnedAt: departure.returnedAt,
                awayMs: departure.awayMs,
                violationCount: nextCount,
                remaining: wasAutoSubmitted ? 0 : Math.max(0, Number(response?.remaining ?? maxViolations - nextCount))
            };
            setViolationCount(nextCount);
            setViolationWarning(event);
            setViolationHistory((current) => [...current.filter((item) => item.id !== event.id), event].slice(-5));

            if (wasAutoSubmitted) {
                submittedRef.current = true;
                setResult(response);
                sessionStorage.removeItem(`student-attempt:${attempt.publicId}`);
                toast.error('Bài đã được tự động nộp vì đạt ngưỡng vi phạm');
            } else {
                toast.warning(`Đã ghi nhận dấu hiệu rời trang (${nextCount}/${maxViolations})`);
            }
        } catch (error) {
            if (!submittedRef.current) toast.error(getApiMessage(error, 'Không thể ghi nhận trạng thái rời trang'));
        }
    }, [attempt, maxViolations, violationCount]);

    const queueViolation = useCallback((departure) => {
        violationQueueRef.current = violationQueueRef.current
            .then(() => persistViolation(departure))
            .catch(() => undefined);
    }, [persistViolation]);

    useEffect(() => {
        if (!attempt?.deadlineAt || result) return undefined;
        const timer = window.setInterval(() => {
            const next = Math.max(0, Math.floor((new Date(attempt.deadlineAt).getTime() - Date.now()) / 1000));
            setRemaining(next);
            if (next <= 0) {
                window.clearInterval(timer);
                submit(true);
            }
        }, 1000);
        return () => window.clearInterval(timer);
    }, [attempt?.deadlineAt, result, submit]);

    useEffect(() => {
        if (!attempt?.publicId || result) return undefined;
        const commitDeparture = (departure) => {
            if (!departure || departure.committed || submittedRef.current) return;
            departure.committed = true;
            window.clearTimeout(departure.timerId);
            if (departure.type === 'EXIT_FULLSCREEN' && !document.hidden) {
                departure.returnedAt = new Date().toISOString();
                departure.awayMs = new Date(departure.returnedAt).getTime() - new Date(departure.leftAt).getTime();
                departureRef.current = null;
            }
            queueViolation(departure);
        };
        const beginDeparture = (type) => {
            if (submittedRef.current) return;
            const active = departureRef.current;
            if (active && !active.returnedAt) {
                if (type === 'EXIT_FULLSCREEN' || (type === 'PAGE_HIDDEN' && active.type === 'WINDOW_BLUR')) active.type = type;
                return;
            }
            violationSequenceRef.current += 1;
            const departure = {
                id: `violation-${violationSequenceRef.current}`,
                type,
                leftAt: new Date().toISOString(),
                returnedAt: null,
                awayMs: null,
                committed: false,
                timerId: null
            };
            departure.timerId = window.setTimeout(() => commitDeparture(departure), 180);
            departureRef.current = departure;
        };
        const finishDeparture = () => {
            const departure = departureRef.current;
            if (!departure || departure.returnedAt) return;
            departure.returnedAt = new Date().toISOString();
            departure.awayMs = new Date(departure.returnedAt).getTime() - new Date(departure.leftAt).getTime();
            commitDeparture(departure);
            setViolationHistory((current) => current.map((item) => item.id === departure.id
                ? { ...item, returnedAt: departure.returnedAt, awayMs: departure.awayMs }
                : item));
            setViolationWarning((current) => current?.id === departure.id
                ? { ...current, returnedAt: departure.returnedAt, awayMs: departure.awayMs }
                : current);
            departureRef.current = null;
        };
        const visibility = () => document.hidden ? beginDeparture('PAGE_HIDDEN') : finishDeparture();
        const blur = () => beginDeparture('WINDOW_BLUR');
        const focus = () => { if (!document.hidden) finishDeparture(); };
        const fullscreen = () => {
            if (!['MIDTERM', 'FINAL'].includes(assessment.category) || document.fullscreenElement || submittedRef.current) return;
            beginDeparture('EXIT_FULLSCREEN');
        };
        document.addEventListener('visibilitychange', visibility);
        window.addEventListener('blur', blur);
        window.addEventListener('focus', focus);
        document.addEventListener('fullscreenchange', fullscreen);
        return () => {
            window.clearTimeout(departureRef.current?.timerId);
            document.removeEventListener('visibilitychange', visibility);
            window.removeEventListener('blur', blur);
            window.removeEventListener('focus', focus);
            document.removeEventListener('fullscreenchange', fullscreen);
        };
    }, [assessment.category, attempt?.publicId, queueViolation, result]);

    useEffect(() => {
        const receiveLog = (event) => {
            if (event.data?.type !== 'student-code-log') return;
            setLogs((current) => [...current, { level: event.data.level, value: event.data.payload }]);
        };
        window.addEventListener('message', receiveLog);
        return () => window.removeEventListener('message', receiveLog);
    }, []);

    useEffect(() => () => saveTimers.current.forEach((timer) => clearTimeout(timer)), []);

    const answered = (question) => {
        const value = answers[question.publicId];
        if (!value) return false;
        if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(question.type)) return Boolean(value.selectedOptionPublicIds?.length);
        if (question.type === 'ESSAY') return Boolean(value.textAnswer?.trim());
        return Boolean(value.sourceCode?.trim());
    };

    const toggleOption = (optionPublicId) => {
        updateAnswer(currentQuestion, (current) => {
            const selected = current.selectedOptionPublicIds ?? [];
            if (currentQuestion.type === 'SINGLE_CHOICE') return { ...current, selectedOptionPublicIds: [optionPublicId] };
            return { ...current, selectedOptionPublicIds: selected.includes(optionPublicId) ? selected.filter((id) => id !== optionPublicId) : [...selected, optionPublicId] };
        });
    };

    const updateCodeFile = (fileKey, value) => updateAnswer(currentQuestion, (current) => {
        const files = { ...current.files, [fileKey]: value ?? '' };
        return { ...current, files, sourceCode: JSON.stringify({ mode: 'WEB', files }) };
    });

    const runCode = () => {
        if (currentAnswer?.mode === 'WEB') {
            setLogs([{ level: 'stdout', value: 'Đã cập nhật trình duyệt.' }]);
            updateAnswer(currentQuestion, currentAnswer);
            return;
        }
        if (Number(currentAnswer?.languageId) === 63) {
            const output = [];
            try {
                const consoleProxy = { log: (...args) => output.push({ level: 'stdout', value: args.join(' ') }), error: (...args) => output.push({ level: 'stderr', value: args.join(' ') }) };
                Function('console', `'use strict';\n${currentAnswer.sourceCode}`)(consoleProxy);
                setLogs(output.length ? output : [{ level: 'stdout', value: 'Chương trình kết thúc không có output.' }]);
            } catch (error) {
                setLogs([{ level: 'stderr', value: error.message }]);
            }
            return;
        }
        setLogs([{ level: 'stdout', value: 'Mã nguồn đã được lưu. Kết quả chấm sẽ có sau khi nộp bài.' }]);
    };

    if (!attempt || !questions.length) return <div className={styles.missingAttempt}><FiAlertTriangle /><h2>Không tìm thấy phiên làm bài</h2><Link className={ui.primaryButton} to="/student/classes">Về lớp học của tôi</Link></div>;

    if (result) return (
        <section className={styles.resultScreen}>
            <span><FiCheckCircle /></span><h2>Đã nộp bài thành công</h2>
            <p>{result.status === 'GRADED' ? `Điểm của bạn: ${result.score ?? 0}` : 'Bài làm đang được hệ thống hoặc giảng viên chấm.'}</p>
            <div><Link className={ui.secondaryButton} to={`/student/classes/${courseClass.publicId}`}>Về lớp học</Link><button className={ui.primaryButton} type="button" onClick={() => navigate('/student/grades')}>Xem điểm cá nhân</button></div>
        </section>
    );

    const isCode = ['CODE', 'HTML_CSS'].includes(currentQuestion.type);
    const previewDocument = currentAnswer?.mode === 'WEB' ? createPreviewDocument(currentAnswer.files) : '';

    return (
        <div className={styles.examShell}>
            <header className={styles.examHeader}>
                <div className={classNames(styles.violationCounter, { [styles.violationCounterDanger]: violationCount >= maxViolations - 1 })}>
                    <FiAlertTriangle />
                    <span><small>Dấu hiệu rời trang</small><strong>{violationCount}/{maxViolations}</strong></span>
                </div>
                <div><span>{courseClass.code}</span><h1>{assessment.title ?? 'Bài đánh giá'}</h1></div>
                <div className={classNames(styles.timer, { [styles.timerDanger]: remaining < 300 })}><FiClock /><span><small>Thời gian còn lại</small><strong>{formatRemaining(remaining)}</strong></span></div>
                <button className={ui.primaryButton} type="button" disabled={submitting} onClick={() => submit(false)}><FiSend /> {submitting ? 'Đang nộp...' : 'Nộp bài'}</button>
            </header>

            {violationWarning ? (
                <section className={styles.violationWarning} role="alert">
                    <FiAlertTriangle />
                    <div>
                        <strong>{violationTypeLabels[violationWarning.type] ?? violationWarning.type}</strong>
                        <span>
                            Đã ghi nhận lần {violationWarning.violationCount}/{maxViolations}
                            {violationWarning.returnedAt ? ` · ${formatAwayDuration(violationWarning.awayMs)}` : ''}.
                            Đây là dấu hiệu để giảng viên xem xét, không phải kết luận tuyệt đối.
                        </span>
                    </div>
                    <button type="button" onClick={() => setViolationWarning(null)} title="Đóng cảnh báo"><FiX /></button>
                </section>
            ) : null}

            <div className={styles.examBody}>
                <aside className={styles.questionNav}>
                    <div><strong>Câu hỏi</strong><span>{questions.filter(answered).length}/{questions.length} đã làm</span></div>
                    <div className={styles.questionGrid}>{questions.map((question, index) => <button className={classNames({ [styles.currentQuestion]: index === currentIndex, [styles.answeredQuestion]: answered(question), [styles.reviewQuestion]: reviewIds.includes(question.publicId) })} type="button" key={question.publicId} onClick={() => setCurrentIndex(index)}>{index + 1}</button>)}</div>
                    <div className={styles.legend}><span><i className={styles.legendAnswered} /> Đã trả lời</span><span><i className={styles.legendReview} /> Xem lại</span><span><i /> Chưa làm</span></div>
                    <button className={classNames(styles.reviewButton, { [styles.reviewButtonActive]: reviewIds.includes(currentQuestion.publicId) })} type="button" onClick={() => setReviewIds((current) => current.includes(currentQuestion.publicId) ? current.filter((id) => id !== currentQuestion.publicId) : [...current, currentQuestion.publicId])}><FiFlag /> {reviewIds.includes(currentQuestion.publicId) ? 'Bỏ đánh dấu xem lại' : 'Đánh dấu xem lại'}</button>
                    <div className={styles.saveStatus}>{saveStates[currentQuestion.publicId] === 'saving' ? <><FiSave /> Đang tự động lưu...</> : saveStates[currentQuestion.publicId] === 'error' ? <><FiAlertTriangle /> Lưu chưa thành công</> : <><FiCheck /> Đã tự động lưu</>}</div>
                    {violationHistory.length ? (
                        <div className={styles.violationHistory}>
                            <strong>Nhật ký phiên hiện tại</strong>
                            {[...violationHistory].reverse().map((item) => (
                                <div key={item.id}>
                                    <span>{violationTypeLabels[item.type] ?? item.type}</span>
                                    <small>
                                        Rời lúc {formatViolationTime(item.leftAt)} · {item.returnedAt
                                            ? `Quay lại ${formatViolationTime(item.returnedAt)} (${formatAwayDuration(item.awayMs).toLowerCase()})`
                                            : 'Chưa ghi nhận thời gian quay lại'}
                                    </small>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </aside>

                <main className={classNames(styles.questionWorkspace, { [styles.codeQuestionWorkspace]: isCode })}>
                    <section className={styles.questionPrompt}>
                        <div><span>Câu {currentIndex + 1}</span><span>{questionTypeLabels[currentQuestion.type]} · {currentQuestion.points} điểm</span></div>
                        <div className={styles.promptContent} dangerouslySetInnerHTML={{ __html: currentQuestion.content }} />
                    </section>

                    {['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(currentQuestion.type) ? <section className={styles.optionsList}>{currentQuestion.options?.map((option, index) => {
                        const checked = currentAnswer.selectedOptionPublicIds?.includes(option.publicId);
                        return <label className={classNames({ [styles.optionChecked]: checked })} key={option.publicId}><input type={currentQuestion.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'} name={`question-${currentQuestion.publicId}`} checked={checked} onChange={() => toggleOption(option.publicId)} /><span>{String.fromCharCode(65 + index)}</span><strong>{option.content}</strong></label>;
                    })}</section> : null}

                    {currentQuestion.type === 'ESSAY' ? <section className={styles.essayAnswer}><label>Câu trả lời</label><textarea value={currentAnswer.textAnswer ?? ''} onChange={(event) => updateAnswer(currentQuestion, { ...currentAnswer, textAnswer: event.target.value })} placeholder="Nhập bài làm của bạn..." /><small>{(currentAnswer.textAnswer ?? '').length} ký tự</small></section> : null}

                    {isCode ? <section className={styles.codeArea}>
                        <div className={styles.codeToolbar}>
                            {currentAnswer.mode === 'WEB' ? <div className={styles.fileTabs}>{Object.keys(currentAnswer.files).map((fileKey) => <button className={classNames({ [styles.fileTabActive]: activeFile === fileKey })} type="button" key={fileKey} onClick={() => setActiveFile(fileKey)}>{fileKey.toUpperCase()}</button>)}</div> : <strong><FiCode /> {editorLanguageById[currentAnswer.languageId] ?? 'Source code'}</strong>}
                            <div><button className={ui.secondaryButton} type="button" onClick={() => saveAnswer(currentQuestion, currentAnswer, false)}><FiSave /> Lưu</button><button className={ui.secondaryButton} type="button" onClick={runCode}><FiPlay /> Chạy thử</button></div>
                        </div>
                        <div className={styles.monacoFrame}><Editor height="100%" language={currentAnswer.mode === 'WEB' ? ({ html: 'html', css: 'css', js: 'javascript' }[activeFile]) : editorLanguageById[currentAnswer.languageId] ?? 'plaintext'} theme="vs-dark" value={currentAnswer.mode === 'WEB' ? currentAnswer.files[activeFile] : currentAnswer.sourceCode} onChange={(value) => currentAnswer.mode === 'WEB' ? updateCodeFile(activeFile, value) : updateAnswer(currentQuestion, { ...currentAnswer, sourceCode: value ?? '' })} options={{ minimap: { enabled: false }, fontSize: 14, lineNumbersMinChars: 3, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2 }} /></div>
                        <div className={styles.outputArea}>
                            {currentAnswer.mode === 'WEB' ? <section><header><FiEye /> Trình duyệt</header><iframe srcDoc={previewDocument} title="Xem trước bài làm" sandbox="allow-scripts" /></section> : null}
                            <section><header><FiCode /> Log</header><pre>{logs.map((item, index) => <span className={item.level === 'stderr' ? styles.logError : ''} key={`${item.value}-${index}`}>{item.value}{'\n'}</span>)}</pre></section>
                        </div>
                    </section> : null}

                    <footer className={styles.questionFooter}><button className={ui.secondaryButton} type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((value) => value - 1)}><FiArrowLeft /> Câu trước</button><button className={ui.secondaryButton} type="button" disabled={currentIndex === questions.length - 1} onClick={() => setCurrentIndex((value) => value + 1)}>Câu tiếp <FiArrowRight /></button></footer>
                </main>
            </div>
        </div>
    );
}
