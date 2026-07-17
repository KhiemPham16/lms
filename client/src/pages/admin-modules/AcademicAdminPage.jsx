import classNames from 'classnames';
import MonacoEditor from '@monaco-editor/react';
import { Editor } from '@tinymce/tinymce-react';
import 'tinymce/tinymce';
import 'tinymce/models/dom';
import 'tinymce/icons/default';
import 'tinymce/themes/silver';
import 'tinymce/plugins/code';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/table';
import 'tinymce/plugins/wordcount';
import 'tinymce/skins/ui/oxide/skin.min.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertTriangle, FiArchive, FiAward, FiBarChart2, FiBookOpen, FiBriefcase, FiCheck, FiCheckSquare, FiChevronLeft, FiChevronRight, FiClock, FiCode, FiDownload, FiEdit2, FiEye, FiFileText, FiPlus, FiRefreshCcw, FiSave, FiSend, FiTerminal, FiUsers, FiXCircle } from 'react-icons/fi';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { apiClient, getApiMessage } from '~/shared/api/http.js';
import { adminModulesApi } from '~/shared/api/adminModulesApi.js';
import { mediaApi } from '~/shared/api/mediaApi.js';
import { userAccountsApi } from '~/shared/api/userAccountsApi.js';
import { moduleMeta } from '~/shared/constants/modules.js';
import { roleLabels, userRoles } from '~/shared/constants/roles.js';
import { ModalBackdrop } from '~/shared/components/ModalBackdrop.jsx';
import { useAuthStore } from '~/shared/store/authStore.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './AdminModulePages.module.scss';

const icons = {
    subjects: FiBookOpen,
    classes: FiBriefcase,
    approvals: FiCheckSquare,
    subjectProposals: FiBookOpen,
    classProposals: FiBriefcase,
    enrollments: FiBriefcase,
    reports: FiCheckSquare
};

const statusOptions = ['DRAFT', 'OPEN_REGISTRATION', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const classWorkspaceTabs = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'learningModules', label: 'Module học' },
    { key: 'students', label: 'Sinh viên' },
    { key: 'grades', label: 'Điểm' },
    { key: 'stats', label: 'Thống kê' }
];
const lecturerClassWorkspaceTabs = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'learningModules', label: 'Chương & bài học' },
    { key: 'students', label: 'Sinh viên' },
    { key: 'quizzes', label: 'Bài kiểm tra' },
    { key: 'exams', label: 'Bài thi' },
    { key: 'grading', label: 'Chấm bài' },
    { key: 'grades', label: 'Điểm' },
    { key: 'stats', label: 'Thống kê' }
];
const lessonContentTypes = [
    { key: 'TEXT', label: 'Text', description: 'Nội dung văn bản, ghi chú hoặc hướng dẫn học tập.' },
    { key: 'VIDEO', label: 'Video', description: 'Nhúng video bài giảng hoặc đường dẫn học liệu.' },
    { key: 'PDF', label: 'PDF', description: 'Tài liệu bài đọc, slide hoặc đề cương dạng PDF.' }
];
const assessmentGroups = [
    { key: 'ASSIGNMENT', label: 'Bài tập', description: 'Hoạt động có điểm trong quá trình học.' },
    { key: 'QUIZ', label: 'Bài kiểm tra', description: 'Bài kiểm tra ngắn, hệ thống ghi nhận điểm.' },
    { key: 'MIDTERM', label: 'Bài thi giữa kỳ', description: 'Bài thi giữa kỳ chính thức.' },
    { key: 'FINAL', label: 'Bài thi cuối kỳ', description: 'Bài thi cuối kỳ chính thức.' }
];
const assessmentQuestionTypes = [
    { key: 'CODE', label: 'Code', description: 'Chấm tự động theo ngôn ngữ và test case.' },
    { key: 'QUIZ', label: 'Trắc nghiệm', description: 'Chấm tự động theo đáp án đúng.' },
    { key: 'ESSAY', label: 'Tự luận', description: 'Sinh viên nộp bài viết, giáo viên chấm thủ công.' }
];
const gradedLessonTypes = ['CODE', 'QUIZ', 'ESSAY'];
const questionTypeByLessonType = {
    CODE: 'CODE',
    QUIZ: 'SINGLE_CHOICE',
    ESSAY: 'ESSAY'
};
const quizQuestionTypes = [
    { key: 'SINGLE_CHOICE', label: 'Một đáp án' },
    { key: 'MULTIPLE_CHOICE', label: 'Nhiều đáp án' },
    { key: 'TRUE_FALSE', label: 'Đúng / Sai' }
];
const createQuizOption = (id, content = '', isCorrect = false) => ({ id, content, isCorrect });
const createQuizQuestion = (id, type = 'SINGLE_CHOICE') => ({
    id,
    type,
    content: '',
    points: 1,
    options: type === 'TRUE_FALSE'
        ? [createQuizOption(`${id}-true`, 'Đúng', true), createQuizOption(`${id}-false`, 'Sai')]
        : [createQuizOption(`${id}-a`, 'Đáp án A', true), createQuizOption(`${id}-b`, 'Đáp án B')]
});
const getQuizQuestions = (lesson) => lesson.quizQuestions?.length
    ? lesson.quizQuestions
    : [{
        id: `${lesson.id}-question-1`,
        type: 'SINGLE_CHOICE',
        content: lesson.content ?? '',
        points: lesson.points ?? 1,
        options: lesson.options?.length
            ? lesson.options
            : createQuizQuestion(`${lesson.id}-question-1`).options
    }];
const codeExerciseModes = [
    { key: 'SINGLE', label: 'Chấm tự động bằng Judge0' },
    { key: 'WEB', label: 'HTML/CSS/JS có xem trước' }
];
const assessmentDurationOptions = {
    QUIZ: [15, 45],
    MIDTERM: [45, 60],
    FINAL: [45, 60, 120]
};
const editorLanguageByJudgeId = {
    50: 'c',
    54: 'cpp',
    51: 'csharp',
    62: 'java',
    63: 'javascript',
    71: 'python'
};
const createDefaultStarterFiles = () => ({
    html: '<main>\n  <h1>Hello LMS</h1>\n</main>',
    css: 'body {\n  font-family: Arial, sans-serif;\n}',
    js: "console.log('Ready');"
});
const createWebPreviewDocument = (files) => `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${files?.css ?? ''}</style></head>
<body>${files?.html ?? ''}<script>${files?.js ?? ''}</script></body>
</html>`;
const defaultAssessmentDates = () => {
    const openAt = new Date();
    const closeAt = new Date(openAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
        openAt: openAt.toISOString(),
        closeAt: closeAt.toISOString()
    };
};
const createDefaultLessonSections = () => [
    {
        id: 'chapter-1',
        title: 'Chương 1',
        isPublished: true,
        isAutoCreated: true,
        lessons: []
    }
];
const getYoutubeEmbedUrl = (url) => {
    if (!url?.trim()) return '';
    try {
        const parsedUrl = new URL(url.trim());
        const hostname = parsedUrl.hostname.replace(/^www\./, '');
        let videoId = '';

        if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
            if (parsedUrl.pathname === '/watch') videoId = parsedUrl.searchParams.get('v') ?? '';
            if (parsedUrl.pathname.startsWith('/embed/')) videoId = parsedUrl.pathname.split('/')[2] ?? '';
            if (parsedUrl.pathname.startsWith('/shorts/')) videoId = parsedUrl.pathname.split('/')[2] ?? '';
        }

        if (hostname === 'youtu.be') {
            videoId = parsedUrl.pathname.replace('/', '');
        }

        return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
    } catch {
        return '';
    }
};

const getApiAbsoluteUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const apiBaseUrl = apiClient.defaults.baseURL ?? '';
    const appBaseUrl = apiBaseUrl.replace(/\/api\/v\d+\/?$/, '');
    if (url.startsWith('/api/')) return `${appBaseUrl}${url}`;
    if (url.startsWith('/')) return `${apiBaseUrl.replace(/\/$/, '')}${url}`;
    return `${apiBaseUrl.replace(/\/$/, '')}/${url}`;
};

const getMediaFileUrl = (mediaPublicId, fallbackUrl = '') => {
    if (mediaPublicId) return getApiAbsoluteUrl(`/api/v1/media/${mediaPublicId}`);
    return getApiAbsoluteUrl(fallbackUrl);
};

const getPdfViewerUrl = (url) => (url ? `${url}#toolbar=1&navpanes=1&scrollbar=1&view=FitH` : '');

const getPdfPreviewUrl = (lesson, pdfPreviewUrls) => {
    if (lesson?.mediaPublicId) return pdfPreviewUrls[lesson.mediaPublicId] ?? '';
    return lesson?.mediaUrl ?? '';
};

const normalizeLearningLesson = (lesson) => ({
    id: lesson?.publicId ?? lesson?.id,
    publicId: lesson?.publicId ?? lesson?.id,
    title: lesson?.title ?? '',
    type: lesson?.type ?? 'TEXT',
    content: lesson?.content ?? '',
    videoUrl: lesson?.resourceUrl ?? '',
    mediaPublicId: lesson?.media?.publicId ?? lesson?.mediaPublicId ?? '',
    mediaTitle: lesson?.media?.title || lesson?.media?.originalName || '',
    mediaUrl: getMediaFileUrl(lesson?.media?.publicId ?? lesson?.mediaPublicId, lesson?.resourceUrl),
    resourceUrl: lesson?.resourceUrl ?? '',
    isPublished: Boolean(lesson?.isPublished)
});

const normalizeLearningSection = (section) => ({
    id: section?.publicId ?? section?.id,
    publicId: section?.publicId ?? section?.id,
    title: section?.title ?? 'Chương',
    isPublished: section?.isPublished ?? true,
    isAutoCreated: section?.title === 'Chương 1',
    lessons: toItems(section?.lessons).map(normalizeLearningLesson)
});

const normalizeAssessmentContentItem = (assessment) => {
    const questions = toItems(assessment?.questions);
    const firstQuestion = questions[0];
    const questionType = firstQuestion?.type ?? assessment?.questionType;
    const type = ['CODE', 'HTML_CSS'].includes(questionType)
        ? 'CODE'
        : questionType === 'ESSAY'
            ? 'ESSAY'
            : 'QUIZ';
    const normalizeQuizQuestionType = (question) => {
        if (question.type !== 'SINGLE_CHOICE') return question.type;
        const labels = toItems(question.options).map((option) => option.content?.trim().toLocaleLowerCase('vi-VN'));
        return labels.length === 2 && labels.includes('đúng') && labels.includes('sai') ? 'TRUE_FALSE' : 'SINGLE_CHOICE';
    };
    const quizQuestions = type === 'QUIZ' ? questions.map((question) => ({
        id: question.publicId ?? question.id,
        publicId: question.publicId ?? question.id,
        type: normalizeQuizQuestionType(question),
        content: question.content ?? '',
        points: Number(question.points) || 1,
        options: toItems(question.options).map((option) => ({
            id: option.publicId ?? option.id,
            publicId: option.publicId ?? option.id,
            content: option.content ?? '',
            isCorrect: Boolean(option.isCorrect)
        }))
    })) : [];
    let starterFiles = createDefaultStarterFiles();
    if (questionType === 'HTML_CSS' && firstQuestion?.starterCode) {
        try {
            const starterConfig = JSON.parse(firstQuestion.starterCode);
            starterFiles = { ...starterFiles, ...(starterConfig.files ?? {}) };
        } catch {
            starterFiles.html = firstQuestion.starterCode;
        }
    }

    return {
        id: assessment?.publicId ?? assessment?.id,
        publicId: assessment?.publicId ?? assessment?.id,
        assessmentPublicId: assessment?.publicId ?? assessment?.id,
        type,
        assessmentCategory: assessment?.category ?? 'ASSIGNMENT',
        title: assessment?.title ?? 'Bài đánh giá',
        content: firstQuestion?.content ?? assessment?.description ?? '',
        openAt: assessment?.openAt ?? '',
        closeAt: assessment?.closeAt ?? '',
        durationMinutes: assessment?.durationMinutes ?? '',
        maxAttempts: assessment?.maxAttempts ?? 1,
        scorePolicy: assessment?.scorePolicy ?? 'HIGHEST',
        maxViolations: assessment?.maxViolations ?? 3,
        points: Number(firstQuestion?.points ?? assessment?.points) || 10,
        questionType,
        quizQuestions,
        judgeLanguageId: firstQuestion?.judgeLanguageId ?? '',
        starterCode: questionType === 'CODE' ? (firstQuestion?.starterCode ?? '') : '',
        starterFiles,
        codeMode: questionType === 'HTML_CSS' ? 'WEB' : 'SINGLE',
        testCases: toItems(firstQuestion?.testCases).map((testCase) => ({
            id: testCase.publicId ?? testCase.id,
            publicId: testCase.publicId ?? testCase.id,
            input: testCase.input ?? '',
            expectedOutput: testCase.expectedOutput ?? '',
            isHidden: Boolean(testCase.isHidden)
        })),
        isPublished: Boolean(assessment?.isPublished),
        isDraft: false,
        isGradedAssessment: true,
        hasQuestionConfig: questions.length > 0
    };
};

const emptyForm = {
    code: '',
    name: '',
    description: ''
};

const emptySubjectProposalForm = {
    code: '',
    name: '',
    description: '',
    credits: 3,
    assignmentWeight: 10,
    quizWeight: 20,
    midtermWeight: 20,
    finalWeight: 50,
    passScore: 5
};

const emptyClassProposalForm = {
    subjectPublicId: '',
    requestedClassCount: 1,
    maxStudentsPerClass: 50,
    registrationStart: '',
    registrationEnd: '',
    note: ''
};

const proposalStatusLabels = {
    DRAFT: 'Nháp',
    PENDING_TRAINING: 'Chờ Phòng đào tạo duyệt',
    PENDING_PRINCIPAL: 'Chờ Hiệu trưởng duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Từ chối',
    PENDING: 'Chờ Phòng đào tạo duyệt'
};

const subjectStatusLabels = {
    DRAFT: 'Nháp',
    PUBLIC: 'Đang công khai',
    ARCHIVE: 'Đã lưu trữ'
};

const restoreRequestStatusLabels = {
    PENDING: 'Chờ Hiệu trưởng duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Đã từ chối'
};

const classStatusLabels = {
    DRAFT: 'Nháp',
    OPEN_REGISTRATION: 'Đang mở đăng ký',
    IN_PROGRESS: 'Đang học',
    COMPLETED: 'Đã hoàn thành',
    CANCELLED: 'Đã hủy'
};

const violationTypeLabels = {
    WINDOW_BLUR: 'Mất tập trung khỏi cửa sổ',
    PAGE_HIDDEN: 'Rời hoặc ẩn trang làm bài',
    EXIT_FULLSCREEN: 'Thoát chế độ toàn màn hình',
    HEARTBEAT_LOST: 'Mất kết nối giám sát'
};

const toItems = (value) => (Array.isArray(value) ? value : value?.data ?? value?.items ?? []);
const getCategoryScoreValue = (row, category) => {
    if (Array.isArray(row.categoryScores)) {
        return row.categoryScores.find((score) => score.category === category)?.score ?? '-';
    }
    return row.categoryScores?.[category] ?? '-';
};
const toDateTimeInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
};
const formatDecimal = (value, suffix = '') => {
    if (value === null || value === undefined || value === '') return '-';
    const number = Number(value);
    if (Number.isNaN(number)) return `${value}${suffix}`;
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(number)}${suffix}`;
};
const toNumberOrDefault = (value, fallback) => {
    const number = Number(value);
    return Number.isNaN(number) ? fallback : number;
};
const normalizeSubjectProposalForm = (value = {}) => ({
    code: value.code ?? '',
    name: value.name ?? '',
    description: value.description ?? '',
    credits: toNumberOrDefault(value.credits, 3),
    assignmentWeight: toNumberOrDefault(value.assignmentWeight, 10),
    quizWeight: toNumberOrDefault(value.quizWeight, 20),
    midtermWeight: toNumberOrDefault(value.midtermWeight, 20),
    finalWeight: toNumberOrDefault(value.finalWeight, 50),
    passScore: toNumberOrDefault(value.passScore, 5)
});
const escapeCsvCell = (value) => {
    const normalizedValue = String(value ?? '');
    return `"${normalizedValue.replace(/"/g, '""')}"`;
};
const downloadCsvFile = (filename, rows) => {
    const csvContent = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

function StatusPill({ value, status }) {
    const normalizedStatus = String(status ?? value ?? '').toUpperCase();
    const activeStatuses = ['PUBLIC', 'APPROVED', 'OPEN_REGISTRATION', 'IN_PROGRESS', 'COMPLETED'];
    const pendingStatuses = ['PENDING', 'PENDING_TRAINING', 'PENDING_PRINCIPAL'];
    const dangerStatuses = ['REJECTED', 'CANCELLED'];
    const inactiveStatuses = ['DRAFT', 'ARCHIVE'];

    return (
        <span
            className={classNames(ui.statusPill, {
                [ui.statusPillActive]: activeStatuses.includes(normalizedStatus),
                [ui.statusPillPending]: pendingStatuses.includes(normalizedStatus),
                [ui.statusPillLocked]: dangerStatuses.includes(normalizedStatus),
                [ui.statusPillInactive]: inactiveStatuses.includes(normalizedStatus)
            })}
        >
            {value ?? '-'}
        </span>
    );
}

function CodeAssessmentConfig({
    activeFile,
    addTestCase,
    classItem,
    judgeLanguages,
    lesson,
    removeTestCase,
    sectionId,
    setActiveFile,
    updateField,
    updateMode,
    updateStarterFile,
    updateTestCase
}) {
    const isWebCode = lesson.codeMode === 'WEB';
    const category = assessmentGroups.find((item) => item.key === lesson.assessmentCategory);
    const durationOptions = assessmentDurationOptions[lesson.assessmentCategory] ?? [];
    const supportedJudgeLanguages = judgeLanguages.filter((language) => language.judgeEnabled !== false && Number(language.id) > 0);
    const starterFiles = lesson.starterFiles ?? createDefaultStarterFiles();
    const selectedFile = activeFile ?? 'html';
    const selectedEditorLanguage = isWebCode
        ? { html: 'html', css: 'css', js: 'javascript' }[selectedFile]
        : (editorLanguageByJudgeId[Number(lesson.judgeLanguageId)] ?? 'plaintext');
    const changeField = (field, value) => updateField(classItem, sectionId, lesson.id, field, value);

    return (
        <div className={styles.codeAssessmentWorkspace}>
            <header className={styles.codeAssessmentHeader}>
                <div className={styles.codeAssessmentIdentity}>
                    <span><FiCode /></span>
                    <div>
                        <p>{category?.label ?? 'Bài đánh giá Code'}</p>
                        <h4>{lesson.title || 'Chưa đặt tên bài'}</h4>
                    </div>
                </div>
                <div className={styles.codeAssessmentBadges}>
                    <StatusPill value={isWebCode ? 'Chấm thủ công' : 'Chấm tự động'} status={isWebCode ? 'PENDING' : 'PUBLIC'} />
                    <StatusPill value={lesson.isPublished ? 'Đã công bố' : 'Bản nháp'} status={lesson.isPublished ? 'PUBLIC' : 'DRAFT'} />
                </div>
            </header>

            <div className={styles.codeAssessmentLayout}>
                <div className={styles.codeAssessmentMain}>
                    <section className={styles.codeConfigSection}>
                        <div className={styles.codeConfigHeading}>
                            <span>1</span>
                            <div><strong>Nội dung đề</strong><small>Thông tin sinh viên nhìn thấy khi mở bài.</small></div>
                        </div>
                        <label>
                            Tên bài
                            <input value={lesson.title ?? ''} maxLength={200} onChange={(event) => changeField('title', event.target.value)} placeholder="Ví dụ: Kiểm tra thuật toán sắp xếp" />
                        </label>
                        <label>
                            Yêu cầu bài làm
                            <textarea
                                className={styles.codeProblemInput}
                                value={lesson.content ?? ''}
                                onChange={(event) => changeField('content', event.target.value)}
                                placeholder="Mô tả yêu cầu, định dạng dữ liệu vào/ra, ràng buộc và ví dụ"
                            />
                        </label>
                    </section>

                    <section className={styles.codeConfigSection}>
                        <div className={styles.codeConfigHeading}>
                            <span>2</span>
                            <div><strong>Môi trường lập trình</strong><small>{isWebCode ? 'HTML/CSS/JS có trình duyệt xem trước.' : 'Judge0 chạy code và đối chiếu test case.'}</small></div>
                        </div>
                        <div className={styles.codeRuntimeGrid}>
                            <label>
                                Kiểu bài Code
                                <select value={lesson.codeMode ?? 'SINGLE'} onChange={(event) => updateMode(classItem, sectionId, lesson, event.target.value)}>
                                    {codeExerciseModes.map((mode) => <option value={mode.key} key={mode.key}>{mode.label}</option>)}
                                </select>
                            </label>
                            {!isWebCode ? (
                                <label>
                                    Ngôn ngữ chấm
                                    <select value={lesson.judgeLanguageId ?? ''} onChange={(event) => changeField('judgeLanguageId', event.target.value)}>
                                        {supportedJudgeLanguages.map((language) => <option value={language.id} key={language.id}>{language.name}</option>)}
                                    </select>
                                </label>
                            ) : (
                                <div className={styles.codeRuntimeStatus}><FiEye /><span>Preview trong trình duyệt</span><strong>HTML_CSS</strong></div>
                            )}
                        </div>

                        {isWebCode ? (
                            <div className={styles.webCodeWorkspace}>
                                <div className={styles.codeFileTabs} role="tablist" aria-label="File khởi tạo">
                                    {['html', 'css', 'js'].map((fileKey) => (
                                        <button
                                            className={classNames({ [styles.activeCodeFileTab]: selectedFile === fileKey })}
                                            type="button"
                                            role="tab"
                                            aria-selected={selectedFile === fileKey}
                                            onClick={() => setActiveFile(fileKey)}
                                            key={fileKey}
                                        >
                                            {fileKey === 'js' ? 'script.js' : `index.${fileKey}`}
                                        </button>
                                    ))}
                                </div>
                                <div className={styles.codeEditorShell}>
                                    <MonacoEditor
                                        height="300px"
                                        language={selectedEditorLanguage}
                                        theme="vs-dark"
                                        value={starterFiles[selectedFile] ?? ''}
                                        onChange={(value) => updateStarterFile(classItem, sectionId, lesson, selectedFile, value ?? '')}
                                        options={{ minimap: { enabled: false }, fontSize: 14, lineNumbersMinChars: 3, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2 }}
                                    />
                                </div>
                                <div className={styles.webPreviewPanel}>
                                    <div><FiEye /><strong>Trình duyệt</strong></div>
                                    <iframe title={`Xem trước ${lesson.title}`} sandbox="allow-scripts" srcDoc={createWebPreviewDocument(starterFiles)} />
                                </div>
                            </div>
                        ) : (
                            <div className={styles.codeEditorBlock}>
                                <div><FiTerminal /><strong>Code khởi tạo</strong><span>{supportedJudgeLanguages.find((language) => Number(language.id) === Number(lesson.judgeLanguageId))?.name ?? 'Chọn ngôn ngữ'}</span></div>
                                <div className={styles.codeEditorShell}>
                                    <MonacoEditor
                                        height="300px"
                                        language={selectedEditorLanguage}
                                        theme="vs-dark"
                                        value={lesson.starterCode ?? ''}
                                        onChange={(value) => changeField('starterCode', value ?? '')}
                                        options={{ minimap: { enabled: false }, fontSize: 14, lineNumbersMinChars: 3, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4 }}
                                    />
                                </div>
                            </div>
                        )}
                    </section>

                    {!isWebCode ? (
                        <section className={styles.codeConfigSection}>
                            <div className={styles.codeSectionHeader}>
                                <div className={styles.codeConfigHeading}>
                                    <span>3</span>
                                    <div><strong>Test case</strong><small>BE chấm đều theo số test case đạt.</small></div>
                                </div>
                                <button className={ui.secondaryButton} type="button" onClick={addTestCase} title="Thêm test case"><FiPlus /> Thêm</button>
                            </div>
                            <div className={styles.codeTestCaseList}>
                                {(lesson.testCases ?? []).map((testCase, testCaseIndex) => (
                                    <article className={styles.codeTestCaseCard} key={testCase.id}>
                                        <header>
                                            <div><span>{String(testCaseIndex + 1).padStart(2, '0')}</span><strong>Test case {testCaseIndex + 1}</strong></div>
                                            <div>
                                                <label className={styles.inlineCheck}>
                                                    <input type="checkbox" checked={Boolean(testCase.isHidden)} onChange={(event) => updateTestCase(testCase.id, { isHidden: event.target.checked })} />
                                                    Test ẩn
                                                </label>
                                                <button className={styles.iconDangerButton} type="button" onClick={() => removeTestCase(testCase.id)} disabled={(lesson.testCases?.length ?? 0) <= 1} title="Xóa test case"><FiXCircle /></button>
                                            </div>
                                        </header>
                                        <div className={styles.codeTestCaseRow}>
                                            <label>Input<textarea value={testCase.input ?? ''} onChange={(event) => updateTestCase(testCase.id, { input: event.target.value })} placeholder="Dữ liệu đầu vào" /></label>
                                            <label>Expected output<textarea value={testCase.expectedOutput ?? ''} onChange={(event) => updateTestCase(testCase.id, { expectedOutput: event.target.value })} placeholder="Kết quả chính xác" /></label>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>

                <aside className={styles.codeAssessmentSidebar}>
                    <section className={styles.codeSettingsPanel}>
                        <div><FiAward /><strong>Chấm điểm</strong></div>
                        <label>Điểm tối đa<input type="number" min="0.01" step="0.25" value={lesson.points ?? 10} onChange={(event) => changeField('points', event.target.value)} /></label>
                        <label>
                            Chính sách điểm
                            <select value={lesson.scorePolicy ?? 'HIGHEST'} onChange={(event) => changeField('scorePolicy', event.target.value)}>
                                <option value="HIGHEST">Lấy điểm cao nhất</option>
                                <option value="LATEST">Lấy lần nộp mới nhất</option>
                            </select>
                        </label>
                        <label>Số lượt làm<input type="number" min="1" max="20" value={lesson.maxAttempts ?? 1} onChange={(event) => changeField('maxAttempts', event.target.value)} /></label>
                    </section>

                    <section className={styles.codeSettingsPanel}>
                        <div><FiClock /><strong>Thời gian làm bài</strong></div>
                        <label>Mở từ<input type="datetime-local" value={toDateTimeInput(lesson.openAt)} onChange={(event) => changeField('openAt', event.target.value ? new Date(event.target.value).toISOString() : '')} /></label>
                        <label>Đóng lúc<input type="datetime-local" value={toDateTimeInput(lesson.closeAt)} onChange={(event) => changeField('closeAt', event.target.value ? new Date(event.target.value).toISOString() : '')} /></label>
                        {durationOptions.length ? (
                            <label>
                                Thời lượng
                                <select value={lesson.durationMinutes ?? durationOptions[0]} onChange={(event) => changeField('durationMinutes', event.target.value)}>
                                    {durationOptions.map((minutes) => <option value={minutes} key={minutes}>{minutes} phút</option>)}
                                </select>
                            </label>
                        ) : (
                            <div className={styles.backendRuleNote}><FiCheck /> Bài tập không giới hạn thời lượng cố định</div>
                        )}
                    </section>

                    <section className={styles.codeSettingsPanel}>
                        <div><FiAlertTriangle /><strong>Vi phạm</strong></div>
                        <label>Số lần tối đa<input type="number" min="1" max="20" value={lesson.maxViolations ?? 3} onChange={(event) => changeField('maxViolations', event.target.value)} /></label>
                    </section>
                </aside>
            </div>
        </div>
    );
}

function QuizAssessmentConfig({ classItem, lesson, sectionId, updateField }) {
    const questions = getQuizQuestions(lesson);
    const durationOptions = assessmentDurationOptions[lesson.assessmentCategory] ?? [];
    const totalPoints = questions.reduce((sum, question) => sum + (Number(question.points) || 0), 0);
    const changeField = (field, value) => updateField(classItem, sectionId, lesson.id, field, value);
    const updateQuestions = (nextQuestions) => changeField('quizQuestions', nextQuestions);
    const updateQuestion = (questionId, patch) => updateQuestions(
        questions.map((question) => question.id === questionId ? { ...question, ...patch } : question)
    );
    const updateOption = (question, optionId, patch) => updateQuestion(question.id, {
        options: question.options.map((option) => option.id === optionId ? { ...option, ...patch } : option)
    });
    const selectCorrectOption = (question, optionId, checked) => updateQuestion(question.id, {
        options: question.options.map((option) => ({
            ...option,
            isCorrect: question.type === 'MULTIPLE_CHOICE'
                ? (option.id === optionId ? checked : option.isCorrect)
                : option.id === optionId
        }))
    });
    const changeQuestionType = (question, type) => updateQuestion(question.id, {
        type,
        options: type === 'TRUE_FALSE'
            ? [createQuizOption(`${question.id}-true`, 'Đúng', true), createQuizOption(`${question.id}-false`, 'Sai')]
            : (question.type === 'TRUE_FALSE'
                ? [createQuizOption(`${question.id}-a`, 'Đáp án A', true), createQuizOption(`${question.id}-b`, 'Đáp án B')]
                : question.options.map((option, index) => ({ ...option, isCorrect: index === 0 })))
    });
    const addQuestion = () => {
        let questionNumber = questions.length + 1;
        while (questions.some((question) => question.id === `${lesson.id}-question-${questionNumber}`)) questionNumber += 1;
        const questionId = `${lesson.id}-question-${questionNumber}`;
        updateQuestions([...questions, createQuizQuestion(questionId)]);
    };
    const removeQuestion = (questionId) => {
        if (questions.length <= 1) return;
        updateQuestions(questions.filter((question) => question.id !== questionId));
    };
    const addOption = (question) => {
        let optionNumber = question.options.length + 1;
        while (question.options.some((option) => option.id === `${question.id}-option-${optionNumber}`)) optionNumber += 1;
        const optionId = `${question.id}-option-${optionNumber}`;
        updateQuestion(question.id, { options: [...question.options, createQuizOption(optionId)] });
    };
    const removeOption = (question, optionId) => {
        if (question.options.length <= 2) return;
        const nextOptions = question.options.filter((option) => option.id !== optionId);
        if (!nextOptions.some((option) => option.isCorrect)) nextOptions[0] = { ...nextOptions[0], isCorrect: true };
        updateQuestion(question.id, { options: nextOptions });
    };

    return (
        <div className={styles.quizAssessmentWorkspace}>
            <div className={styles.quizAssessmentToolbar}>
                <div>
                    <strong>{questions.length} câu hỏi</strong>
                    <span>{totalPoints} điểm</span>
                </div>
                <button className={ui.secondaryButton} type="button" onClick={addQuestion}><FiPlus /> Thêm câu hỏi</button>
            </div>

            <div className={styles.quizQuestionList}>
                {questions.map((question, questionIndex) => (
                    <article className={styles.quizQuestionCard} key={question.id}>
                        <header>
                            <strong>Câu {questionIndex + 1}</strong>
                            <div>
                                <label>
                                    Loại câu
                                    <select value={question.type} onChange={(event) => changeQuestionType(question, event.target.value)}>
                                        {quizQuestionTypes.map((type) => <option value={type.key} key={type.key}>{type.label}</option>)}
                                    </select>
                                </label>
                                <label>
                                    Điểm
                                    <input type="number" min="0.01" step="0.25" value={question.points ?? 1} onChange={(event) => updateQuestion(question.id, { points: event.target.value })} />
                                </label>
                                <button className={styles.iconDangerButton} type="button" disabled={questions.length <= 1} onClick={() => removeQuestion(question.id)} title="Xóa câu hỏi"><FiXCircle /></button>
                            </div>
                        </header>
                        <label>
                            Nội dung câu hỏi
                            <textarea value={question.content ?? ''} onChange={(event) => updateQuestion(question.id, { content: event.target.value })} />
                        </label>
                        <div className={styles.quizOptionList}>
                            {question.options.map((option, optionIndex) => (
                                <div className={styles.quizOptionRow} key={option.id}>
                                    <input
                                        aria-label={`Đáp án đúng câu ${questionIndex + 1}, lựa chọn ${optionIndex + 1}`}
                                        type={question.type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                                        name={`correct-${lesson.id}-${question.id}`}
                                        checked={Boolean(option.isCorrect)}
                                        onChange={(event) => selectCorrectOption(question, option.id, event.target.checked)}
                                    />
                                    <input
                                        value={option.content}
                                        disabled={question.type === 'TRUE_FALSE'}
                                        onChange={(event) => updateOption(question, option.id, { content: event.target.value })}
                                        placeholder={`Đáp án ${optionIndex + 1}`}
                                    />
                                    {question.type !== 'TRUE_FALSE' ? (
                                        <button className={styles.iconDangerButton} type="button" disabled={question.options.length <= 2} onClick={() => removeOption(question, option.id)} title="Xóa đáp án"><FiXCircle /></button>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                        {question.type !== 'TRUE_FALSE' ? (
                            <button className={ui.secondaryButton} type="button" onClick={() => addOption(question)}><FiPlus /> Thêm đáp án</button>
                        ) : null}
                    </article>
                ))}
            </div>

            <div className={styles.quizSettingsGrid}>
                <section>
                    <strong>Thiết lập bài làm</strong>
                    <label>Số lượt làm<input type="number" min="1" max="20" value={lesson.maxAttempts ?? 1} onChange={(event) => changeField('maxAttempts', event.target.value)} /></label>
                    <label>
                        Chính sách điểm
                        <select value={lesson.scorePolicy ?? 'HIGHEST'} onChange={(event) => changeField('scorePolicy', event.target.value)}>
                            <option value="HIGHEST">Lấy điểm cao nhất</option>
                            <option value="LATEST">Lấy lần nộp mới nhất</option>
                        </select>
                    </label>
                </section>
                <section>
                    <strong>Thời gian</strong>
                    <label>Mở từ<input type="datetime-local" value={toDateTimeInput(lesson.openAt)} onChange={(event) => changeField('openAt', event.target.value ? new Date(event.target.value).toISOString() : '')} /></label>
                    <label>Đóng lúc<input type="datetime-local" value={toDateTimeInput(lesson.closeAt)} onChange={(event) => changeField('closeAt', event.target.value ? new Date(event.target.value).toISOString() : '')} /></label>
                    {durationOptions.length ? (
                        <label>Thời lượng<select value={lesson.durationMinutes ?? durationOptions[0]} onChange={(event) => changeField('durationMinutes', event.target.value)}>{durationOptions.map((minutes) => <option value={minutes} key={minutes}>{minutes} phút</option>)}</select></label>
                    ) : null}
                </section>
            </div>
        </div>
    );
}

export function AcademicAdminPage({ moduleKey }) {
    const navigate = useNavigate();
    const { classPublicId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useAuthStore((state) => state.user);
    const userPublicId = user?.publicId ?? user?.id;
    const filteredSubjectPublicId = searchParams.get('subjectPublicId') ?? '';
    const requestedClassListTab = searchParams.get('classTab') ?? 'ACTIVE';
    const classListTab = ['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(requestedClassListTab) ? requestedClassListTab : 'ACTIVE';
    const meta = moduleMeta[moduleKey] ?? moduleMeta.subjects;
    const Icon = icons[moduleKey] ?? meta.icon;
    const [data, setData] = useState({
        subjects: [],
        subjectProposals: [],
        classProposals: [],
        subjectRestoreRequests: [],
        classes: [],
        departments: [],
        lecturers: []
    });
    const [lecturerLoadError, setLecturerLoadError] = useState('');
    const [loading, setLoading] = useState(true);
    const [departmentForm, setDepartmentForm] = useState(emptyForm);
    const [subjectProposalForm, setSubjectProposalForm] = useState(emptySubjectProposalForm);
    const [classProposalForm, setClassProposalForm] = useState(emptyClassProposalForm);
    const [isSubjectProposalModalOpen, setSubjectProposalModalOpen] = useState(false);
    const [isClassProposalModalOpen, setClassProposalModalOpen] = useState(false);
    const [editingSubjectProposal, setEditingSubjectProposal] = useState(null);
    const [editingClassProposal, setEditingClassProposal] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [restoreSubject, setRestoreSubject] = useState(null);
    const [restoreReason, setRestoreReason] = useState('');
    const [selectedRestoreRequest, setSelectedRestoreRequest] = useState(null);
    const [restoreReviewReason, setRestoreReviewReason] = useState('');
    const [isRestoreSubmitting, setRestoreSubmitting] = useState(false);
    const [selectedSubjectProposal, setSelectedSubjectProposal] = useState(null);
    const [selectedClassProposal, setSelectedClassProposal] = useState(null);
    const [selectedClassAction, setSelectedClassAction] = useState(null);
    const [classActionMode, setClassActionMode] = useState('detail');
    const [classWorkspaceTab, setClassWorkspaceTab] = useState('overview');
    const [isStudentPreview, setStudentPreview] = useState(false);
    const [lessonSectionsByClass, setLessonSectionsByClass] = useState({});
    const [gradedAssessmentsByClass, setGradedAssessmentsByClass] = useState({});
    const [isLessonContentLoading, setLessonContentLoading] = useState(false);
    const [selectedLessonSectionId, setSelectedLessonSectionId] = useState('chapter-1');
    const [activeTextLessonId, setActiveTextLessonId] = useState(null);
    const [activeVideoLessonId, setActiveVideoLessonId] = useState(null);
    const [activePdfLessonId, setActivePdfLessonId] = useState(null);
    const [activeGradedLessonId, setActiveGradedLessonId] = useState(null);
    const [activeCodeFileByLesson, setActiveCodeFileByLesson] = useState({});
    const [savingGradedLessonId, setSavingGradedLessonId] = useState(null);
    const [deletingLessonId, setDeletingLessonId] = useState(null);
    const [selectedLessonType, setSelectedLessonType] = useState('TEXT');
    const [selectedAssessmentCategory, setSelectedAssessmentCategory] = useState('ASSIGNMENT');
    const [selectedAssessmentQuestionType, setSelectedAssessmentQuestionType] = useState('CODE');
    const [pdfMediaItems, setPdfMediaItems] = useState([]);
    const [isPdfMediaLoading, setPdfMediaLoading] = useState(false);
    const [uploadingPdfLessonId, setUploadingPdfLessonId] = useState(null);
    const [selectedPdfFileNames, setSelectedPdfFileNames] = useState({});
    const [pdfPreviewUrls, setPdfPreviewUrls] = useState({});
    const [judgeLanguages, setJudgeLanguages] = useState([]);
    const [workspaceGradebooks, setWorkspaceGradebooks] = useState({});
    const [workspaceAttempts, setWorkspaceAttempts] = useState({});
    const [isWorkspaceOperationsLoading, setWorkspaceOperationsLoading] = useState(false);
    const [workspaceGradeDrafts, setWorkspaceGradeDrafts] = useState({});
    const [savingWorkspaceAnswerId, setSavingWorkspaceAnswerId] = useState(null);
    const pdfPreviewUrlRef = useRef({});
    const draftLessonSequenceRef = useRef(0);
    const [reviewDrafts, setReviewDrafts] = useState({});
    const [classDrafts, setClassDrafts] = useState({});
    const [subjectFilters, setSubjectFilters] = useState({
        search: '',
        departmentPublicId: 'ALL',
        classState: 'ALL',
        page: 1,
        pageSize: 10
    });

    const currentUserRole = user?.role;
    const currentDepartmentPublicId = user?.department?.publicId;
    const roleScopedSubjects = useMemo(() => {
        if (currentUserRole !== userRoles.DEPARTMENT_HEAD) return data.subjects;
        if (!currentDepartmentPublicId) return [];

        return data.subjects.filter((subject) => subject.department?.publicId === currentDepartmentPublicId);
    }, [currentDepartmentPublicId, currentUserRole, data.subjects]);
    const approvedSubjects = useMemo(
        () => roleScopedSubjects.filter((subject) => subject.status === 'PUBLIC'),
        [roleScopedSubjects]
    );
    const subjectCatalogItems = useMemo(
        () => [userRoles.ADMIN, userRoles.PRINCIPAL, userRoles.TRAINING_OFFICER].includes(currentUserRole)
            ? roleScopedSubjects.filter((subject) => ['PUBLIC', 'ARCHIVE'].includes(subject.status))
            : approvedSubjects,
        [approvedSubjects, currentUserRole, roleScopedSubjects]
    );
    const subjectClassesByPublicId = useMemo(() => {
        const classesBySubject = new Map();
        data.classes.forEach((classItem) => {
            const subjectPublicId = classItem.subject?.publicId ?? classItem.subjectPublicId;
            if (!subjectPublicId) return;
            classesBySubject.set(subjectPublicId, [...(classesBySubject.get(subjectPublicId) ?? []), classItem]);
        });
        return classesBySubject;
    }, [data.classes]);
    const subjectClassCounts = useMemo(() => {
        const counts = new Map();
        data.classes.forEach((classItem) => {
            const subjectPublicId = classItem.subject?.publicId;
            if (subjectPublicId) counts.set(subjectPublicId, (counts.get(subjectPublicId) ?? 0) + 1);
        });
        return counts;
    }, [data.classes]);
    const subjectsWithoutClasses = useMemo(
        () => approvedSubjects.filter((subject) => (subjectClassCounts.get(subject.publicId) ?? 0) === 0),
        [approvedSubjects, subjectClassCounts]
    );
    const classProposalBySubjectPublicId = useMemo(() => {
        const proposals = new Map();

        data.classProposals.forEach((proposal) => {
            const subjectPublicId = proposal.subject?.publicId ?? proposal.subjectPublicId;
            if (!subjectPublicId || proposals.has(subjectPublicId)) return;
            proposals.set(subjectPublicId, proposal);
        });

        return proposals;
    }, [data.classProposals]);
    const subjectsAvailableForClassProposal = useMemo(
        () => subjectsWithoutClasses.filter((subject) => !classProposalBySubjectPublicId.has(subject.publicId)),
        [classProposalBySubjectPublicId, subjectsWithoutClasses]
    );
    const classProposalSubjectOptions = useMemo(() => {
        if (!editingClassProposal?.subject?.publicId) return subjectsAvailableForClassProposal;
        const hasSelectedSubject = subjectsAvailableForClassProposal.some((subject) => subject.publicId === editingClassProposal.subject.publicId);
        return hasSelectedSubject ? subjectsAvailableForClassProposal : [editingClassProposal.subject, ...subjectsAvailableForClassProposal];
    }, [editingClassProposal, subjectsAvailableForClassProposal]);
    const subjectDepartmentOptions = useMemo(() => {
        const departments = new Map();
        subjectCatalogItems.forEach((subject) => {
            if (!subject.department?.publicId) return;
            departments.set(subject.department.publicId, subject.department);
        });
        return Array.from(departments.values()).sort((first, second) => String(first.name).localeCompare(String(second.name), 'vi'));
    }, [subjectCatalogItems]);
    const filteredSubjects = useMemo(() => {
        const keyword = subjectFilters.search.trim().toLowerCase();

        return subjectCatalogItems.filter((subject) => {
            const classCount = subjectClassCounts.get(subject.publicId) ?? 0;
            const matchKeyword =
                !keyword ||
                [subject.code, subject.name, subject.description, subject.department?.code, subject.department?.name]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(keyword));
            const matchDepartment =
                subjectFilters.departmentPublicId === 'ALL' ||
                subject.department?.publicId === subjectFilters.departmentPublicId;
            const matchClassState =
                subjectFilters.classState === 'ALL' ||
                (subjectFilters.classState === 'HAS_CLASS' && classCount > 0) ||
                (subjectFilters.classState === 'NO_CLASS' && classCount === 0);

            return matchKeyword && matchDepartment && matchClassState;
        });
    }, [subjectCatalogItems, subjectClassCounts, subjectFilters]);
    const subjectTotalPages = Math.max(1, Math.ceil(filteredSubjects.length / subjectFilters.pageSize));
    const subjectCurrentPage = Math.min(subjectFilters.page, subjectTotalPages);
    const paginatedSubjects = useMemo(() => {
        const start = (subjectCurrentPage - 1) * subjectFilters.pageSize;
        return filteredSubjects.slice(start, start + subjectFilters.pageSize);
    }, [filteredSubjects, subjectCurrentPage, subjectFilters.pageSize]);
    const subjectFirstRecord = filteredSubjects.length ? (subjectCurrentPage - 1) * subjectFilters.pageSize + 1 : 0;
    const subjectLastRecord = filteredSubjects.length ? Math.min(subjectCurrentPage * subjectFilters.pageSize, filteredSubjects.length) : 0;
    // Xác định đề xuất thuộc Trưởng bộ môn hiện tại để khớp điều kiện BE khi sửa/gửi/xóa đề xuất nháp.
    const isOwnProposal = useCallback((proposal) => !proposal.proposedBy?.publicId || proposal.proposedBy.publicId === userPublicId, [userPublicId]);
    const visibleSubjectProposals = useMemo(() => {
        if (user?.role === userRoles.ADMIN) return data.subjectProposals;
        if (user?.role === userRoles.DEPARTMENT_HEAD) return data.subjectProposals.filter((proposal) => isOwnProposal(proposal) && proposal.status !== 'APPROVED');
        if (user?.role === userRoles.TRAINING_OFFICER) return data.subjectProposals.filter((proposal) => proposal.status === 'PENDING_TRAINING');
        if (user?.role === userRoles.PRINCIPAL) return data.subjectProposals.filter((proposal) => proposal.status === 'PENDING_PRINCIPAL');
        return [];
    }, [data.subjectProposals, isOwnProposal, user?.role]);
    const subjectProposalSectionTitle =
        user?.role === userRoles.DEPARTMENT_HEAD
            ? 'Quản lý đề xuất môn chưa công khai'
            : 'Duyệt đề xuất môn';
    const subjectProposalEmptyText =
        user?.role === userRoles.DEPARTMENT_HEAD
            ? 'Chưa có môn nháp hoặc đề xuất môn chưa công khai.'
            : 'Chưa có đề xuất môn học phù hợp với quyền hiện tại.';
    const visibleClassProposals = useMemo(() => {
        if (user?.role === userRoles.ADMIN) return data.classProposals;
        if (user?.role === userRoles.TRAINING_OFFICER) return data.classProposals.filter((proposal) => proposal.status === 'PENDING');
        if (user?.role === userRoles.DEPARTMENT_HEAD) return data.classProposals.filter(isOwnProposal);
        return [];
    }, [data.classProposals, isOwnProposal, user?.role]);
    const pendingRestoreRequestBySubjectPublicId = useMemo(() => {
        const requests = new Map();
        data.subjectRestoreRequests.forEach((request) => {
            if (request.status === 'PENDING' && request.subject?.publicId) requests.set(request.subject.publicId, request);
        });
        return requests;
    }, [data.subjectRestoreRequests]);
    const pendingSubjectRestoreRequests = useMemo(
        () => data.subjectRestoreRequests.filter((request) => request.status === 'PENDING'),
        [data.subjectRestoreRequests]
    );
    const pendingProposalCount = useMemo(
        () => [...visibleSubjectProposals, ...visibleClassProposals].filter((item) => ['DRAFT', 'PENDING', 'PENDING_TRAINING', 'PENDING_PRINCIPAL'].includes(item.status)).length
            + pendingSubjectRestoreRequests.length,
        [pendingSubjectRestoreRequests.length, visibleClassProposals, visibleSubjectProposals]
    );
    const metrics = useMemo(
        () => [
            { label: 'Môn học đã phê duyệt', value: approvedSubjects.length },
            { label: 'Lớp học', value: data.classes.length },
            { label: 'Đề xuất chờ xử lý', value: pendingProposalCount }
        ],
        [approvedSubjects.length, data.classes.length, pendingProposalCount]
    );
    const selectedClassSubject = useMemo(
        () => data.subjects.find((subject) => subject.publicId === filteredSubjectPublicId),
        [data.subjects, filteredSubjectPublicId]
    );
    const subjectFilteredClasses = useMemo(() => {
        const roleScopedClasses = user?.role === userRoles.LECTURER
            ? data.classes.filter((classItem) => classItem.lecturer?.publicId === userPublicId)
            : user?.role === userRoles.DEPARTMENT_HEAD
                ? data.classes.filter((classItem) =>
                    (classItem.department?.publicId ?? classItem.subject?.department?.publicId) === currentDepartmentPublicId)
                : data.classes;

        return filteredSubjectPublicId
            ? roleScopedClasses.filter((classItem) => (classItem.subject?.publicId ?? classItem.subjectPublicId) === filteredSubjectPublicId)
            : roleScopedClasses;
    }, [currentDepartmentPublicId, data.classes, filteredSubjectPublicId, user?.role, userPublicId]);
    const classListCounts = useMemo(() => ({
        ACTIVE: subjectFilteredClasses.filter((classItem) => !['COMPLETED', 'CANCELLED'].includes(classItem.status)).length,
        COMPLETED: subjectFilteredClasses.filter((classItem) => classItem.status === 'COMPLETED').length,
        CANCELLED: subjectFilteredClasses.filter((classItem) => classItem.status === 'CANCELLED').length
    }), [subjectFilteredClasses]);
    const visibleClasses = useMemo(() => subjectFilteredClasses.filter((classItem) => {
        if (classListTab === 'COMPLETED') return classItem.status === 'COMPLETED';
        if (classListTab === 'CANCELLED') return classItem.status === 'CANCELLED';
        return !['COMPLETED', 'CANCELLED'].includes(classItem.status);
    }), [classListTab, subjectFilteredClasses]);
    const workspaceClass = useMemo(
        () => subjectFilteredClasses.find((classItem) => classItem.publicId === classPublicId),
        [classPublicId, subjectFilteredClasses]
    );
    const activeClassWorkspaceTabs = user?.role === userRoles.LECTURER ? lecturerClassWorkspaceTabs : classWorkspaceTabs;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const lecturerRequest = user?.role === userRoles.DEPARTMENT_HEAD
                ? userAccountsApi.list({
                    role: userRoles.LECTURER,
                    status: 'ACTIVE',
                    employmentStatus: 'WORKING',
                    limit: 100
                }).then((result) => ({ result })).catch((error) => ({ error }))
                : Promise.resolve({ result: { items: [] } });
            const restoreRequestsRequest = [userRoles.TRAINING_OFFICER, userRoles.PRINCIPAL].includes(user?.role)
                ? adminModulesApi.listSubjectRestoreRequests().catch(() => [])
                : Promise.resolve([]);
            const [subjects, subjectProposals, classProposals, subjectRestoreRequests, classes, departments, lecturerResponse] = await Promise.all([
                adminModulesApi.listSubjects(),
                adminModulesApi.listSubjectProposals().catch(() => []),
                adminModulesApi.listClassProposals().catch(() => []),
                restoreRequestsRequest,
                adminModulesApi.listClasses(),
                adminModulesApi.listDepartments().catch(() => []),
                lecturerRequest
            ]);
            setLecturerLoadError(lecturerResponse.error
                ? getApiMessage(lecturerResponse.error, 'Không tải được danh sách giảng viên từ BE')
                : '');
            setData({
                subjects: toItems(subjects),
                subjectProposals: toItems(subjectProposals),
                classProposals: toItems(classProposals),
                subjectRestoreRequests: toItems(subjectRestoreRequests),
                classes: toItems(classes),
                departments: toItems(departments),
                lecturers: lecturerResponse.result?.items ?? []
            });
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được dữ liệu học vụ'));
        } finally {
            setLoading(false);
        }
    }, [user]);

    const loadPdfMediaItems = useCallback(async () => {
        setPdfMediaLoading(true);
        try {
            const result = await mediaApi.list({ type: 'PDF', limit: 100 });
            setPdfMediaItems(result.items ?? []);
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được danh sách PDF từ Media'));
        } finally {
            setPdfMediaLoading(false);
        }
    }, []);

    const loadPdfPreviewUrl = useCallback(async (mediaPublicId) => {
        if (!mediaPublicId || pdfPreviewUrlRef.current[mediaPublicId]) return;
        try {
            const response = await apiClient.get(`/media/${mediaPublicId}`, { responseType: 'blob' });
            const blobUrl = URL.createObjectURL(new Blob([response.data], { type: response.data?.type || 'application/pdf' }));
            pdfPreviewUrlRef.current = { ...pdfPreviewUrlRef.current, [mediaPublicId]: blobUrl };
            setPdfPreviewUrls(pdfPreviewUrlRef.current);
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được nội dung PDF để xem trước'));
        }
    }, []);

    const loadClassLessonSections = useCallback(async (classItem) => {
        if (!classItem?.publicId) return;
        setLessonContentLoading(true);
        try {
            const [contentResult, assessmentResult, languageResult] = await Promise.all([
                adminModulesApi.classContent(classItem.publicId),
                adminModulesApi.classAssessments(classItem.publicId).catch(() => []),
                adminModulesApi.judgeLanguages().catch(() => [])
            ]);
            const assessmentSummaries = toItems(assessmentResult);
            const assessmentDetailResults = await Promise.allSettled(
                assessmentSummaries.map((assessment) => adminModulesApi.learningAssessmentDetail(assessment.publicId))
            );
            const assessments = assessmentSummaries.map((assessment, index) =>
                assessmentDetailResults[index]?.status === 'fulfilled'
                    ? assessmentDetailResults[index].value
                    : assessment
            );
            if (assessmentDetailResults.some((result) => result.status === 'rejected')) {
                toast.error('Một số bài đánh giá chưa tải được chi tiết câu hỏi');
            }
            let sections = toItems(contentResult).map(normalizeLearningSection);
            if (!sections.length && [userRoles.DEPARTMENT_HEAD, userRoles.LECTURER].includes(user?.role)) {
                const createdSection = await adminModulesApi.createLearningSection({
                    classPublicId: classItem.publicId,
                    title: 'Chương 1',
                    sortOrder: 1
                });
                sections = [normalizeLearningSection({ ...createdSection, lessons: [] })];
            }
            const assessmentContentItems = assessments.map(normalizeAssessmentContentItem);
            if (sections.length && assessmentContentItems.length) {
                const existingIds = new Set(sections.flatMap((section) => section.lessons.map((lesson) => lesson.assessmentPublicId ?? lesson.publicId ?? lesson.id)));
                const nextAssessmentItems = assessmentContentItems.filter((assessment) => !existingIds.has(assessment.assessmentPublicId));
                if (nextAssessmentItems.length) {
                    sections = sections.map((section, index) => index === 0
                        ? { ...section, lessons: [...section.lessons, ...nextAssessmentItems] }
                        : section);
                }
            }
            setLessonSectionsByClass((current) => ({
                ...current,
                [classItem.publicId]: sections
            }));
            setGradedAssessmentsByClass((current) => ({
                ...current,
                [classItem.publicId]: assessments
            }));
            setJudgeLanguages(toItems(languageResult));
            if (sections[0]?.id) setSelectedLessonSectionId((current) => sections.some((section) => section.id === current) ? current : sections[0].id);
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được nội dung bài học từ BE'));
        } finally {
            setLessonContentLoading(false);
        }
    }, [user]);

    const loadClassWorkspaceOperations = useCallback(async (classItem) => {
        if (!classItem?.publicId) return;
        setWorkspaceOperationsLoading(true);
        try {
            const [gradebookResult, assessmentResult] = await Promise.all([
                adminModulesApi.classGradebook(classItem.publicId).catch(() => null),
                adminModulesApi.classAssessments(classItem.publicId).catch(() => [])
            ]);
            const assessments = toItems(assessmentResult);
            const attemptResults = await Promise.allSettled(assessments.map((assessment) => adminModulesApi.assessmentAttempts(assessment.publicId)));
            const attempts = attemptResults.flatMap((result, index) => result.status === 'fulfilled'
                ? toItems(result.value).map((attempt) => ({ ...attempt, assessment: assessments[index] }))
                : []);
            setGradedAssessmentsByClass((current) => ({ ...current, [classItem.publicId]: assessments }));
            setWorkspaceGradebooks((current) => ({ ...current, [classItem.publicId]: gradebookResult }));
            setWorkspaceAttempts((current) => ({ ...current, [classItem.publicId]: attempts }));
        } finally {
            setWorkspaceOperationsLoading(false);
        }
    }, []);

    useEffect(() => {
        const task = window.setTimeout(() => {
            loadData();
        }, 0);

        return () => window.clearTimeout(task);
    }, [loadData]);

    useEffect(() => {
        if (classWorkspaceTab !== 'learningModules') return;
        const task = window.setTimeout(() => {
            loadPdfMediaItems();
            if (workspaceClass) loadClassLessonSections(workspaceClass);
        }, 0);
        return () => window.clearTimeout(task);
    }, [classWorkspaceTab, loadClassLessonSections, loadPdfMediaItems, workspaceClass]);

    useEffect(() => {
        if (!workspaceClass || user?.role !== userRoles.LECTURER) return undefined;
        const task = window.setTimeout(() => loadClassWorkspaceOperations(workspaceClass), 0);
        return () => window.clearTimeout(task);
    }, [loadClassWorkspaceOperations, user?.role, workspaceClass]);

    useEffect(() => {
        Object.values(lessonSectionsByClass).forEach((sections) => {
            sections.forEach((section) => {
                section.lessons?.forEach((lesson) => {
                    if (lesson.type === 'PDF' && lesson.mediaPublicId) {
                        loadPdfPreviewUrl(lesson.mediaPublicId);
                    }
                });
            });
        });
    }, [lessonSectionsByClass, loadPdfPreviewUrl]);

    useEffect(() => () => {
        Object.values(pdfPreviewUrlRef.current).forEach((url) => URL.revokeObjectURL(url));
    }, []);

    const createDepartment = async (event) => {
        event.preventDefault();
        try {
            await adminModulesApi.createDepartment({
                code: departmentForm.code,
                name: departmentForm.name,
                description: departmentForm.description || undefined
            });
            toast.success('Đã tạo bộ môn/phòng ban');
            setDepartmentForm(emptyForm);
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tạo được bộ môn'));
        }
    };

    const updateSubjectProposalForm = (field, value) => {
        const numericFields = ['credits', 'assignmentWeight', 'quizWeight', 'midtermWeight', 'finalWeight', 'passScore'];
        setSubjectProposalForm((current) => ({
            ...current,
            [field]: numericFields.includes(field) ? Number(value) : value
        }));
    };

    const saveSubjectProposal = async (event) => {
        event.preventDefault();
        const payload = normalizeSubjectProposalForm(subjectProposalForm);
        const totalWeight =
            payload.assignmentWeight +
            payload.quizWeight +
            payload.midtermWeight +
            payload.finalWeight;

        if (totalWeight !== 100) {
            toast.error('Tổng tỷ lệ điểm phải bằng 100%');
            return;
        }

        try {
            if (editingSubjectProposal) {
                await adminModulesApi.updateSubjectProposal(editingSubjectProposal.publicId, payload);
                toast.success('Đã cập nhật đề xuất môn học');
            } else {
                await adminModulesApi.createSubjectProposal(payload);
                toast.success('Đã tạo đề xuất môn học ở trạng thái nháp');
            }
            setSubjectProposalForm(emptySubjectProposalForm);
            setEditingSubjectProposal(null);
            setSubjectProposalModalOpen(false);
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, editingSubjectProposal ? 'Không cập nhật được đề xuất môn học' : 'Không tạo được đề xuất môn học'));
        }
    };

    const getRejectedSubjectProposal = (subject) =>
        data.subjectProposals.find((proposal) => proposal.status === 'REJECTED' && (proposal.code === subject.code || proposal.subject?.publicId === subject.publicId));

    const viewSubjectClasses = (subject) => {
        const targetTab = subject.status === 'ARCHIVE' ? 'COMPLETED' : 'ACTIVE';
        navigate(`/classes?subjectPublicId=${encodeURIComponent(subject.publicId)}&classTab=${targetTab}`);
    };

    const updateClassListTab = (tab) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set('classTab', tab);
            return next;
        });
    };

    const clearClassSubjectFilter = () => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.delete('subjectPublicId');
            return next;
        });
    };

    const updateSubjectFilter = (patch) => {
        setSubjectFilters((current) => ({
            ...current,
            ...patch,
            page: patch.page ?? 1
        }));
    };

    const exportSubjects = () => {
        if (!filteredSubjects.length) {
            toast.error('Không có dữ liệu môn học để xuất');
            return;
        }

        const today = new Intl.DateTimeFormat('en-CA').format(new Date());
        const rows = [
            [
                'Mã môn',
                'Tên môn',
                'Bộ môn',
                'Số tín chỉ',
                'Số lượng lớp',
                'Trạng thái',
                'Điểm đạt',
                'Bài tập %',
                'Kiểm tra %',
                'Giữa kỳ %',
                'Cuối kỳ %',
                'Ngày tạo',
                'Cập nhật gần nhất',
                'Mô tả'
            ],
            ...filteredSubjects.map((subject) => [
                subject.code,
                subject.name,
                subject.department?.name ?? '',
                subject.credits,
                subjectClassCounts.get(subject.publicId) ?? 0,
                subjectStatusLabels[subject.status] ?? subject.status,
                formatDecimal(subject.passScore),
                formatDecimal(subject.assignmentWeight),
                formatDecimal(subject.quizWeight),
                formatDecimal(subject.midtermWeight),
                formatDecimal(subject.finalWeight),
                formatDateTime(subject.createdAt),
                formatDateTime(subject.updatedAt),
                subject.description ?? ''
            ])
        ];

        downloadCsvFile(`danh-sach-mon-hoc-${today}.csv`, rows);
        toast.success(`Đã xuất ${filteredSubjects.length} môn học`);
    };

    const openCreateSubjectProposal = () => {
        setSubjectProposalForm(emptySubjectProposalForm);
        setEditingSubjectProposal(null);
        setSubjectProposalModalOpen(true);
    };

    const openEditSubjectProposal = (proposal) => {
        setSubjectProposalForm(normalizeSubjectProposalForm(proposal));
        setEditingSubjectProposal(proposal);
        setSelectedSubjectProposal(null);
        setSubjectProposalModalOpen(true);
    };

    const closeSubjectProposalModal = () => {
        setSubjectProposalForm(emptySubjectProposalForm);
        setEditingSubjectProposal(null);
        setSubjectProposalModalOpen(false);
    };

    const deleteSubject = async (subject) => {
        const confirmed = window.confirm(`Xóa môn học ${subject.code} - ${subject.name}? Nếu BE không cho xóa do đã có dữ liệu, hệ thống sẽ chuyển sang cập nhật trạng thái theo quy định BE.`);
        if (!confirmed) return;
        try {
            const result = await adminModulesApi.deleteSubject(subject.publicId);
            toast.success(result?.message ?? 'Đã xóa môn học');
            if (selectedSubject?.publicId === subject.publicId) setSelectedSubject(null);
            loadData();
        } catch (error) {
            const deleteMessage = getApiMessage(error, 'Không xóa được môn học');
            const shouldArchive = /dữ liệu|du lieu|lớp|lop|class|phát sinh|phat sinh|đã có|da co/i.test(deleteMessage);

            if (!shouldArchive) {
                toast.error(deleteMessage);
                return;
            }

            try {
                await adminModulesApi.updateSubjectStatus(subject.publicId, 'ARCHIVE');
                toast.success('Môn học đã có dữ liệu nên không xóa vĩnh viễn. Đã cập nhật trạng thái thành Đã lưu trữ.');
                if (selectedSubject?.publicId === subject.publicId) setSelectedSubject(null);
                loadData();
            } catch (archiveError) {
                toast.error(getApiMessage(archiveError, deleteMessage));
            }
        }
    };

    const archiveSubject = async (subject) => {
        const subjectClasses = subjectClassesByPublicId.get(subject.publicId) ?? [];
        if (!subjectClasses.length || subjectClasses.some((classItem) => classItem.status !== 'COMPLETED')) {
            toast.error('Chỉ có thể lưu trữ môn khi môn đã có lớp và tất cả lớp đều hoàn thành');
            return;
        }

        const confirmed = window.confirm(`Lưu trữ môn ${subject.code} - ${subject.name}? Môn sẽ ngừng công khai cho đến khi Hiệu trưởng duyệt yêu cầu khôi phục.`);
        if (!confirmed) return;

        try {
            await adminModulesApi.updateSubjectStatus(subject.publicId, 'ARCHIVE');
            toast.success('Đã chuyển môn học sang trạng thái lưu trữ');
            if (selectedSubject?.publicId === subject.publicId) setSelectedSubject(null);
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể lưu trữ môn học'));
        }
    };

    const openSubjectRestoreRequest = (subject) => {
        setSelectedSubject(null);
        setRestoreSubject(subject);
        setRestoreReason('');
    };

    const closeSubjectRestoreRequest = () => {
        setRestoreSubject(null);
        setRestoreReason('');
        setRestoreSubmitting(false);
    };

    const submitSubjectRestoreRequest = async (event) => {
        event.preventDefault();
        if (!restoreSubject) return;

        setRestoreSubmitting(true);
        try {
            await adminModulesApi.createSubjectRestoreRequest(restoreSubject.publicId, {
                reason: restoreReason.trim() || undefined
            });
            toast.success('Đã gửi yêu cầu khôi phục môn lên Hiệu trưởng');
            closeSubjectRestoreRequest();
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể gửi yêu cầu khôi phục môn'));
            setRestoreSubmitting(false);
        }
    };

    const openRestoreRequestReview = (request) => {
        setSelectedRestoreRequest(request);
        setRestoreReviewReason('');
    };

    const closeRestoreRequestReview = () => {
        setSelectedRestoreRequest(null);
        setRestoreReviewReason('');
        setRestoreSubmitting(false);
    };

    const reviewSubjectRestoreRequest = async (approved) => {
        if (!selectedRestoreRequest) return;
        if (!approved && !restoreReviewReason.trim()) {
            toast.error('Vui lòng nhập lý do từ chối');
            return;
        }

        setRestoreSubmitting(true);
        try {
            await adminModulesApi.reviewSubjectRestoreRequest(selectedRestoreRequest.publicId, {
                approved,
                reason: restoreReviewReason.trim() || undefined
            });
            toast.success(approved ? 'Đã khôi phục và công khai môn học' : 'Đã từ chối yêu cầu khôi phục môn');
            closeRestoreRequestReview();
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể xử lý yêu cầu khôi phục môn'));
            setRestoreSubmitting(false);
        }
    };

    const updateClassDraft = (publicId, patch) => {
        setClassDrafts((current) => ({
            ...current,
            [publicId]: { ...(current[publicId] ?? {}), ...patch }
        }));
    };

    const closeClassActionModal = () => {
        setSelectedClassAction(null);
        setClassActionMode('detail');
        setClassWorkspaceTab('overview');
    };

    const openClassAction = (classItem, mode) => {
        setSelectedClassAction(classItem);
        setClassActionMode(mode);
        setClassWorkspaceTab('overview');
        setClassDrafts((current) => ({
            ...current,
            [classItem.publicId]: {
                lecturerPublicId: classItem.lecturer?.publicId ?? '',
                registrationStart: toDateTimeInput(classItem.registrationStart),
                registrationEnd: toDateTimeInput(classItem.registrationEnd),
                status: classItem.status ?? '',
                ...(current[classItem.publicId] ?? {})
            }
        }));
    };

    const handleClassAction = (event, classItem) => {
        const action = event.target.value;
        event.target.value = '';
        if (action === 'detail') {
            navigate(`/classes/${classItem.publicId}`);
            return;
        }
        if (action) openClassAction(classItem, action);
    };

    const assignClassLecturer = async (classItem, lecturerPublicId) => {
        try {
            await adminModulesApi.updateClass(classItem.publicId, { lecturerPublicId });
            toast.success('Đã phân công giảng viên cho lớp');
            if (selectedClassAction?.publicId === classItem.publicId) closeClassActionModal();
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không phân công được giảng viên'));
        }
    };

    const saveClassRegistration = async (classItem) => {
        const draft = classDrafts[classItem.publicId] ?? {};
        try {
            await adminModulesApi.updateClass(classItem.publicId, {
                registrationStart: draft.registrationStart ?? toDateTimeInput(classItem.registrationStart),
                registrationEnd: draft.registrationEnd ?? toDateTimeInput(classItem.registrationEnd),
                status: draft.status ?? classItem.status
            });
            toast.success('Đã thiết lập thời gian đăng ký và trạng thái lớp');
            if (selectedClassAction?.publicId === classItem.publicId) closeClassActionModal();
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không cập nhật được thời gian đăng ký lớp'));
        }
    };

    const updateClassProposalForm = (field, value) => {
        const numericFields = ['requestedClassCount', 'maxStudentsPerClass'];
        setClassProposalForm((current) => ({
            ...current,
            [field]: numericFields.includes(field) ? Number(value) : value
        }));
    };

    const openClassProposalForSubject = (subject) => {
        setEditingClassProposal(null);
        setClassProposalForm({
            ...emptyClassProposalForm,
            subjectPublicId: subject.publicId
        });
        setClassProposalModalOpen(true);
    };

    const openReproposeClassProposal = (proposal) => {
        setEditingClassProposal(proposal);
        setSelectedClassProposal(null);
        setClassProposalForm({
            subjectPublicId: proposal.subject?.publicId ?? proposal.subjectPublicId ?? '',
            requestedClassCount: proposal.requestedClassCount ?? emptyClassProposalForm.requestedClassCount,
            maxStudentsPerClass: proposal.maxStudentsPerClass ?? emptyClassProposalForm.maxStudentsPerClass,
            registrationStart: toDateTimeInput(proposal.registrationStart),
            registrationEnd: toDateTimeInput(proposal.registrationEnd),
            note: proposal.note ?? ''
        });
        setClassProposalModalOpen(true);
    };

    const createClassProposal = async (event) => {
        event.preventDefault();
        try {
            await adminModulesApi.createClassProposal({
                subjectPublicId: classProposalForm.subjectPublicId,
                requestedClassCount: classProposalForm.requestedClassCount,
                maxStudentsPerClass: classProposalForm.maxStudentsPerClass,
                registrationStart: classProposalForm.registrationStart,
                registrationEnd: classProposalForm.registrationEnd,
                note: classProposalForm.note || undefined
            });
            toast.success(editingClassProposal ? 'Đã gửi lại đề xuất lớp và chờ Phòng đào tạo duyệt' : 'Đã tạo đề xuất số lượng lớp và chờ Phòng đào tạo duyệt');
            setClassProposalForm(emptyClassProposalForm);
            setEditingClassProposal(null);
            setClassProposalModalOpen(false);
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, editingClassProposal ? 'Không gửi lại được đề xuất lớp' : 'Không gửi được đề xuất số lượng lớp'));
        }
    };

    const submitSubjectProposal = async (proposal) => {
        try {
            await adminModulesApi.submitSubjectProposal(proposal.publicId);
            toast.success('Đã gửi đề xuất môn học cho Phòng đào tạo');
            if (selectedSubjectProposal?.publicId === proposal.publicId) setSelectedSubjectProposal(null);
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không gửi duyệt được đề xuất môn học'));
        }
    };

    const deleteSubjectProposal = async (proposal) => {
        const confirmed = window.confirm(`Xóa đề xuất môn ${proposal.code} - ${proposal.name}?`);
        if (!confirmed) return;

        try {
            await adminModulesApi.deleteSubjectProposal(proposal.publicId);
            toast.success('Đã xóa đề xuất môn học');
            if (selectedSubjectProposal?.publicId === proposal.publicId) setSelectedSubjectProposal(null);
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không xóa được đề xuất môn học'));
        }
    };

    const resubmitSubjectProposal = async (proposal) => {
        try {
            await adminModulesApi.resubmitSubjectProposal(proposal.publicId);
            toast.success('Đã chuyển đề xuất bị từ chối về trạng thái nháp');
            if (selectedSubjectProposal?.publicId === proposal.publicId) setSelectedSubjectProposal(null);
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không đề xuất lại được môn học'));
        }
    };

    const reviewClassProposal = async (proposal, approved) => {
        const reason = reviewDrafts[proposal.publicId]?.reason ?? '';
        if (!approved && !reason.trim()) {
            toast.error('Vui lòng nhập lý do khi từ chối đề xuất lớp');
            return;
        }

        try {
            await adminModulesApi.reviewClassProposal(proposal.publicId, {
                approved,
                reason: reason.trim() || undefined
            });
            toast.success(approved ? 'Đã phê duyệt đề xuất mở lớp' : 'Đã từ chối đề xuất mở lớp');
            updateReviewDraft(proposal.publicId, { reason: '' });
            if (selectedClassProposal?.publicId === proposal.publicId) setSelectedClassProposal(null);
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không xử lý được đề xuất mở lớp'));
        }
    };

    const generateClassesFromProposal = async (proposal) => {
        try {
            await adminModulesApi.generateClassesFromProposal(proposal.publicId);
            toast.success('Đã tự sinh lớp theo số lớp dự kiến');
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, 'BE chưa hỗ trợ hoặc không tự sinh được lớp từ đề xuất'));
        }
    };

    const updateReviewDraft = (publicId, patch) => {
        setReviewDrafts((current) => ({
            ...current,
            [publicId]: { ...(current[publicId] ?? { reason: '' }), ...patch }
        }));
    };

    const reviewSubjectProposal = async (proposal, approved, stage) => {
        const reason = reviewDrafts[proposal.publicId]?.reason ?? '';
        if (!approved && !reason.trim()) {
            toast.error('Vui lòng nhập lý do khi từ chối đề xuất');
            return;
        }

        try {
            const payload = { approved, reason: reason.trim() || undefined };
            if (stage === 'training') {
                await adminModulesApi.trainingReviewSubject(proposal.publicId, payload);
                toast.success(approved ? 'Đã chuyển đề xuất lên Hiệu trưởng' : 'Đã từ chối đề xuất môn học');
            } else {
                await adminModulesApi.principalReviewSubject(proposal.publicId, payload);
                toast.success(approved ? 'Đã phê duyệt môn học mới' : 'Đã từ chối đề xuất môn học');
            }
            updateReviewDraft(proposal.publicId, { reason: '' });
            if (selectedSubjectProposal?.publicId === proposal.publicId) setSelectedSubjectProposal(null);
            loadData();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không xử lý được đề xuất môn học'));
        }
    };

    const canCreateSubjectProposal = user?.role === userRoles.DEPARTMENT_HEAD;
    const canCreateClassProposal = user?.role === userRoles.DEPARTMENT_HEAD;
    const canReviewClassProposal = user?.role === userRoles.TRAINING_OFFICER;
    const canGenerateClasses = user?.role === userRoles.DEPARTMENT_HEAD;
    const canAssignLecturer = user?.role === userRoles.DEPARTMENT_HEAD;
    const canConfigureClassRegistration = user?.role === userRoles.DEPARTMENT_HEAD || user?.role === userRoles.LECTURER;
    const legacyCombinedApprovalsEnabled = false;
    const getAssignableLecturers = (classItem) =>
        data.lecturers.filter((lecturer) => !classItem.department?.publicId || !lecturer.department?.publicId || lecturer.department.publicId === classItem.department.publicId);
    const hasGeneratedClasses = (proposal) => Number(proposal?._count?.classes ?? 0) > 0;
    const canReproposeClassProposal = (proposal) =>
        user?.role === userRoles.DEPARTMENT_HEAD &&
        isOwnProposal(proposal) &&
        proposal.status === 'REJECTED';

    const getSubjectProposalStatus = (proposal) => String(proposal?.status ?? '').toUpperCase();
    const canManageOwnSubjectProposal = (proposal) => user?.role === userRoles.DEPARTMENT_HEAD && isOwnProposal(proposal);

    const canSubmitSubjectProposal = (proposal) =>
        getSubjectProposalStatus(proposal) === 'DRAFT' &&
        canManageOwnSubjectProposal(proposal);

    const canEditSubjectProposal = (proposal) =>
        getSubjectProposalStatus(proposal) === 'DRAFT' &&
        canManageOwnSubjectProposal(proposal);

    const canDeleteSubjectProposal = (proposal) =>
        getSubjectProposalStatus(proposal) === 'DRAFT' &&
        canManageOwnSubjectProposal(proposal);

    const canResubmitSubjectProposal = (proposal) =>
        getSubjectProposalStatus(proposal) === 'REJECTED' &&
        canManageOwnSubjectProposal(proposal);

    const canTrainingReviewSubject = (proposal) =>
        (user?.role === userRoles.ADMIN || user?.role === userRoles.TRAINING_OFFICER) && proposal.status === 'PENDING_TRAINING';

    const canPrincipalReviewSubject = (proposal) =>
        (user?.role === userRoles.ADMIN || user?.role === userRoles.PRINCIPAL) && proposal.status === 'PENDING_PRINCIPAL';

    const subjectProposalTotalWeight =
        toNumberOrDefault(subjectProposalForm.assignmentWeight, 0) +
        toNumberOrDefault(subjectProposalForm.quizWeight, 0) +
        toNumberOrDefault(subjectProposalForm.midtermWeight, 0) +
        toNumberOrDefault(subjectProposalForm.finalWeight, 0);

    const renderSubjectProposalActions = (proposal, options = {}) => {
        const showReview = canTrainingReviewSubject(proposal) || canPrincipalReviewSubject(proposal);
        const stage = canTrainingReviewSubject(proposal) ? 'training' : 'principal';
        const isDetailLayout = options.layout === 'detail';
        const actionClass = (baseClass) => `${baseClass} ${isDetailLayout ? styles.detailActionButton : styles.actionIconButton}`;

        return (
            <div className={isDetailLayout ? styles.proposalDetailActions : styles.proposalActions}>
                {canEditSubjectProposal(proposal) ? (
                    <button className={actionClass(ui.secondaryButton)} type="button" onClick={() => openEditSubjectProposal(proposal)} aria-label="Sửa đề xuất" title="Sửa đề xuất">
                        <FiEdit2 /> {isDetailLayout ? 'Chỉnh sửa bản nháp' : null}
                    </button>
                ) : null}
                {canSubmitSubjectProposal(proposal) ? (
                    <button className={actionClass(ui.primaryButton)} type="button" onClick={() => submitSubjectProposal(proposal)} aria-label="Gửi Phòng đào tạo duyệt" title="Gửi Phòng đào tạo duyệt">
                        <FiSend /> {isDetailLayout ? 'Gửi duyệt' : null}
                    </button>
                ) : null}
                {canDeleteSubjectProposal(proposal) ? (
                    <button className={actionClass(`${ui.secondaryButton} ${ui.dangerButton}`)} type="button" onClick={() => deleteSubjectProposal(proposal)} aria-label="Xóa đề xuất" title="Xóa đề xuất">
                        <FiXCircle /> {isDetailLayout ? 'Xóa đề xuất' : null}
                    </button>
                ) : null}
                {showReview ? (
                    <div className={isDetailLayout ? styles.proposalReviewBlock : styles.proposalReviewInline}>
                        <label className={ui.field}>
                            Ghi chú/Lý do từ chối
                            <textarea
                                className={styles.textarea}
                                value={reviewDrafts[proposal.publicId]?.reason ?? ''}
                                onChange={(event) => updateReviewDraft(proposal.publicId, { reason: event.target.value })}
                                placeholder="Nhập ghi chú khi duyệt hoặc lý do khi từ chối..."
                            />
                        </label>
                        <div className={styles.proposalActions}>
                            <button
                                className={actionClass(ui.primaryButton)}
                                type="button"
                                onClick={() => reviewSubjectProposal(proposal, true, stage)}
                                aria-label={stage === 'training' ? 'Duyệt và chuyển Hiệu trưởng' : 'Phê duyệt môn học'}
                                title={stage === 'training' ? 'Duyệt và chuyển Hiệu trưởng' : 'Phê duyệt môn học'}
                            >
                                <FiCheck /> {isDetailLayout ? (stage === 'training' ? 'Duyệt & chuyển Hiệu trưởng' : 'Phê duyệt môn') : null}
                            </button>
                            <button className={actionClass(`${ui.secondaryButton} ${ui.dangerButton}`)} type="button" onClick={() => reviewSubjectProposal(proposal, false, stage)} aria-label="Từ chối" title="Từ chối">
                                <FiXCircle /> {isDetailLayout ? 'Từ chối' : null}
                            </button>
                        </div>
                    </div>
                ) : null}
                {canResubmitSubjectProposal(proposal) ? (
                    <button className={actionClass(ui.primaryButton)} type="button" onClick={() => resubmitSubjectProposal(proposal)} aria-label="Đề xuất môn lại" title="Đề xuất môn lại">
                        <FiRefreshCcw /> {isDetailLayout ? 'Gửi lại đề xuất' : null}
                    </button>
                ) : null}
            </div>
        );
    };

    const renderSubjectActions = (subject) => {
        const subjectClasses = subjectClassesByPublicId.get(subject.publicId) ?? [];
        const hasClasses = subjectClasses.length > 0;
        const allClassesCompleted = hasClasses && subjectClasses.every((classItem) => classItem.status === 'COMPLETED');
        const pendingRestoreRequest = pendingRestoreRequestBySubjectPublicId.get(subject.publicId);
        const canArchive = currentUserRole === userRoles.TRAINING_OFFICER && subject.status === 'PUBLIC' && allClassesCompleted;
        const canDelete = currentUserRole === userRoles.TRAINING_OFFICER && !hasClasses;
        const canRequestRestore = currentUserRole === userRoles.TRAINING_OFFICER && subject.status === 'ARCHIVE' && !pendingRestoreRequest;

        return (
            <div className={styles.inlineActions}>
                {hasClasses ? (
                    <button className={ui.secondaryButton} type="button" onClick={(event) => { event.stopPropagation(); viewSubjectClasses(subject); }}>
                        Xem danh sách lớp
                    </button>
                ) : null}
                {canArchive ? (
                    <button className={ui.secondaryButton} type="button" onClick={(event) => { event.stopPropagation(); archiveSubject(subject); }}>
                        <FiArchive /> Lưu trữ môn
                    </button>
                ) : null}
                {canRequestRestore ? (
                    <button className={ui.primaryButton} type="button" onClick={(event) => { event.stopPropagation(); openSubjectRestoreRequest(subject); }}>
                        <FiRefreshCcw /> Đề nghị khôi phục
                    </button>
                ) : null}
                {pendingRestoreRequest ? (
                    <StatusPill value={restoreRequestStatusLabels[pendingRestoreRequest.status]} status={pendingRestoreRequest.status} />
                ) : null}
                {canDelete ? (
                    <button className={`${ui.secondaryButton} ${ui.dangerButton}`} type="button" onClick={(event) => { event.stopPropagation(); deleteSubject(subject); }}>
                        Xóa
                    </button>
                ) : null}
            </div>
        );
    };

    const handleSubjectProposalAction = (event, proposal) => {
        event.stopPropagation();
        const action = event.target.value;
        event.target.value = '';

        if (action === 'detail') setSelectedSubjectProposal(proposal);
        if (action === 'edit') openEditSubjectProposal(proposal);
        if (action === 'submit') submitSubjectProposal(proposal);
        if (action === 'delete') deleteSubjectProposal(proposal);
        if (action === 'repropose') resubmitSubjectProposal(proposal);
    };

    const renderSubjectProposalActionDropdown = (proposal) => (
        <select
            className={styles.actionDropdown}
            defaultValue=""
            onChange={(event) => handleSubjectProposalAction(event, proposal)}
            onClick={(event) => event.stopPropagation()}
            aria-label="Chọn thao tác đề xuất môn"
        >
            <option value="" disabled>
                Thao tác
            </option>
            <option value="detail">Xem chi tiết</option>
            <option value="edit" disabled={!canEditSubjectProposal(proposal)}>Chỉnh sửa</option>
            <option value="submit" disabled={!canSubmitSubjectProposal(proposal)}>Gửi đề xuất</option>
            <option value="delete" disabled={!canDeleteSubjectProposal(proposal)}>Xóa</option>
            <option value="repropose" disabled={!canResubmitSubjectProposal(proposal)}>Đề xuất môn lại</option>
        </select>
    );

    const handleClassProposalAction = (event, proposal) => {
        event.stopPropagation();
        const action = event.target.value;
        event.target.value = '';

        if (action === 'detail') setSelectedClassProposal(proposal);
        if (action === 'repropose') openReproposeClassProposal(proposal);
    };

    const renderClassProposalActionDropdown = (proposal) => (
        <select
            className={styles.actionDropdown}
            defaultValue=""
            onChange={(event) => handleClassProposalAction(event, proposal)}
            onClick={(event) => event.stopPropagation()}
            aria-label="Chọn thao tác đề xuất lớp"
        >
            <option value="" disabled>
                Thao tác
            </option>
            <option value="detail">Xem chi tiết</option>
            <option value="repropose" disabled={!canReproposeClassProposal(proposal)}>Đề xuất lại</option>
        </select>
    );

    const renderClassProposalActions = (proposal, options = {}) => {
        const isDetailLayout = options.layout === 'detail';

        if (canReviewClassProposal && proposal.status === 'PENDING') {
            return (
                <div className={isDetailLayout ? styles.proposalReviewBlock : styles.proposalReviewInline}>
                    <label className={ui.field}>
                        Ghi chú/Lý do từ chối
                        <textarea
                            className={styles.textarea}
                            value={reviewDrafts[proposal.publicId]?.reason ?? ''}
                            onChange={(event) => updateReviewDraft(proposal.publicId, { reason: event.target.value })}
                            placeholder="Nhập ghi chú khi duyệt hoặc lý do khi từ chối..."
                        />
                    </label>
                    <div className={styles.proposalActions}>
                        <button
                            className={`${ui.primaryButton} ${isDetailLayout ? styles.detailActionButton : styles.actionIconButton}`}
                            type="button"
                            onClick={() => reviewClassProposal(proposal, true)}
                            aria-label="Phê duyệt đề xuất lớp"
                            title="Phê duyệt đề xuất lớp"
                        >
                            <FiCheck /> {isDetailLayout ? 'Phê duyệt đề xuất lớp' : null}
                        </button>
                        <button
                            className={`${ui.secondaryButton} ${ui.dangerButton} ${isDetailLayout ? styles.detailActionButton : styles.actionIconButton}`}
                            type="button"
                            onClick={() => reviewClassProposal(proposal, false)}
                            aria-label="Từ chối"
                            title="Từ chối"
                        >
                            <FiXCircle /> {isDetailLayout ? 'Từ chối' : null}
                        </button>
                    </div>
                </div>
            );
        }

        if (canGenerateClasses && proposal.status === 'APPROVED' && !hasGeneratedClasses(proposal)) {
            return (
                <button className={ui.primaryButton} type="button" onClick={() => generateClassesFromProposal(proposal)}>
                    Tự sinh lớp theo số lớp dự kiến
                </button>
            );
        }

        if (canReproposeClassProposal(proposal)) {
            return (
                <button className={ui.primaryButton} type="button" onClick={() => openReproposeClassProposal(proposal)}>
                    Đề xuất lại
                </button>
            );
        }

        return <span>-</span>;
    };

    const getLessonSections = (classItem) => lessonSectionsByClass[classItem.publicId] ?? createDefaultLessonSections();

    const updateLessonSections = (classItem, updater) => {
        setLessonSectionsByClass((current) => {
            const currentSections = current[classItem.publicId] ?? createDefaultLessonSections();
            return {
                ...current,
                [classItem.publicId]: updater(currentSections)
            };
        });
    };

    const addLessonSection = async (classItem) => {
        const currentSections = getLessonSections(classItem);
        const nextIndex = currentSections.length + 1;
        try {
            const createdSection = await adminModulesApi.createLearningSection({
                classPublicId: classItem.publicId,
                title: `Chương ${nextIndex}`,
                sortOrder: nextIndex
            });
            const nextSection = normalizeLearningSection({ ...createdSection, lessons: [] });
            updateLessonSections(classItem, (sections) => [...sections, nextSection]);
            setSelectedLessonSectionId(nextSection.id);
            toast.success('Đã tạo chương trên hệ thống');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tạo được chương'));
        }
    };

    const renameLessonSection = async (classItem, section) => {
        const nextTitle = window.prompt('Nhập tên chương mới', section.title);
        if (!nextTitle?.trim()) return;
        if (!section.publicId) return;
        try {
            const updatedSection = await adminModulesApi.updateLearningSection(section.publicId, { title: nextTitle.trim() });
            updateLessonSections(classItem, (sections) =>
                sections.map((item) => item.id === section.id ? { ...item, ...normalizeLearningSection({ ...updatedSection, lessons: item.lessons }) } : item)
            );
            toast.success('Đã đổi tên chương');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không đổi tên được chương'));
        }
    };

    const buildReorderPayload = (sections) => ({
        sections: sections
            .filter((section) => section.publicId && !section.isDraft)
            .map((section, sectionIndex) => ({
                publicId: section.publicId,
                sortOrder: sectionIndex + 1,
                lessons: (section.lessons ?? [])
                    .filter((lesson) => lesson.publicId && !lesson.isDraft && !lesson.isGradedAssessment)
                    .map((lesson, lessonIndex) => ({
                        publicId: lesson.publicId,
                        sortOrder: lessonIndex + 1
                    }))
            }))
    });

    const mergeReorderedLearningContent = (updatedContent, nextSections) => {
        const normalizedSections = toItems(updatedContent).map(normalizeLearningSection);
        const sectionsById = new Map(normalizedSections.map((section) => [section.publicId, section]));

        return nextSections.map((section) => {
            const updatedSection = sectionsById.get(section.publicId);
            if (!updatedSection) return section;

            const updatedLessonsById = new Map(updatedSection.lessons.map((lesson) => [lesson.publicId, lesson]));
            const mergedLessons = section.lessons
                .map((lesson) => {
                    if (lesson.isGradedAssessment) return lesson;
                    return updatedLessonsById.get(lesson.publicId) ?? lesson;
                })
                .filter(Boolean);
            const mergedLessonIds = new Set(mergedLessons.map((lesson) => lesson.publicId));
            const missingLessons = updatedSection.lessons.filter((lesson) => !mergedLessonIds.has(lesson.publicId));

            return {
                ...updatedSection,
                lessons: [...mergedLessons, ...missingLessons]
            };
        });
    };

    const applyReorderedSections = async (classItem, nextSections) => {
        updateLessonSections(classItem, () => nextSections);
        try {
            const updatedContent = await adminModulesApi.reorderLearningContent(classItem.publicId, buildReorderPayload(nextSections));
            setLessonSectionsByClass((current) => ({
                ...current,
                [classItem.publicId]: mergeReorderedLearningContent(updatedContent, nextSections)
            }));
        } catch (error) {
            toast.error(getApiMessage(error, 'Không lưu được thứ tự chương/bài học'));
            loadClassLessonSections(classItem);
        }
    };

    const reorderLessonSections = (classItem, sourceSectionId, targetSectionId) => {
        if (!sourceSectionId || sourceSectionId === targetSectionId) return;
        const sections = getLessonSections(classItem);
        const currentIndex = sections.findIndex((item) => item.id === sourceSectionId);
        const nextIndex = sections.findIndex((item) => item.id === targetSectionId);
        if (currentIndex < 0 || nextIndex < 0) return;
        const nextSections = [...sections];
        const [movedSection] = nextSections.splice(currentIndex, 1);
        nextSections.splice(nextIndex, 0, movedSection);
        applyReorderedSections(classItem, nextSections);
    };

    const toggleLessonSectionVisibility = async (classItem, sectionId) => {
        const section = getLessonSections(classItem).find((item) => item.id === sectionId);
        if (!section?.publicId) return;
        try {
            const updatedSection = await adminModulesApi.updateLearningSection(section.publicId, { isPublished: !section.isPublished });
            updateLessonSections(classItem, (sections) =>
                sections.map((item) => item.id === sectionId ? { ...item, isPublished: updatedSection.isPublished ?? !section.isPublished } : item)
            );
            toast.success(updatedSection.isPublished ? 'Đã công khai chương' : 'Đã ẩn chương');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không cập nhật trạng thái chương'));
        }
    };

    const removeLessonSection = async (classItem, section) => {
        if (!section?.publicId) return;
        if (!window.confirm(`Xóa ${section.title} và toàn bộ bài học trong chương này?`)) return;
        try {
            await adminModulesApi.deleteLearningSection(section.publicId);
            updateLessonSections(classItem, (sections) => {
                const nextSections = sections.filter((item) => item.id !== section.id);
                if (!nextSections.some((item) => item.id === selectedLessonSectionId)) {
                    setSelectedLessonSectionId(nextSections[0]?.id ?? 'chapter-1');
                }
                return nextSections.length ? nextSections : createDefaultLessonSections();
            });
            toast.success('Đã xóa chương');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không xóa được chương'));
        }
    };

    const addLessonItem = async (classItem, sectionId, type, assessmentCategory = 'ASSIGNMENT') => {
        const typeMeta = [...lessonContentTypes, ...assessmentQuestionTypes].find((item) => item.key === type);
        const assessmentMeta = assessmentGroups.find((item) => item.key === assessmentCategory);
        draftLessonSequenceRef.current += 1;
        const lessonId = `lesson-${draftLessonSequenceRef.current}-${type}`;
        const section = getLessonSections(classItem).find((item) => item.id === sectionId);
        const nextOrder = (section?.lessons.length ?? 0) + 1;

        if (gradedLessonTypes.includes(type) && ['MIDTERM', 'FINAL'].includes(assessmentCategory)) {
            const hasExam = getLessonSections(classItem).some((item) => item.lessons.some((lesson) => lesson.assessmentCategory === assessmentCategory));
            if (hasExam) {
                toast.error(`Lớp chỉ được tạo tối đa một ${assessmentCategory === 'MIDTERM' ? 'bài thi giữa kỳ' : 'bài thi cuối kỳ'}`);
                return;
            }
        }

        if (!section?.publicId) {
            toast.error('Chương chưa có publicId từ BE, không thể tạo bài học thật');
            return;
        }

        if (type === 'VIDEO') {
            updateLessonSections(classItem, (sections) => sections.map((item) =>
                item.id === sectionId ? {
                    ...item,
                    lessons: [
                        ...item.lessons,
                        {
                            id: lessonId,
                            type,
                            title: `${typeMeta?.label ?? type} ${nextOrder}`,
                            videoUrl: '',
                            isPublished: false,
                            isDraft: true
                        }
                    ]
                } : item
            ));
            setActiveVideoLessonId(lessonId);
            return;
        }

        if (type === 'PDF') {
            updateLessonSections(classItem, (sections) =>
                sections.map((item) => {
                    if (item.id !== sectionId) return item;
                    return {
                        ...item,
                        lessons: [
                            ...item.lessons,
                            {
                                id: lessonId,
                                type,
                                title: `${typeMeta?.label ?? type} ${nextOrder}`,
                                content: '',
                                videoUrl: '',
                                mediaPublicId: '',
                                mediaTitle: '',
                                mediaUrl: '',
                                isPublished: false,
                                isDraft: true
                            }
                        ]
                    };
                })
            );
            setActivePdfLessonId(lessonId);
            return;
        }

        if (gradedLessonTypes.includes(type)) {
            const dates = defaultAssessmentDates();
            updateLessonSections(classItem, (sections) => sections.map((item) =>
                item.id === sectionId ? {
                    ...item,
                    lessons: [
                        ...item.lessons,
                        {
                            id: lessonId,
                            type,
                            assessmentCategory,
                            title: `${assessmentMeta?.label ?? 'Bài tập'} ${typeMeta?.label ?? type} ${nextOrder}`,
                            content: type === 'CODE' ? 'Viết chương trình theo yêu cầu.' : 'Nhập nội dung câu hỏi.',
                            points: 10,
                            openAt: dates.openAt,
                            closeAt: dates.closeAt,
                            durationMinutes: assessmentDurationOptions[assessmentCategory]?.[0],
                            maxAttempts: 1,
                            scorePolicy: 'HIGHEST',
                            maxViolations: 3,
                            quizQuestions: type === 'QUIZ'
                                ? [createQuizQuestion(`${lessonId}-question-1`)]
                                : [],
                            options: type === 'QUIZ'
                                ? [
                                    { id: `${lessonId}-a`, content: 'Đáp án A', isCorrect: true },
                                    { id: `${lessonId}-b`, content: 'Đáp án B', isCorrect: false }
                                ]
                                : [],
                            testCases: type === 'CODE'
                                ? [{ id: `${lessonId}-case-1`, input: '', expectedOutput: 'Hello World', isHidden: false }]
                                : [],
                            judgeLanguageId: type === 'CODE'
                                ? (judgeLanguages.find((language) => language.judgeEnabled !== false && Number(language.id) > 0)?.id ?? 63)
                                : undefined,
                            codeMode: type === 'CODE' ? 'SINGLE' : undefined,
                            starterFiles: type === 'CODE' ? createDefaultStarterFiles() : undefined,
                            starterCode: '',
                            isPublished: false,
                            isDraft: true,
                            isGradedAssessment: true,
                            hasQuestionConfig: true
                        }
                    ]
                } : item
            ));
            return;
        }

        updateLessonSections(classItem, (sections) => sections.map((item) =>
            item.id === sectionId ? {
                ...item,
                lessons: [
                    ...item.lessons,
                    {
                        id: lessonId,
                        type,
                        title: `${typeMeta?.label ?? type} ${nextOrder}`,
                        content: '<p>Nội dung học tập...</p>',
                        isPublished: false,
                        isDraft: true
                    }
                ]
            } : item
        ));
        setActiveTextLessonId(lessonId);
    };

    const saveTextLesson = async (classItem, sectionId, lesson) => {
        const section = getLessonSections(classItem).find((item) => item.id === sectionId);
        if (!section?.publicId) return;

        try {
            const payload = {
                sectionPublicId: section.publicId,
                title: lesson.title,
                type: 'TEXT',
                content: lesson.content,
                sortOrder: section.lessons.findIndex((item) => item.id === lesson.id) + 1,
                isPublished: lesson.isPublished ?? false
            };
            const savedLesson = lesson.publicId && !lesson.isDraft
                ? await adminModulesApi.updateLearningLesson(lesson.publicId, payload)
                : await adminModulesApi.createLearningLesson(payload);
            const normalizedLesson = normalizeLearningLesson(savedLesson);
            updateLessonSections(classItem, (sections) => sections.map((item) =>
                item.id === sectionId ? {
                    ...item,
                    lessons: item.lessons.map((currentLesson) => currentLesson.id === lesson.id ? normalizedLesson : currentLesson)
                } : item
            ));
            setActiveTextLessonId(normalizedLesson.id);
            toast.success('Đã lưu bài học Text');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không lưu được bài học Text'));
        }
    };

    const saveVideoLesson = async (classItem, sectionId, lesson) => {
        const section = getLessonSections(classItem).find((item) => item.id === sectionId);
        if (!section?.publicId) return;
        if (!lesson.videoUrl?.trim()) {
            toast.error('Vui lòng nhập link YouTube cho bài học video');
            return;
        }
        try {
            const payload = {
                sectionPublicId: section.publicId,
                title: lesson.title,
                type: 'VIDEO',
                resourceUrl: lesson.videoUrl.trim(),
                sortOrder: section.lessons.findIndex((item) => item.id === lesson.id) + 1,
                isPublished: lesson.isPublished ?? false
            };
            const savedLesson = lesson.publicId && !lesson.isDraft
                ? await adminModulesApi.updateLearningLesson(lesson.publicId, payload)
                : await adminModulesApi.createLearningLesson(payload);
            const normalizedLesson = normalizeLearningLesson(savedLesson);
            updateLessonSections(classItem, (sections) => sections.map((item) =>
                item.id === sectionId ? {
                    ...item,
                    lessons: item.lessons.map((currentLesson) => currentLesson.id === lesson.id ? normalizedLesson : currentLesson)
                } : item
            ));
            setActiveVideoLessonId(normalizedLesson.id);
            toast.success('Đã lưu bài học Video');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không lưu được bài học Video'));
        }
    };

    const saveGradedAssessmentLesson = async (classItem, sectionId, lesson) => {
        if (!gradedLessonTypes.includes(lesson.type)) return;
        const replacingAssessmentPublicId = lesson.isDraft
            ? null
            : (lesson.assessmentPublicId ?? lesson.publicId);
        if (replacingAssessmentPublicId && lesson.isPublished) {
            toast.error('Cần ẩn bài đánh giá trước khi cấu hình lại');
            return;
        }
        if (replacingAssessmentPublicId && !lesson.hasQuestionConfig) {
            toast.error('Không tải được chi tiết câu hỏi của bài đánh giá. Vui lòng tải lại dữ liệu lớp');
            return;
        }
        if (!lesson.title?.trim()) {
            toast.error('Vui lòng nhập tên bài đánh giá');
            return;
        }
        if (lesson.type !== 'QUIZ' && !lesson.content?.trim()) {
            toast.error('Vui lòng nhập nội dung câu hỏi');
            return;
        }
        const quizQuestions = lesson.type === 'QUIZ' ? getQuizQuestions(lesson) : [];
        if (lesson.type === 'QUIZ') {
            if (!quizQuestions.length) {
                toast.error('Trắc nghiệm cần ít nhất một câu hỏi');
                return;
            }
            const invalidQuestionIndex = quizQuestions.findIndex((question) => {
                const options = question.options ?? [];
                const correctCount = options.filter((option) => option.isCorrect).length;
                return !question.content?.trim()
                    || !(Number(question.points) > 0)
                    || options.length < 2
                    || options.some((option) => !option.content?.trim())
                    || (question.type === 'MULTIPLE_CHOICE' ? correctCount < 1 : correctCount !== 1);
            });
            if (invalidQuestionIndex >= 0) {
                toast.error(`Vui lòng kiểm tra nội dung, điểm và đáp án đúng của câu ${invalidQuestionIndex + 1}`);
                return;
            }
        }
        const openAt = new Date(lesson.openAt);
        const closeAt = new Date(lesson.closeAt);
        if (Number.isNaN(openAt.getTime()) || Number.isNaN(closeAt.getTime()) || openAt >= closeAt) {
            toast.error('Thời gian mở bài phải trước thời gian đóng bài');
            return;
        }
        const isWebCode = lesson.type === 'CODE' && lesson.codeMode === 'WEB';
        if (lesson.type === 'CODE' && !isWebCode && !lesson.testCases?.some((testCase) => testCase.expectedOutput?.trim())) {
            toast.error('Bài code cần ít nhất một test case');
            return;
        }
        if (lesson.type === 'CODE' && !isWebCode && !Number(lesson.judgeLanguageId)) {
            toast.error('Vui lòng chọn ngôn ngữ chấm code được BE hỗ trợ');
            return;
        }

        setSavingGradedLessonId(lesson.id);
        try {
            if (replacingAssessmentPublicId) {
                const existingAttempts = await adminModulesApi.assessmentAttempts(replacingAssessmentPublicId);
                if (toItems(existingAttempts).length > 0) {
                    toast.error('Không thể cấu hình lại bài đánh giá đã có lượt làm');
                    return;
                }
            }

            const assessmentCategory = lesson.assessmentCategory ?? 'ASSIGNMENT';
            const assessmentPayload = {
                classPublicId: classItem.publicId,
                title: lesson.title.trim(),
                description: `${assessmentGroups.find((item) => item.key === assessmentCategory)?.label ?? 'Bài đánh giá'} tạo từ Module học`,
                category: assessmentCategory,
                openAt: openAt.toISOString(),
                closeAt: closeAt.toISOString(),
                maxAttempts: Number(lesson.maxAttempts) || 1,
                scorePolicy: lesson.scorePolicy ?? 'HIGHEST',
                maxViolations: Number(lesson.maxViolations) || 3,
                isPublished: false
            };
            if (assessmentCategory !== 'ASSIGNMENT') {
                assessmentPayload.durationMinutes = Number(lesson.durationMinutes) || assessmentDurationOptions[assessmentCategory]?.[0];
            }
            const assessment = replacingAssessmentPublicId
                ? await adminModulesApi.updateLearningAssessment(replacingAssessmentPublicId, {
                    title: assessmentPayload.title,
                    description: assessmentPayload.description,
                    category: assessmentPayload.category,
                    openAt: assessmentPayload.openAt,
                    closeAt: assessmentPayload.closeAt,
                    durationMinutes: assessmentPayload.durationMinutes,
                    maxAttempts: assessmentPayload.maxAttempts,
                    scorePolicy: assessmentPayload.scorePolicy,
                    maxViolations: assessmentPayload.maxViolations
                })
                : await adminModulesApi.createLearningAssessment(assessmentPayload);
            const questionPayloads = lesson.type === 'QUIZ'
                ? quizQuestions.map((question, questionIndex) => ({
                    type: question.type === 'TRUE_FALSE' ? 'SINGLE_CHOICE' : question.type,
                    content: question.content.trim(),
                    points: Number(question.points),
                    sortOrder: questionIndex + 1,
                    options: question.options.map((option, optionIndex) => ({
                        content: option.content,
                        isCorrect: Boolean(option.isCorrect),
                        sortOrder: optionIndex + 1
                    }))
                }))
                : [{
                    type: lesson.type === 'CODE'
                        ? (isWebCode ? 'HTML_CSS' : 'CODE')
                        : questionTypeByLessonType[lesson.type],
                    content: lesson.content,
                    points: Number(lesson.points) || 10,
                    judgeLanguageId: lesson.type === 'CODE' && !isWebCode ? Number(lesson.judgeLanguageId) : undefined,
                    starterCode: lesson.type === 'CODE'
                        ? (isWebCode
                            ? JSON.stringify({
                                mode: 'WEB',
                                files: lesson.starterFiles ?? createDefaultStarterFiles()
                            })
                            : lesson.starterCode)
                        : undefined,
                    testCases: lesson.type === 'CODE' && !isWebCode
                        ? lesson.testCases.map((testCase, index) => ({
                            input: testCase.input,
                            expectedOutput: testCase.expectedOutput,
                            isHidden: Boolean(testCase.isHidden),
                            sortOrder: index + 1
                        }))
                        : undefined
                }];

            let savedAssessment;
            try {
                savedAssessment = await adminModulesApi.replaceLearningAssessmentQuestions(assessment.publicId, questionPayloads);
            } catch (error) {
                if (!replacingAssessmentPublicId) {
                    await adminModulesApi.deleteLearningAssessment(assessment.publicId).catch(() => undefined);
                }
                throw error;
            }

            const savedAssessmentItem = {
                ...lesson,
                ...normalizeAssessmentContentItem(savedAssessment)
            };
            updateLessonSections(classItem, (sections) => sections.map((section) =>
                section.id === sectionId ? {
                    ...section,
                    lessons: section.lessons.map((item) => item.id === lesson.id ? savedAssessmentItem : item)
                } : section
            ));
            setGradedAssessmentsByClass((current) => ({
                ...current,
                [classItem.publicId]: [
                    savedAssessment,
                    ...(current[classItem.publicId] ?? []).filter(
                        (item) => (item.publicId ?? item.id) !== assessment.publicId
                    )
                ]
            }));
            setActiveGradedLessonId(null);
            toast.success(replacingAssessmentPublicId ? 'Đã cập nhật cấu hình bài đánh giá' : 'Đã lưu bài tập có điểm lên hệ thống');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không lưu được bài tập có điểm'));
        } finally {
            setSavingGradedLessonId(null);
        }
    };

    const updateLessonItemField = (classItem, sectionId, lessonId, field, value) => {
        updateLessonSections(classItem, (sections) =>
            sections.map((section) => {
                if (section.id !== sectionId) return section;
                return {
                    ...section,
                    lessons: section.lessons.map((lesson) => lesson.id === lessonId ? { ...lesson, [field]: value } : lesson)
                };
            })
        );
    };

    const updateLessonItemContent = (classItem, sectionId, lessonId, content) => {
        updateLessonItemField(classItem, sectionId, lessonId, 'content', content);
    };

    const updateCodeTestCase = (classItem, sectionId, lesson, testCaseId, patch) => {
        updateLessonItemField(
            classItem,
            sectionId,
            lesson.id,
            'testCases',
            lesson.testCases.map((testCase) => testCase.id === testCaseId ? { ...testCase, ...patch } : testCase)
        );
    };

    const addCodeTestCase = (classItem, sectionId, lesson) => {
        updateLessonItemField(classItem, sectionId, lesson.id, 'testCases', [
            ...(lesson.testCases ?? []),
            {
                id: `case-${Date.now()}`,
                input: '',
                expectedOutput: '',
                isHidden: true
            }
        ]);
    };

    const removeCodeTestCase = (classItem, sectionId, lesson, testCaseId) => {
        const nextCases = (lesson.testCases ?? []).filter((testCase) => testCase.id !== testCaseId);
        updateLessonItemField(classItem, sectionId, lesson.id, 'testCases', nextCases.length ? nextCases : lesson.testCases);
    };

    const updateStarterFile = (classItem, sectionId, lesson, fileKey, value) => {
        updateLessonItemField(classItem, sectionId, lesson.id, 'starterFiles', {
            ...(lesson.starterFiles ?? createDefaultStarterFiles()),
            [fileKey]: value
        });
    };

    const updateCodeMode = (classItem, sectionId, lesson, codeMode) => {
        const defaultJudgeLanguageId = judgeLanguages.find((language) => language.judgeEnabled !== false && Number(language.id) > 0)?.id ?? 63;
        updateLessonSections(classItem, (sections) => sections.map((section) =>
            section.id === sectionId ? {
                ...section,
                lessons: section.lessons.map((item) => item.id === lesson.id ? {
                    ...item,
                    codeMode,
                    judgeLanguageId: codeMode === 'WEB'
                        ? 0
                        : (Number(item.judgeLanguageId) > 0 ? item.judgeLanguageId : defaultJudgeLanguageId)
                } : item)
            } : section
        ));
        if (codeMode === 'WEB') {
            setActiveCodeFileByLesson((current) => ({ ...current, [lesson.id]: current[lesson.id] ?? 'html' }));
        }
    };

    const selectPdfMediaForLesson = async (classItem, sectionId, lessonId, mediaPublicId) => {
        if (!mediaPublicId) return;
        const media = pdfMediaItems.find((item) => item.publicId === mediaPublicId);
        const section = getLessonSections(classItem).find((item) => item.id === sectionId);
        const lesson = section?.lessons.find((item) => item.id === lessonId);
        if (!section?.publicId || !lesson) return;

        try {
            const payload = {
                sectionPublicId: section.publicId,
                title: lesson.title,
                type: 'PDF',
                mediaPublicId,
                sortOrder: section.lessons.findIndex((item) => item.id === lessonId) + 1,
                isPublished: lesson.isPublished ?? false
            };
            const savedLesson = lesson.publicId && !lesson.isDraft
                ? await adminModulesApi.updateLearningLesson(lesson.publicId, payload)
                : await adminModulesApi.createLearningLesson(payload);
            const normalizedLesson = normalizeLearningLesson(savedLesson);
            updateLessonSections(classItem, (sections) =>
                sections.map((item) => {
                    if (item.id !== sectionId) return item;
                    return {
                        ...item,
                        lessons: item.lessons.map((currentLesson) => currentLesson.id === lessonId ? {
                            ...normalizedLesson,
                            mediaPublicId: media?.publicId || normalizedLesson.mediaPublicId,
                            mediaTitle: media?.title || media?.originalName || media?.fileName || normalizedLesson.mediaTitle,
                            mediaUrl: getMediaFileUrl(media?.publicId, media?.absoluteUrl || media?.url) || normalizedLesson.mediaUrl
                        } : currentLesson)
                    };
                })
            );
            setActivePdfLessonId(normalizedLesson.id);
            if (media?.publicId) loadPdfPreviewUrl(media.publicId);
            toast.success('Đã tạo bài học PDF trên hệ thống');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tạo được bài học PDF'));
        }
    };

    const attachUploadedPdfToLesson = async (classItem, sectionId, lesson, media) => {
        const section = getLessonSections(classItem).find((item) => item.id === sectionId);
        if (!section?.publicId) return;

        const payload = {
            sectionPublicId: section.publicId,
            title: lesson.title,
            type: 'PDF',
            mediaPublicId: media.publicId,
            sortOrder: section.lessons.findIndex((item) => item.id === lesson.id) + 1,
            isPublished: lesson.isPublished ?? false
        };
        const savedLesson = lesson.publicId && !lesson.isDraft
            ? await adminModulesApi.updateLearningLesson(lesson.publicId, payload)
            : await adminModulesApi.createLearningLesson(payload);
        const normalizedLesson = normalizeLearningLesson(savedLesson);
        updateLessonSections(classItem, (sections) =>
            sections.map((section) => {
                if (section.id !== sectionId) return section;
                return {
                    ...section,
                    lessons: section.lessons.map((currentLesson) => currentLesson.id === lesson.id ? {
                        ...normalizedLesson,
                        mediaPublicId: media.publicId || normalizedLesson.mediaPublicId,
                        mediaTitle: media.title || media.originalName || media.fileName || normalizedLesson.mediaTitle,
                        mediaUrl: getMediaFileUrl(media.publicId, media.absoluteUrl || media.url) || normalizedLesson.mediaUrl
                    } : currentLesson)
                };
            })
        );
        setActivePdfLessonId(normalizedLesson.id);
        if (media.publicId) loadPdfPreviewUrl(media.publicId);
    };

    const handlePdfLessonUpload = async (event, classItem, sectionId, lesson) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setSelectedPdfFileNames((current) => ({ ...current, [lesson.id]: file.name }));

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            toast.error('Chỉ được upload tệp PDF cho bài học PDF');
            return;
        }

        setUploadingPdfLessonId(lesson.id);
        try {
            const media = await mediaApi.upload(file, {
                title: lesson.title,
                folder: `classes/${classItem.code || classItem.publicId}/lessons`
            });
            setPdfMediaItems((current) => {
                const exists = current.some((item) => item.publicId === media.publicId);
                return exists ? current.map((item) => item.publicId === media.publicId ? media : item) : [media, ...current];
            });
            await attachUploadedPdfToLesson(classItem, sectionId, lesson, media);
            toast.success('Đã upload và tạo bài học PDF trên hệ thống');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không upload được PDF'));
        } finally {
            setUploadingPdfLessonId(null);
        }
    };

    const renameLessonItem = async (classItem, sectionId, lesson) => {
        const nextTitle = window.prompt('Nhập tên bài học mới', lesson.title);
        if (!nextTitle?.trim()) return;
        if (lesson.publicId && !lesson.isDraft && !lesson.isGradedAssessment) {
            try {
                const updatedLesson = await adminModulesApi.updateLearningLesson(lesson.publicId, { title: nextTitle.trim() });
                const normalizedLesson = normalizeLearningLesson(updatedLesson);
                updateLessonSections(classItem, (sections) => sections.map((section) =>
                    section.id === sectionId ? {
                        ...section,
                        lessons: section.lessons.map((item) => item.id === lesson.id ? normalizedLesson : item)
                    } : section
                ));
                toast.success('Đã đổi tên bài học');
                return;
            } catch (error) {
                toast.error(getApiMessage(error, 'Không đổi tên được bài học'));
                return;
            }
        }
        updateLessonSections(classItem, (sections) => sections.map((section) =>
            section.id === sectionId ? {
                ...section,
                lessons: section.lessons.map((item) => item.id === lesson.id ? { ...item, title: nextTitle.trim() } : item)
            } : section
        ));
    };

    const reorderLessonItems = (classItem, sectionId, sourceLessonId, targetLessonId) => {
        if (!sourceLessonId || sourceLessonId === targetLessonId) return;
        const nextSections = getLessonSections(classItem).map((section) => {
            if (section.id !== sectionId) return section;
            const currentIndex = section.lessons.findIndex((item) => item.id === sourceLessonId);
            const nextIndex = section.lessons.findIndex((item) => item.id === targetLessonId);
            if (currentIndex < 0 || nextIndex < 0) return section;
            const nextLessons = [...section.lessons];
            const [movedLesson] = nextLessons.splice(currentIndex, 1);
            nextLessons.splice(nextIndex, 0, movedLesson);
            return { ...section, lessons: nextLessons };
        });
        applyReorderedSections(classItem, nextSections);
    };

    const toggleLessonItemVisibility = async (classItem, sectionId, lessonId) => {
        const section = getLessonSections(classItem).find((item) => item.id === sectionId);
        const lesson = section?.lessons.find((item) => item.id === lessonId);
        if (!lesson) return;
        if (lesson.isGradedAssessment && !lesson.isDraft) {
            try {
                const assessmentPublicId = lesson.assessmentPublicId ?? lesson.publicId;
                const updatedAssessment = await adminModulesApi.publishLearningAssessment(assessmentPublicId, !lesson.isPublished);
                const normalizedAssessment = normalizeAssessmentContentItem(updatedAssessment);
                updateLessonSections(classItem, (sections) => sections.map((item) =>
                    item.id === sectionId ? {
                        ...item,
                        lessons: item.lessons.map((currentLesson) => currentLesson.id === lessonId ? {
                            ...currentLesson,
                            ...normalizedAssessment,
                            type: currentLesson.type,
                            hasQuestionConfig: currentLesson.hasQuestionConfig || normalizedAssessment.hasQuestionConfig
                        } : currentLesson)
                    } : item
                ));
                setGradedAssessmentsByClass((current) => ({
                    ...current,
                    [classItem.publicId]: (current[classItem.publicId] ?? []).map((assessment) =>
                        (assessment.publicId ?? assessment.id) === assessmentPublicId
                            ? { ...assessment, ...updatedAssessment }
                            : assessment
                    )
                }));
                toast.success(normalizedAssessment.isPublished ? 'Đã công bố bài đánh giá' : 'Đã ẩn bài đánh giá');
            } catch (error) {
                toast.error(getApiMessage(error, 'Không cập nhật trạng thái bài đánh giá'));
            }
            return;
        }
        if (lesson.publicId && !lesson.isDraft && !lesson.isGradedAssessment) {
            try {
                const updatedLesson = await adminModulesApi.updateLearningLesson(lesson.publicId, { isPublished: !lesson.isPublished });
                const normalizedLesson = normalizeLearningLesson(updatedLesson);
                updateLessonSections(classItem, (sections) => sections.map((item) =>
                    item.id === sectionId ? {
                        ...item,
                        lessons: item.lessons.map((currentLesson) => currentLesson.id === lessonId ? normalizedLesson : currentLesson)
                    } : item
                ));
                toast.success(normalizedLesson.isPublished ? 'Đã công khai bài học' : 'Đã ẩn bài học');
                return;
            } catch (error) {
                toast.error(getApiMessage(error, 'Không cập nhật trạng thái bài học'));
                return;
            }
        }
        updateLessonSections(classItem, (sections) => sections.map((item) =>
            item.id === sectionId ? {
                ...item,
                lessons: item.lessons.map((currentLesson) => currentLesson.id === lessonId ? { ...currentLesson, isPublished: !currentLesson.isPublished } : currentLesson)
            } : item
        ));
    };

    const removeLessonItem = async (classItem, sectionId, lessonId) => {
        const section = getLessonSections(classItem).find((item) => item.id === sectionId);
        const lesson = section?.lessons.find((item) => item.id === lessonId);
        if (!lesson) return;
        if (lesson.isGradedAssessment && !lesson.isDraft && lesson.isPublished) {
            toast.error('Cần ẩn bài đánh giá trước khi xóa');
            return;
        }
        const itemLabel = lesson.isGradedAssessment ? 'bài đánh giá' : 'học liệu';
        if (!window.confirm(`Xóa ${itemLabel} "${lesson.title}"? Thao tác này không thể hoàn tác.`)) return;

        setDeletingLessonId(lessonId);
        try {
            if (lesson.isGradedAssessment && !lesson.isDraft) {
                const assessmentPublicId = lesson.assessmentPublicId ?? lesson.publicId;
                await adminModulesApi.deleteLearningAssessment(assessmentPublicId);
                setGradedAssessmentsByClass((current) => ({
                    ...current,
                    [classItem.publicId]: (current[classItem.publicId] ?? []).filter((assessment) =>
                        (assessment.publicId ?? assessment.id) !== assessmentPublicId
                    )
                }));
                setWorkspaceAttempts((current) => ({
                    ...current,
                    [classItem.publicId]: (current[classItem.publicId] ?? []).filter((attempt) =>
                        (attempt.assessment?.publicId ?? attempt.assessmentPublicId) !== assessmentPublicId
                    )
                }));
                toast.success('Đã xóa bài đánh giá');
            } else if (lesson.publicId && !lesson.isDraft) {
                await adminModulesApi.deleteLearningLesson(lesson.publicId);
                toast.success('Đã xóa bài học');
            }

            updateLessonSections(classItem, (sections) => sections.map((item) =>
                item.id === sectionId ? { ...item, lessons: item.lessons.filter((currentLesson) => currentLesson.id !== lessonId) } : item
            ));
            if (activeGradedLessonId === lessonId) setActiveGradedLessonId(null);
            if (activeTextLessonId === lessonId) setActiveTextLessonId(null);
            if (activeVideoLessonId === lessonId) setActiveVideoLessonId(null);
            if (activePdfLessonId === lessonId) setActivePdfLessonId(null);
        } catch (error) {
            toast.error(getApiMessage(error, `Không xóa được ${itemLabel}`));
        } finally {
            setDeletingLessonId(null);
        }
    };

    const gradeWorkspaceAnswer = async (classItem, answer) => {
        const draft = workspaceGradeDrafts[answer.id] ?? {};
        const awardedPoints = Number(draft.points ?? answer.awardedPoints);
        const maxPoints = Number(answer.question?.points ?? 0);
        if (!Number.isFinite(awardedPoints) || awardedPoints < 0 || awardedPoints > maxPoints) {
            toast.error(`Điểm phải từ 0 đến ${maxPoints}`);
            return;
        }
        setSavingWorkspaceAnswerId(answer.id);
        try {
            await adminModulesApi.gradeAnswer(answer.id, {
                awardedPoints,
                feedback: draft.feedback ?? answer.feedback ?? ''
            });
            toast.success('Đã lưu điểm và nhận xét');
            await loadClassWorkspaceOperations(classItem);
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể lưu kết quả chấm'));
        } finally {
            setSavingWorkspaceAnswerId(null);
        }
    };

    const renderClassWorkspaceContent = (classItem = selectedClassAction) => {
        if (!classItem) return null;

        if (classWorkspaceTab === 'overview') {
            return (
                <div className={styles.classOverview}>
                    <section className={styles.classSummaryGrid}>
                        <div>
                            <span>Sĩ số</span>
                            <strong>{classItem.currentStudents ?? 0}/{classItem.maxStudents ?? 0}</strong>
                        </div>
                        <div>
                            <span>Giảng viên</span>
                            <strong>{classItem.lecturer?.fullName ?? 'Chưa phân công'}</strong>
                        </div>
                        <div>
                            <span>Môn học</span>
                            <strong>{classItem.subject?.code ?? '-'} · {classItem.subject?.name ?? '-'}</strong>
                        </div>
                    </section>

                    <section className={styles.classOverviewGrid}>
                        <div className={styles.classOverviewSection}>
                            <div className={styles.recordHeader}>
                                <div>
                                    <p className={ui.eyebrow}>Thông tin lớp</p>
                                    <strong>{classItem.name ?? '-'}</strong>
                                </div>
                            </div>
                            <dl className={styles.compactDefinitionList}>
                                <div><dt>Mã lớp</dt><dd>{classItem.code ?? '-'}</dd></div>
                                <div><dt>Bộ môn</dt><dd>{classItem.department?.name ?? '-'}</dd></div>
                                <div><dt>Quản lý lớp</dt><dd>{classItem.manager?.fullName ?? '-'}</dd></div>
                                <div><dt>Public ID</dt><dd>{classItem.publicId ?? '-'}</dd></div>
                            </dl>
                        </div>

                        <div className={styles.classOverviewSection}>
                            <div className={styles.recordHeader}>
                                <div>
                                    <p className={ui.eyebrow}>Đăng ký</p>
                                    <strong>Thời gian và trạng thái</strong>
                                </div>
                            </div>
                            <dl className={styles.compactDefinitionList}>
                                <div><dt>Mở đăng ký</dt><dd>{formatDateTime(classItem.registrationStart)}</dd></div>
                                <div><dt>Đóng đăng ký</dt><dd>{formatDateTime(classItem.registrationEnd)}</dd></div>
                                <div><dt>Trạng thái</dt><dd><StatusPill value={classStatusLabels[classItem.status] ?? classItem.status} status={classItem.status} /></dd></div>
                            </dl>
                        </div>
                    </section>
                </div>
            );
        }

        if (classWorkspaceTab === 'learningModules') {
            const lessonSections = getLessonSections(classItem);
            const selectedSection = lessonSections.find((section) => section.id === selectedLessonSectionId) ?? lessonSections[0];
            const previewSections = lessonSections
                .filter((section) => section.isPublished)
                .map((section) => ({ ...section, lessons: section.lessons.filter((lesson) => lesson.isPublished) }));

            return (
                <div className={styles.lessonBuilder}>
                    {isLessonContentLoading ? (
                        <div className={styles.lessonLoadingState}>Đang tải nội dung bài học từ hệ thống...</div>
                    ) : null}
                    <aside className={styles.lessonChapterPanel}>
                        <div className={styles.recordHeader}>
                            <div>
                                <p className={ui.eyebrow}>Chương</p>
                                <strong>Danh mục nội dung</strong>
                            </div>
                            <button className={ui.secondaryButton} type="button" onClick={() => addLessonSection(classItem)}>
                                <FiPlus /> Thêm chương
                            </button>
                        </div>
                        {lessonSections.map((section) => (
                            <article
                                className={classNames(styles.lessonChapterCard, { [styles.lessonChapterCardActive]: selectedSection?.id === section.id })}
                                key={section.id}
                                draggable
                                onClick={() => setSelectedLessonSectionId(section.id)}
                                onDragStart={(event) => {
                                    event.dataTransfer.setData('text/plain', section.id);
                                    event.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = 'move';
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    reorderLessonSections(classItem, event.dataTransfer.getData('text/plain'), section.id);
                                }}
                            >
                                <div>
                                    <strong>{section.title}</strong>
                                    <span>{section.isAutoCreated ? 'Được tạo tự động' : `${section.lessons.length} học liệu`} · Kéo để sắp xếp</span>
                                </div>
                                <StatusPill value={section.isPublished ? 'Công khai' : 'Đang ẩn'} status={section.isPublished ? 'PUBLIC' : 'DRAFT'} />
                                {selectedSection?.id === section.id ? (
                                    <div className={styles.lessonChapterActions}>
                                        <button className={ui.secondaryButton} type="button" onClick={(event) => { event.stopPropagation(); renameLessonSection(classItem, section); }}>Đổi tên</button>
                                        <button className={ui.secondaryButton} type="button" onClick={(event) => { event.stopPropagation(); toggleLessonSectionVisibility(classItem, section.id); }}>
                                            {section.isPublished ? 'Ẩn chương' : 'Công khai'}
                                        </button>
                                        <button className={ui.secondaryButton} type="button" onClick={(event) => { event.stopPropagation(); removeLessonSection(classItem, section); }}>
                                            Xóa
                                        </button>
                                    </div>
                                ) : null}
                            </article>
                        ))}
                    </aside>

                    <section className={styles.lessonContentPanel}>
                        <div className={styles.recordHeader}>
                            <div>
                                <p className={ui.eyebrow}>{selectedSection?.title ?? 'Chương'}</p>
                                <strong>Tổ chức nội dung học tập</strong>
                            </div>
                            <label className={styles.previewToggle}>
                                <input
                                    type="checkbox"
                                    checked={isStudentPreview}
                                    onChange={(event) => setStudentPreview(event.target.checked)}
                                />
                                Xem trước vai trò sinh viên
                            </label>
                        </div>

                        {isStudentPreview ? (
                            <div className={styles.studentPreviewPanel}>
                                <span>Vai trò sinh viên</span>
                                {previewSections.length ? previewSections.map((section) => (
                                    <div className={styles.studentPreviewSection} key={section.id}>
                                        <strong>{section.title}</strong>
                                        {section.lessons.length ? section.lessons.map((lesson) => (
                                            <div className={styles.studentPreviewLesson} key={lesson.id}>
                                                <strong>{lesson.title}</strong>
                                                {lesson.type === 'TEXT' && lesson.content ? (
                                                    <div className={styles.richLessonContent} dangerouslySetInnerHTML={{ __html: lesson.content }} />
                                                ) : null}
                                                {lesson.type === 'VIDEO' ? (
                                                    getYoutubeEmbedUrl(lesson.videoUrl) ? (
                                                        <div className={styles.youtubeEmbed}>
                                                            <iframe
                                                                src={getYoutubeEmbedUrl(lesson.videoUrl)}
                                                                title={lesson.title}
                                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                                allowFullScreen
                                                            />
                                                        </div>
                                                    ) : <p>Video YouTube chưa được cấu hình.</p>
                                                ) : null}
                                                {lesson.type === 'PDF' ? (
                                                    getPdfPreviewUrl(lesson, pdfPreviewUrls) ? (
                                                        <div className={styles.pdfEmbed}>
                                                            <iframe src={getPdfViewerUrl(getPdfPreviewUrl(lesson, pdfPreviewUrls))} title={lesson.title} />
                                                        </div>
                                                    ) : lesson.mediaPublicId ? (
                                                        <p>Đang tải file PDF...</p>
                                                    ) : <p>PDF chưa được chọn từ Media.</p>
                                                ) : null}
                                                {gradedLessonTypes.includes(lesson.type) ? (
                                                    <div className={styles.studentAssessmentPreview}>
                                                        <span>{assessmentGroups.find((item) => item.key === lesson.assessmentCategory)?.label ?? 'Bài đánh giá'}</span>
                                                        <p>{lesson.type === 'CODE' ? 'Bài code chấm tự động' : lesson.type === 'ESSAY' ? 'Bài tự luận chờ giáo viên chấm' : 'Bài trắc nghiệm chấm tự động'}</p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )) : <p>Chưa có học liệu công khai.</p>}
                                    </div>
                                )) : <p>Chưa có chương công khai.</p>}
                            </div>
                        ) : (
                            <>
                                <div className={styles.learningModuleCreator}>
                                    <section>
                                        <div className={styles.creatorHeader}>
                                            <strong>Tạo bài học</strong>
                                        </div>
                                        <div className={styles.moduleSelectRow}>
                                            <label>
                                                Loại bài học
                                                <select value={selectedLessonType} onChange={(event) => setSelectedLessonType(event.target.value)}>
                                                    {lessonContentTypes.map((type) => (
                                                        <option value={type.key} key={type.key}>{type.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <button className={ui.primaryButton} type="button" onClick={() => selectedSection && addLessonItem(classItem, selectedSection.id, selectedLessonType)}>
                                                <FiPlus /> Thêm bài học
                                            </button>
                                        </div>
                                    </section>
                                    <section>
                                        <div className={styles.creatorHeader}>
                                            <strong>Tạo đánh giá có điểm</strong>
                                        </div>
                                        <div className={styles.moduleSelectRow}>
                                            <label>
                                                Loại đánh giá
                                                <select value={selectedAssessmentCategory} onChange={(event) => setSelectedAssessmentCategory(event.target.value)}>
                                                    {assessmentGroups.map((group) => (
                                                        <option value={group.key} key={group.key}>{group.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label>
                                                Hình thức
                                                <select value={selectedAssessmentQuestionType} onChange={(event) => setSelectedAssessmentQuestionType(event.target.value)}>
                                                    {assessmentQuestionTypes.map((type) => (
                                                        <option value={type.key} key={type.key}>{type.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <button className={ui.primaryButton} type="button" onClick={() => selectedSection && addLessonItem(classItem, selectedSection.id, selectedAssessmentQuestionType, selectedAssessmentCategory)}>
                                                <FiPlus /> Thêm đánh giá
                                            </button>
                                        </div>
                                    </section>
                                </div>
                                {selectedSection?.lessons.length ? (
                                    <div className={styles.lessonItemList}>
                                        {selectedSection.lessons.map((lesson, index) => (
                                            <article
                                                className={styles.lessonItemCard}
                                                key={lesson.id}
                                                draggable
                                                onDragStart={(event) => {
                                                    event.dataTransfer.setData('text/plain', lesson.id);
                                                    event.dataTransfer.effectAllowed = 'move';
                                                }}
                                                onDragOver={(event) => {
                                                    event.preventDefault();
                                                    event.dataTransfer.dropEffect = 'move';
                                                }}
                                                onDrop={(event) => {
                                                    event.preventDefault();
                                                    reorderLessonItems(classItem, selectedSection.id, event.dataTransfer.getData('text/plain'), lesson.id);
                                                }}
                                            >
                                                <div>
                                                    <strong>{index + 1}. {lesson.title}</strong>
                                                    <span>{[...lessonContentTypes, ...assessmentQuestionTypes].find((type) => type.key === lesson.type)?.label ?? lesson.type}{lesson.assessmentCategory ? ` · ${assessmentGroups.find((item) => item.key === lesson.assessmentCategory)?.label ?? lesson.assessmentCategory}` : ''} · {lesson.isDraft ? 'Chưa lưu lên hệ thống' : 'Đã lưu'} · Kéo để sắp xếp</span>
                                                </div>
                                                <div className={styles.lessonItemActions}>
                                                    <StatusPill value={lesson.isDraft ? 'Chưa lưu' : (lesson.isPublished ? 'Công khai' : 'Đang ẩn')} status={lesson.isDraft ? 'DRAFT' : (lesson.isPublished ? 'PUBLIC' : 'DRAFT')} />
                                                    <button className={ui.secondaryButton} type="button" onClick={() => renameLessonItem(classItem, selectedSection.id, lesson)}>Đổi tên</button>
                                                    {lesson.type === 'TEXT' ? (
                                                        <>
                                                            <button className={ui.secondaryButton} type="button" onClick={() => setActiveTextLessonId(activeTextLessonId === lesson.id ? null : lesson.id)}>
                                                                {activeTextLessonId === lesson.id ? 'Đóng soạn thảo' : 'Soạn nội dung'}
                                                            </button>
                                                            {lesson.isDraft ? (
                                                                <button className={ui.primaryButton} type="button" onClick={() => saveTextLesson(classItem, selectedSection.id, lesson)}>
                                                                    Lưu bài học
                                                                </button>
                                                            ) : null}
                                                        </>
                                                    ) : null}
                                                    {lesson.type === 'VIDEO' ? (
                                                        <>
                                                            <button className={ui.secondaryButton} type="button" onClick={() => setActiveVideoLessonId(activeVideoLessonId === lesson.id ? null : lesson.id)}>
                                                                {activeVideoLessonId === lesson.id ? 'Đóng cấu hình' : 'Gắn YouTube'}
                                                            </button>
                                                            {lesson.isDraft ? (
                                                                <button className={ui.primaryButton} type="button" onClick={() => saveVideoLesson(classItem, selectedSection.id, lesson)}>
                                                                    Lưu bài học
                                                                </button>
                                                            ) : null}
                                                        </>
                                                    ) : null}
                                                    {lesson.type === 'PDF' ? (
                                                        <button className={ui.secondaryButton} type="button" onClick={() => setActivePdfLessonId(activePdfLessonId === lesson.id ? null : lesson.id)}>
                                                            {activePdfLessonId === lesson.id ? 'Đóng Upload PDF' : 'Upload PDF'}
                                                        </button>
                                                    ) : null}
                                                    {gradedLessonTypes.includes(lesson.type) ? (
                                                        <>
                                                            <button
                                                                className={ui.secondaryButton}
                                                                type="button"
                                                            onClick={() => {
                                                                if (!lesson.isDraft && !lesson.hasQuestionConfig) {
                                                                    toast.error('Không tải được chi tiết câu hỏi. Vui lòng tải lại dữ liệu lớp');
                                                                    return;
                                                                    }
                                                                    setActiveGradedLessonId(activeGradedLessonId === lesson.id ? null : lesson.id);
                                                                }}
                                                            >
                                                                {activeGradedLessonId === lesson.id ? 'Đóng cấu hình' : 'Cấu hình đánh giá'}
                                                            </button>
                                                            {activeGradedLessonId === lesson.id ? (
                                                                <button
                                                                    className={ui.primaryButton}
                                                                    type="button"
                                                                    disabled={savingGradedLessonId === lesson.id || (!lesson.isDraft && lesson.isPublished)}
                                                                    title={!lesson.isDraft && lesson.isPublished ? 'Ẩn bài đánh giá trước khi cấu hình lại' : (lesson.isDraft ? 'Lưu bài đánh giá' : 'Lưu cấu hình thay đổi')}
                                                                    onClick={() => saveGradedAssessmentLesson(classItem, selectedSection.id, lesson)}
                                                                >
                                                                    <FiSave /> {savingGradedLessonId === lesson.id ? 'Đang lưu...' : (lesson.isDraft ? 'Lưu đánh giá' : 'Lưu thay đổi')}
                                                                </button>
                                                            ) : null}
                                                        </>
                                                    ) : null}
                                                    <button className={ui.secondaryButton} type="button" onClick={() => toggleLessonItemVisibility(classItem, selectedSection.id, lesson.id)}>
                                                        {lesson.isPublished ? 'Ẩn' : 'Công khai'}
                                                    </button>
                                                    <button
                                                        className={classNames(ui.secondaryButton, ui.dangerButton)}
                                                        type="button"
                                                        disabled={deletingLessonId === lesson.id || (lesson.isGradedAssessment && !lesson.isDraft && lesson.isPublished)}
                                                        title={lesson.isGradedAssessment && !lesson.isDraft && lesson.isPublished ? 'Ẩn bài đánh giá trước khi xóa' : 'Xóa khỏi Module học'}
                                                        onClick={() => removeLessonItem(classItem, selectedSection.id, lesson.id)}
                                                    >
                                                        <FiXCircle /> {deletingLessonId === lesson.id ? 'Đang xóa...' : 'Xóa'}
                                                    </button>
                                                </div>
                                                {lesson.type === 'TEXT' && activeTextLessonId === lesson.id ? (
                                                    <div className={styles.textLessonEditor} onDragStart={(event) => event.stopPropagation()}>
                                                        <Editor
                                                            value={lesson.content ?? ''}
                                                            onEditorChange={(content) => updateLessonItemContent(classItem, selectedSection.id, lesson.id, content)}
                                                            init={{
                                                                height: 360,
                                                                menubar: false,
                                                                license_key: 'gpl',
                                                                plugins: 'lists link table code wordcount',
                                                                toolbar: 'undo redo | blocks | bold italic underline | bullist numlist | link table | alignleft aligncenter alignright | code',
                                                                branding: false,
                                                                promotion: false,
                                                                content_style: 'body { font-family: Inter, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #172033; }'
                                                            }}
                                                        />
                                                    </div>
                                                ) : null}
                                                {lesson.type === 'VIDEO' && activeVideoLessonId === lesson.id ? (
                                                    <div className={styles.videoLessonConfig} onDragStart={(event) => event.stopPropagation()}>
                                                        <label>
                                                            Link YouTube
                                                            <input
                                                                type="url"
                                                                placeholder="https://www.youtube.com/watch?v=..."
                                                                value={lesson.videoUrl ?? ''}
                                                                onChange={(event) => updateLessonItemField(classItem, selectedSection.id, lesson.id, 'videoUrl', event.target.value)}
                                                            />
                                                        </label>
                                                        {getYoutubeEmbedUrl(lesson.videoUrl) ? (
                                                            <div className={styles.youtubeEmbed}>
                                                                <iframe
                                                                    src={getYoutubeEmbedUrl(lesson.videoUrl)}
                                                                    title={lesson.title}
                                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                                    allowFullScreen
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span>Dán link YouTube dạng watch, youtu.be, shorts hoặc embed để xem trước video.</span>
                                                        )}
                                                    </div>
                                                ) : null}
                                                {lesson.type === 'PDF' && activePdfLessonId === lesson.id ? (
                                                    <div className={styles.pdfLessonConfig} onDragStart={(event) => event.stopPropagation()}>
                                                        <div className={styles.pdfPickerHeader}>
                                                            <div>
                                                                <strong>Upload PDF</strong>
                                                                <span>Chọn PDF đã có trong Media hoặc upload file mới nếu chưa có sẵn.</span>
                                                            </div>
                                                            <div className={styles.pdfPickerActions}>
                                                                <button className={ui.secondaryButton} type="button" onClick={loadPdfMediaItems} disabled={isPdfMediaLoading}>
                                                                    {isPdfMediaLoading ? 'Đang tải...' : 'Làm mới'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <label>
                                                            Chọn từ Media
                                                            <select
                                                                value={lesson.mediaPublicId ?? ''}
                                                                onChange={(event) => selectPdfMediaForLesson(classItem, selectedSection.id, lesson.id, event.target.value)}
                                                                disabled={isPdfMediaLoading}
                                                            >
                                                                <option value="">Chọn PDF từ thư viện media</option>
                                                                {pdfMediaItems.map((media) => (
                                                                    <option value={media.publicId} key={media.publicId}>
                                                                        {media.title || media.originalName || media.fileName}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                        <label className={styles.pdfUploadDrop}>
                                                            <input
                                                                type="file"
                                                                accept="application/pdf,.pdf"
                                                                onChange={(event) => handlePdfLessonUpload(event, classItem, selectedSection.id, lesson)}
                                                                disabled={uploadingPdfLessonId === lesson.id}
                                                            />
                                                            <span className={styles.pdfUploadButton}>{uploadingPdfLessonId === lesson.id ? 'Đang upload...' : 'Upload file'}</span>
                                                            <span className={styles.pdfUploadFileName}>
                                                                {selectedPdfFileNames[lesson.id] || lesson.mediaTitle || 'Chưa chọn file PDF'}
                                                            </span>
                                                        </label>
                                                        {!pdfMediaItems.length && !isPdfMediaLoading ? (
                                                            <span>Chưa có PDF trong Media. Upload file mới tại đây để sử dụng cho bài học.</span>
                                                        ) : null}
                                                        {lesson.mediaUrl ? (
                                                            <div className={styles.pdfSelectedPreview}>
                                                                <strong>{lesson.mediaTitle || 'PDF đã chọn'}</strong>
                                                                <a href={lesson.mediaUrl} target="_blank" rel="noreferrer">Mở PDF</a>
                                                                {getPdfPreviewUrl(lesson, pdfPreviewUrls) ? (
                                                                    <div className={styles.pdfEmbed}>
                                                                        <iframe src={getPdfViewerUrl(getPdfPreviewUrl(lesson, pdfPreviewUrls))} title={lesson.title} />
                                                                    </div>
                                                                ) : (
                                                                    <p>Đang tải file PDF...</p>
                                                                )}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                                {gradedLessonTypes.includes(lesson.type) && activeGradedLessonId === lesson.id ? (
                                                    <div className={styles.gradedLessonConfig} onDragStart={(event) => event.stopPropagation()}>
                                                        <div className={styles.recordHeader}>
                                                            <div>
                                                                <p className={ui.eyebrow}>Bài tập có điểm</p>
                                                                <strong>{assessmentGroups.find((item) => item.key === lesson.assessmentCategory)?.label ?? 'Đánh giá'} · {assessmentQuestionTypes.find((type) => type.key === lesson.type)?.label}</strong>
                                                            </div>
                                                            <StatusPill value="Có tính điểm" status="PUBLIC" />
                                                        </div>
                                                        {lesson.type === 'ESSAY' ? (
                                                            <>
                                                                <label>
                                                                    Nội dung câu hỏi
                                                                    <textarea
                                                                        value={lesson.content ?? ''}
                                                                        onChange={(event) => updateLessonItemField(classItem, selectedSection.id, lesson.id, 'content', event.target.value)}
                                                                    />
                                                                </label>
                                                                <div className={styles.gradedConfigGrid}>
                                                                    <label>
                                                                        Điểm
                                                                        <input type="number" min="0.01" step="0.25" value={lesson.points ?? 10} onChange={(event) => updateLessonItemField(classItem, selectedSection.id, lesson.id, 'points', event.target.value)} />
                                                                    </label>
                                                                    <label>
                                                                        Số lượt
                                                                        <input type="number" min="1" value={lesson.maxAttempts ?? 1} onChange={(event) => updateLessonItemField(classItem, selectedSection.id, lesson.id, 'maxAttempts', event.target.value)} />
                                                                    </label>
                                                                    {lesson.assessmentCategory !== 'ASSIGNMENT' ? (
                                                                        <label>
                                                                            Thời lượng phút
                                                                            <select value={lesson.durationMinutes ?? (lesson.assessmentCategory === 'QUIZ' ? 15 : 60)} onChange={(event) => updateLessonItemField(classItem, selectedSection.id, lesson.id, 'durationMinutes', event.target.value)}>
                                                                                {(lesson.assessmentCategory === 'QUIZ' ? [15, 45] : lesson.assessmentCategory === 'MIDTERM' ? [45, 60] : [45, 60, 120]).map((minutes) => (
                                                                                    <option value={minutes} key={minutes}>{minutes} phút</option>
                                                                                ))}
                                                                            </select>
                                                                        </label>
                                                                    ) : null}
                                                                </div>
                                                            </>
                                                        ) : null}
                                                        {lesson.type === 'QUIZ' ? (
                                                            <QuizAssessmentConfig
                                                                classItem={classItem}
                                                                lesson={lesson}
                                                                sectionId={selectedSection.id}
                                                                updateField={updateLessonItemField}
                                                            />
                                                        ) : null}
                                                        {lesson.type === 'CODE' ? (
                                                            <CodeAssessmentConfig
                                                                activeFile={activeCodeFileByLesson[lesson.id]}
                                                                addTestCase={() => addCodeTestCase(classItem, selectedSection.id, lesson)}
                                                                classItem={classItem}
                                                                judgeLanguages={judgeLanguages}
                                                                lesson={lesson}
                                                                removeTestCase={(testCaseId) => removeCodeTestCase(classItem, selectedSection.id, lesson, testCaseId)}
                                                                sectionId={selectedSection.id}
                                                                setActiveFile={(fileKey) => setActiveCodeFileByLesson((current) => ({ ...current, [lesson.id]: fileKey }))}
                                                                updateField={updateLessonItemField}
                                                                updateMode={updateCodeMode}
                                                                updateStarterFile={updateStarterFile}
                                                                updateTestCase={(testCaseId, patch) => updateCodeTestCase(classItem, selectedSection.id, lesson, testCaseId, patch)}
                                                            />
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </article>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={styles.lessonEmptyCanvas}>
                                        <strong>Chưa có bài học trong {selectedSection?.title ?? 'chương này'}</strong>
                                        <span>Chọn một loại nội dung phía trên để thêm Text, Video, PDF, Code, trắc nghiệm hoặc tự luận.</span>
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                </div>
            );
        }

        const gradebook = workspaceGradebooks[classItem.publicId];
        const assessments = gradedAssessmentsByClass[classItem.publicId] ?? [];
        const attempts = workspaceAttempts[classItem.publicId] ?? [];
        const categoryLabelMap = { ASSIGNMENT: 'Bài tập', QUIZ: 'Bài kiểm tra', MIDTERM: 'Giữa kỳ', FINAL: 'Cuối kỳ' };
        const attemptStatusLabels = {
            IN_PROGRESS: 'Đang làm', SUBMITTED: 'Đã nộp', PENDING_GRADING: 'Chờ chấm',
            GRADED: 'Đã chấm', AUTO_SUBMITTED: 'Tự động nộp'
        };

        if (isWorkspaceOperationsLoading && !gradebook && !assessments.length) {
            return <section className={styles.classWorkspacePanel}><FiRefreshCcw /><span>Đang tải dữ liệu lớp...</span></section>;
        }

        if (classWorkspaceTab === 'students') {
            const rows = gradebook?.students ?? [];
            return (
                <section className={styles.workspaceDataSection}>
                    <div className={styles.workspaceSectionHeading}><div><p className={ui.eyebrow}>Danh sách lớp</p><h3>{rows.length} sinh viên đang học</h3></div></div>
                    <div className={ui.responsiveTable}><table className={styles.table}><thead><tr><th>Sinh viên</th><th>Điểm tạm tính</th><th>Điểm công bố</th><th>Trạng thái</th></tr></thead><tbody>{rows.map((row) => <tr key={row.enrollmentPublicId}><td><strong>{row.student?.fullName}</strong><span>{row.student?.code}</span></td><td>{row.calculatedScore ?? '-'}</td><td>{row.savedFinalScore ?? '-'}</td><td><StatusPill value={row.passed ? 'Đạt' : 'Có nguy cơ'} status={row.passed ? 'ACTIVE' : 'REJECTED'} /></td></tr>)}</tbody></table></div>
                    {!rows.length ? <div className={styles.emptyState}>Lớp chưa có sinh viên đang học.</div> : null}
                </section>
            );
        }

        if (classWorkspaceTab === 'quizzes' || classWorkspaceTab === 'exams') {
            const targetCategories = classWorkspaceTab === 'quizzes' ? ['ASSIGNMENT', 'QUIZ'] : ['MIDTERM', 'FINAL'];
            const items = assessments.filter((item) => targetCategories.includes(item.category));
            return (
                <section className={styles.workspaceDataSection}>
                    <div className={styles.workspaceSectionHeading}><div><p className={ui.eyebrow}>{classWorkspaceTab === 'quizzes' ? 'Đánh giá định kỳ' : 'Giữa kỳ và cuối kỳ'}</p><h3>{classWorkspaceTab === 'quizzes' ? 'Bài tập và bài kiểm tra' : 'Quản lý bài thi'}</h3></div><button className={ui.primaryButton} type="button" onClick={() => setClassWorkspaceTab('learningModules')}><FiPlus /> Tạo trong Chương & bài học</button></div>
                    <div className={styles.workspaceAssessmentList}>{items.map((assessment) => {
                        const assessmentAttempts = attempts.filter((attempt) => attempt.assessment?.publicId === assessment.publicId);
                        return <article key={assessment.publicId}><div className={styles.workspaceAssessmentIcon}>{classWorkspaceTab === 'exams' ? <FiAward /> : <FiFileText />}</div><div><span>{categoryLabelMap[assessment.category]}</span><h4>{assessment.title}</h4><small>Mở {formatDateTime(assessment.openAt)} · Đóng {formatDateTime(assessment.closeAt)}</small></div><dl><div><dt>Câu hỏi</dt><dd>{assessment._count?.questions ?? 0}</dd></div><div><dt>Lượt làm</dt><dd>{assessmentAttempts.length}</dd></div><div><dt>Trạng thái</dt><dd>{assessment.isPublished ? 'Đã công bố' : 'Bản nháp'}</dd></div></dl></article>;
                    })}</div>
                    {!items.length ? <div className={styles.emptyState}>Chưa có {classWorkspaceTab === 'quizzes' ? 'bài tập hoặc bài kiểm tra' : 'bài thi'} trong lớp.</div> : null}
                </section>
            );
        }

        if (classWorkspaceTab === 'grading') {
            const gradingRows = attempts.flatMap((attempt) => (attempt.answers ?? [])
                .filter((answer) => ['ESSAY', 'HTML_CSS', 'CODE'].includes(answer.question?.type))
                .map((answer) => ({ attempt, answer })));
            const violationAttempts = attempts.filter((attempt) => (attempt.violations?.length ?? attempt.violationCount ?? 0) > 0);
            return (
                <section className={styles.workspaceDataSection}>
                    <div className={styles.workspaceSectionHeading}><div><p className={ui.eyebrow}>Bài làm sinh viên</p><h3>Chấm tự luận và xem kết quả Code</h3></div><button className={ui.secondaryButton} type="button" onClick={() => loadClassWorkspaceOperations(classItem)}><FiRefreshCcw /> Tải lại</button></div>
                    <section className={styles.workspaceViolationReview}>
                        <header>
                            <div><FiAlertTriangle /><span><strong>Nhật ký dấu hiệu rời trang</strong><small>Dữ liệu hỗ trợ giảng viên xem xét, không phải bằng chứng tuyệt đối.</small></span></div>
                            <StatusPill value={`${violationAttempts.length} lượt làm`} status={violationAttempts.length ? 'PENDING' : 'ACTIVE'} />
                        </header>
                        {violationAttempts.length ? (
                            <div className={styles.workspaceViolationList}>
                                {violationAttempts.map((attempt) => (
                                    <article key={attempt.publicId}>
                                        <div>
                                            <span>{attempt.student?.code ?? '-'}</span>
                                            <strong>{attempt.student?.fullName ?? 'Sinh viên'}</strong>
                                            <small>{attempt.assessment?.title ?? 'Bài đánh giá'} · {attemptStatusLabels[attempt.status] ?? attempt.status}</small>
                                        </div>
                                        <ol>
                                            {(attempt.violations ?? []).map((violation, index) => (
                                                <li key={violation.id ?? `${attempt.publicId}-${index}`}>
                                                    <FiAlertTriangle />
                                                    <span><strong>{violationTypeLabels[violation.type] ?? violation.type}</strong><small>{formatDateTime(violation.createdAt)}</small></span>
                                                </li>
                                            ))}
                                            {!attempt.violations?.length ? <li><FiAlertTriangle /><span><strong>{attempt.violationCount} dấu hiệu đã ghi nhận</strong><small>BE chưa trả chi tiết nhật ký.</small></span></li> : null}
                                        </ol>
                                    </article>
                                ))}
                            </div>
                        ) : <div className={styles.emptyState}>Chưa ghi nhận dấu hiệu rời trang trong các lượt làm.</div>}
                    </section>
                    <div className={styles.workspaceGradingList}>{gradingRows.map(({ attempt, answer }) => {
                        const draft = workspaceGradeDrafts[answer.id] ?? {};
                        return <article key={answer.id}><header><div><span>{attempt.assessment?.title} · {attempt.student?.code}</span><h4>{attempt.student?.fullName}</h4><small>{attemptStatusLabels[attempt.status] ?? attempt.status} · {attempt.violationCount ?? 0} vi phạm</small></div><StatusPill value={answer.awardedPoints == null ? 'Chưa chấm' : `${answer.awardedPoints}/${answer.question?.points} điểm`} status={answer.awardedPoints == null ? 'PENDING' : 'ACTIVE'} /></header><div className={styles.workspaceAnswerGrid}><section><strong>Đề bài</strong><div className={styles.workspaceQuestionContent} dangerouslySetInnerHTML={{ __html: answer.question?.content ?? '' }} />{answer.sourceCode ? <pre>{answer.sourceCode}</pre> : <p>{answer.textAnswer || 'Sinh viên chưa nhập câu trả lời.'}</p>}{answer.question?.type === 'CODE' ? <div className={styles.judgeSummary}><span><FiCode /> {answer.judgeStatus ?? 'Chưa chấm tự động'}</span>{answer.stdout ? <pre>{answer.stdout}</pre> : null}{answer.stderr || answer.compileOutput ? <pre className={styles.judgeError}>{answer.stderr || answer.compileOutput}</pre> : null}</div> : null}</section><section className={styles.workspaceGradeForm}><label>Điểm / {answer.question?.points}<input type="number" min="0" max={answer.question?.points} step="0.25" value={draft.points ?? answer.awardedPoints ?? ''} onChange={(event) => setWorkspaceGradeDrafts((current) => ({ ...current, [answer.id]: { ...current[answer.id], points: event.target.value } }))} /></label><label>Nhận xét<textarea value={draft.feedback ?? answer.feedback ?? ''} onChange={(event) => setWorkspaceGradeDrafts((current) => ({ ...current, [answer.id]: { ...current[answer.id], feedback: event.target.value } }))} /></label><button className={ui.primaryButton} type="button" disabled={savingWorkspaceAnswerId === answer.id} onClick={() => gradeWorkspaceAnswer(classItem, answer)}><FiSave /> Lưu điểm</button></section></div></article>;
                    })}</div>
                    {!gradingRows.length ? <div className={styles.emptyState}>Chưa có bài tự luận hoặc Code cần xem.</div> : null}
                </section>
            );
        }

        if (classWorkspaceTab === 'grades') {
            const rows = gradebook?.students ?? [];
            return (
                <section className={styles.workspaceDataSection}>
                    <div className={styles.workspaceSectionHeading}><div><p className={ui.eyebrow}>Gradebook</p><h3>Bảng điểm lớp</h3></div><div className={ui.toolbar}><button className={ui.secondaryButton} type="button" disabled title="BE chưa có API gửi bảng điểm cho Trưởng bộ môn"><FiSend /> Gửi bảng điểm</button><button className={ui.primaryButton} type="button" disabled={!gradebook?.canFinalize} onClick={async () => { if (!window.confirm('Tổng kết điểm lớp này?')) return; try { await adminModulesApi.finalizeClass(classItem.publicId); toast.success('Đã tổng kết điểm lớp'); await loadClassWorkspaceOperations(classItem); } catch (error) { toast.error(getApiMessage(error, 'Chưa thể tổng kết điểm')); } }}><FiAward /> Tổng kết</button></div></div>
                    <div className={ui.responsiveTable}><table className={styles.table}><thead><tr><th>Sinh viên</th><th>Bài tập</th><th>Kiểm tra</th><th>Giữa kỳ</th><th>Cuối kỳ</th><th>Tổng kết</th></tr></thead><tbody>{rows.map((row) => <tr key={row.enrollmentPublicId}><td><strong>{row.student?.fullName}</strong><span>{row.student?.code}</span></td><td>{getCategoryScoreValue(row, 'ASSIGNMENT')}</td><td>{getCategoryScoreValue(row, 'QUIZ')}</td><td>{getCategoryScoreValue(row, 'MIDTERM')}</td><td>{getCategoryScoreValue(row, 'FINAL')}</td><td><strong>{row.savedFinalScore ?? row.calculatedScore ?? '-'}</strong></td></tr>)}</tbody></table></div>
                    {gradebook?.blockers?.length ? <div className={styles.workspaceBlockers}>{gradebook.blockers.map((item) => <span key={item}><FiAlertTriangle /> {item}</span>)}</div> : null}
                </section>
            );
        }

        if (classWorkspaceTab === 'stats') {
            const rows = gradebook?.students ?? [];
            const scores = rows.map((row) => Number(row.calculatedScore)).filter(Number.isFinite);
            const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
            const submittedAttempts = attempts.filter((attempt) => attempt.status !== 'IN_PROGRESS');
            const violationCount = attempts.reduce((sum, attempt) => sum + Number(attempt.violationCount ?? 0), 0);
            const lateCount = attempts.filter((attempt) => attempt.submittedAt && attempt.assessment?.closeAt && new Date(attempt.submittedAt) > new Date(attempt.assessment.closeAt)).length;
            const atRisk = rows.filter((row) => row.passed === false);
            return <section className={styles.workspaceDataSection}><div className={styles.workspaceSectionHeading}><div><p className={ui.eyebrow}>Phân tích học tập</p><h3>Thống kê lớp</h3></div></div><div className={styles.workspaceMetricGrid}><article><FiUsers /><span>Sinh viên</span><strong>{rows.length}</strong></article><article><FiBarChart2 /><span>Điểm trung bình</span><strong>{average.toFixed(2)}</strong></article><article><FiAward /><span>Cao nhất / thấp nhất</span><strong>{scores.length ? `${Math.max(...scores)} / ${Math.min(...scores)}` : '-'}</strong></article><article><FiAlertTriangle /><span>Nguy cơ trượt</span><strong>{atRisk.length}</strong></article><article><FiCheckSquare /><span>Lượt đã nộp</span><strong>{submittedAttempts.length}</strong></article><article><FiClock /><span>Vi phạm / nộp muộn</span><strong>{violationCount} / {lateCount}</strong></article></div>{atRisk.length ? <div className={styles.workspaceRiskList}>{atRisk.map((row) => <div key={row.enrollmentPublicId}><span>{row.student?.code}</span><strong>{row.student?.fullName}</strong><small>Điểm tạm tính {row.calculatedScore}</small></div>)}</div> : null}</section>;
        }

        const tabEmptyText = {
            students: 'Danh sách sinh viên đăng ký lớp sẽ hiển thị tại đây.',
            grades: 'Bảng điểm và trạng thái khóa điểm của lớp sẽ hiển thị tại đây.',
            stats: 'Thống kê tiến độ, sĩ số và kết quả học tập sẽ hiển thị tại đây.'
        };

        return (
            <section className={styles.classWorkspacePanel}>
                <strong>{activeClassWorkspaceTabs.find((tab) => tab.key === classWorkspaceTab)?.label}</strong>
                <span>{tabEmptyText[classWorkspaceTab] ?? 'Chưa có dữ liệu để hiển thị.'}</span>
            </section>
        );
    };

    if (classPublicId) {
        return (
            <div className={classNames(ui.pageStack, styles.classWorkspacePage)}>
                <section className={styles.classWorkspaceHero}>
                    <div className={styles.classWorkspaceTitle}>
                        <div className={ui.moduleHeaderIcon}>
                            <FiBriefcase />
                        </div>
                        <div>
                            <p className={ui.eyebrow}>Không gian quản trị lớp</p>
                            <h2>{workspaceClass ? `${workspaceClass.code} - ${workspaceClass.name}` : 'Lớp học'}</h2>
                            <p>Quản trị nội dung, sinh viên, đánh giá, điểm và thông báo của lớp.</p>
                        </div>
                    </div>
                    <button className={ui.secondaryButton} type="button" onClick={() => navigate(user?.role === userRoles.LECTURER ? '/lecturer/classes' : '/classes')}>
                        Quay lại danh sách lớp
                    </button>
                </section>

                {loading ? (
                    <div className={classNames(ui.infoPanel, styles.emptyState)}>Đang tải dữ liệu lớp...</div>
                ) : null}

                {!loading && !workspaceClass ? (
                    <div className={classNames(ui.infoPanel, styles.emptyState)}>Không tìm thấy lớp học phù hợp với quyền hiện tại.</div>
                ) : null}

                {workspaceClass ? (
                    <section className={styles.classWorkspaceShell}>
                        <div className={styles.classWorkspaceHeader}>
                            <div>
                                <span>Trạng thái lớp</span>
                                <StatusPill value={classStatusLabels[workspaceClass.status] ?? workspaceClass.status} status={workspaceClass.status} />
                            </div>
                            <div>
                                <span>Quyền hiện tại</span>
                                <strong>{roleLabels[user?.role] ?? user?.role ?? '-'}</strong>
                            </div>
                        </div>
                        <div className={styles.classWorkspaceTabs}>
                            <div className={styles.tabs}>
                                {activeClassWorkspaceTabs.map((tab) => (
                                    <button
                                        className={classNames(styles.tabButton, { [styles.tabButtonActive]: classWorkspaceTab === tab.key })}
                                        type="button"
                                        key={tab.key}
                                        onClick={() => setClassWorkspaceTab(tab.key)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {renderClassWorkspaceContent(workspaceClass)}
                    </section>
                ) : null}
            </div>
        );
    }

    return (
        <div className={ui.pageStack}>
            <section className={ui.moduleHeader}>
                <div className={ui.moduleHeaderIcon}>
                    <Icon />
                </div>
                <div>
                    <p className={ui.eyebrow}>Admin</p>
                    <h2>{meta.label}</h2>
                    <p>{meta.description}</p>
                </div>
            </section>

            <section className={styles.cardGrid}>
                {metrics.map((metric) => (
                    <article className={styles.metricCard} key={metric.label}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                    </article>
                ))}
            </section>

            <section className={ui.toolbar}>
                <button className={ui.secondaryButton} type="button" onClick={loadData} disabled={loading}>
                    <FiRefreshCcw /> Tải lại dữ liệu
                </button>
            </section>

            {(moduleKey === 'subjectProposals' || moduleKey === 'approvals') && canCreateSubjectProposal ? (
                <section className={ui.toolbar}>
                    <button className={ui.primaryButton} type="button" onClick={openCreateSubjectProposal}>
                        <FiPlus /> Tạo đề xuất môn
                    </button>
                </section>
            ) : null}

            {(moduleKey === 'subjects' || moduleKey === 'reports') && (
                <>
                    <section className={ui.tablePanel}>
                        <div className={ui.sectionHeading}>
                            <div>
                                <p className={ui.eyebrow}>Môn học</p>
                                <h3>{filteredSubjects.length} {[userRoles.ADMIN, userRoles.PRINCIPAL, userRoles.TRAINING_OFFICER].includes(currentUserRole) ? 'môn học công khai/lưu trữ' : 'môn học đã phê duyệt'}</h3>
                            </div>
                        </div>
                        <div className={styles.toolbarGrid}>
                            <label className={ui.field}>
                                Tìm kiếm
                                <input
                                    className={ui.plainInput}
                                    value={subjectFilters.search}
                                    onChange={(event) => updateSubjectFilter({ search: event.target.value })}
                                    placeholder="Mã môn, tên môn, bộ môn"
                                />
                            </label>
                            <label className={ui.field}>
                                Bộ môn
                                <select className={styles.select} value={subjectFilters.departmentPublicId} onChange={(event) => updateSubjectFilter({ departmentPublicId: event.target.value })}>
                                    <option value="ALL">Tất cả bộ môn</option>
                                    {subjectDepartmentOptions.map((department) => (
                                        <option key={department.publicId} value={department.publicId}>
                                            {department.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className={ui.field}>
                                Lớp học
                                <select className={styles.select} value={subjectFilters.classState} onChange={(event) => updateSubjectFilter({ classState: event.target.value })}>
                                    <option value="ALL">Tất cả</option>
                                    <option value="HAS_CLASS">Đã có lớp</option>
                                    <option value="NO_CLASS">Chưa có lớp</option>
                                </select>
                            </label>
                            <div className={styles.filterAction}>
                                <button className={ui.secondaryButton} type="button" onClick={() => updateSubjectFilter({ search: '', departmentPublicId: 'ALL', classState: 'ALL' })}>
                                    Xóa bộ lọc
                                </button>
                            </div>
                            <div className={styles.toolbarWide}>
                                <div className={styles.inlineActions}>
                                    <button className={ui.secondaryButton} type="button" onClick={exportSubjects} disabled={!filteredSubjects.length}>
                                        <FiDownload /> Xuất dữ liệu
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className={ui.responsiveTable}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Mã môn</th>
                                        <th>Tên môn</th>
                                        <th>Bộ môn</th>
                                        <th>Tín chỉ</th>
                                        <th>Số lượng lớp</th>
                                        <th>Trạng thái</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedSubjects.map((subject) => (
                                        <tr key={subject.publicId} onClick={() => setSelectedSubject(subject)}>
                                            <td><strong>{subject.code}</strong></td>
                                            <td>{subject.name}</td>
                                            <td>{subject.department?.name ?? '-'}</td>
                                            <td>{subject.credits}</td>
                                            <td>{subjectClassCounts.get(subject.publicId) ?? 0}</td>
                                            <td>
                                                <StatusPill
                                                    status={subject.status}
                                                    value={
                                                        subjectStatusLabels[subject.status]
                                                        ?? subject.status
                                                        ?? (subject.isActive === false ? 'Ngừng hoạt động' : 'Đang hoạt động')
                                                    }
                                                />
                                            </td>
                                            <td>{renderSubjectActions(subject)}</td>
                                        </tr>
                                    ))}
                                    {!loading && !paginatedSubjects.length ? (
                                        <tr>
                                            <td colSpan="7" className={styles.emptyCell}>
                                                Không có môn học phù hợp với bộ lọc hiện tại.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                        <div className={styles.pagination}>
                            <span>
                                Hiển thị {subjectFirstRecord}-{subjectLastRecord} / {filteredSubjects.length}
                            </span>
                            <label className={styles.paginationPageSize}>
                                Số dòng
                                <select className={styles.select} value={subjectFilters.pageSize} onChange={(event) => updateSubjectFilter({ pageSize: Number(event.target.value) })}>
                                    {[10, 20, 50, 100].map((size) => (
                                        <option key={size} value={size}>
                                            {size}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className={styles.paginationControls}>
                                <button
                                    className={`${ui.secondaryButton} ${styles.paginationIconButton}`}
                                    type="button"
                                    onClick={() => updateSubjectFilter({ page: Math.max(1, subjectCurrentPage - 1) })}
                                    disabled={loading || subjectCurrentPage <= 1}
                                    aria-label="Trang trước"
                                    title="Trang trước"
                                >
                                    <FiChevronLeft />
                                </button>
                                <strong>
                                    Trang {subjectCurrentPage} / {subjectTotalPages}
                                </strong>
                                <button
                                    className={`${ui.secondaryButton} ${styles.paginationIconButton}`}
                                    type="button"
                                    onClick={() => updateSubjectFilter({ page: Math.min(subjectTotalPages, subjectCurrentPage + 1) })}
                                    disabled={loading || subjectCurrentPage >= subjectTotalPages}
                                    aria-label="Trang sau"
                                    title="Trang sau"
                                >
                                    <FiChevronRight />
                                </button>
                            </div>
                        </div>
                    </section>

                </>
            )}

            {(moduleKey === 'classes' || moduleKey === 'enrollments' || moduleKey === 'reports') && (
                <section className={ui.tablePanel}>
                    <div className={ui.sectionHeading}>
                        <div>
                            <p className={ui.eyebrow}>Lớp học</p>
                            <h3>Danh sách lớp và trạng thái đăng ký</h3>
                        </div>
                        {filteredSubjectPublicId ? (
                            <button className={ui.secondaryButton} type="button" onClick={clearClassSubjectFilter}>
                                Bỏ lọc môn: {selectedClassSubject?.code ?? 'Đang chọn'}
                            </button>
                        ) : null}
                    </div>
                    <div className={styles.tabs} role="tablist" aria-label="Lọc lớp theo trạng thái vận hành">
                        <button
                            className={classNames(styles.tabButton, { [styles.tabButtonActive]: classListTab === 'ACTIVE' })}
                            type="button"
                            role="tab"
                            aria-selected={classListTab === 'ACTIVE'}
                            onClick={() => updateClassListTab('ACTIVE')}
                        >
                            Đang vận hành ({classListCounts.ACTIVE})
                        </button>
                        <button
                            className={classNames(styles.tabButton, { [styles.tabButtonActive]: classListTab === 'COMPLETED' })}
                            type="button"
                            role="tab"
                            aria-selected={classListTab === 'COMPLETED'}
                            onClick={() => updateClassListTab('COMPLETED')}
                        >
                            Đã hoàn thành ({classListCounts.COMPLETED})
                        </button>
                        {classListCounts.CANCELLED || classListTab === 'CANCELLED' ? (
                            <button
                                className={classNames(styles.tabButton, { [styles.tabButtonActive]: classListTab === 'CANCELLED' })}
                                type="button"
                                role="tab"
                                aria-selected={classListTab === 'CANCELLED'}
                                onClick={() => updateClassListTab('CANCELLED')}
                            >
                                Đã hủy ({classListCounts.CANCELLED})
                            </button>
                        ) : null}
                    </div>
                    <div className={ui.responsiveTable}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Lớp</th>
                                    <th>Môn học</th>
                                    <th>Sĩ số</th>
                                    <th>Giảng viên</th>
                                    <th>Trạng thái</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleClasses.map((classItem) => (
                                    <tr key={classItem.publicId}>
                                        <td><strong>{classItem.code}</strong><span>{classItem.name}</span></td>
                                        <td>{classItem.subject?.name ?? '-'}</td>
                                        <td>{classItem.currentStudents ?? 0}/{classItem.maxStudents ?? 0}</td>
                                        <td>{classItem.lecturer?.fullName ?? '-'}</td>
                                        <td><StatusPill value={classStatusLabels[classItem.status] ?? classItem.status} status={classItem.status} /></td>
                                        <td>
                                            <select
                                                className={styles.actionDropdown}
                                                defaultValue=""
                                                onChange={(event) => handleClassAction(event, classItem)}
                                                aria-label="Chọn thao tác lớp học"
                                            >
                                                <option value="" disabled>Thao tác</option>
                                                <option value="detail">Xem chi tiết</option>
                                                <option value="lecturer" disabled={!canAssignLecturer || classItem.status === 'COMPLETED'}>Phân công giảng viên</option>
                                                <option value="registration" disabled={!canConfigureClassRegistration || classItem.status === 'COMPLETED'}>Thiết lập đăng ký</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {!visibleClasses.length ? (
                        <div className={styles.emptyState}>
                            {classListTab === 'COMPLETED'
                                ? 'Chưa có lớp học nào đã hoàn thành.'
                                : classListTab === 'CANCELLED'
                                    ? 'Chưa có lớp học nào đã hủy.'
                                    : 'Không có lớp học đang vận hành phù hợp với bộ lọc hiện tại.'}
                        </div>
                    ) : null}
                </section>
            )}

            {moduleKey === 'classProposals' && (
                <section className={ui.tablePanel}>
                    <div className={ui.sectionHeading}>
                        <div>
                            <p className={ui.eyebrow}>Đề xuất lớp</p>
                            <h3>{subjectsWithoutClasses.length} môn học chưa có lớp</h3>
                        </div>
                    </div>
                    <div className={ui.responsiveTable}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Mã môn</th>
                                    <th>Tên môn</th>
                                    <th>Bộ môn</th>
                                    <th>Tín chỉ</th>
                                    <th>Số lượng lớp</th>
                                    <th>Trạng thái đề xuất lớp</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjectsWithoutClasses.map((subject) => {
                                    const classProposal = classProposalBySubjectPublicId.get(subject.publicId);

                                    return (
                                        <tr key={subject.publicId}>
                                            <td><strong>{subject.code}</strong></td>
                                            <td>{subject.name}</td>
                                            <td>{subject.department?.name ?? '-'}</td>
                                            <td>{subject.credits ?? '-'}</td>
                                            <td>{subjectClassCounts.get(subject.publicId) ?? 0}</td>
                                            <td>
                                                {classProposal ? (
                                                    <StatusPill value={proposalStatusLabels[classProposal.status] ?? classProposal.status} status={classProposal.status} />
                                                ) : (
                                                    <StatusPill value="Chưa đề xuất" status="DRAFT" />
                                                )}
                                            </td>
                                            <td>
                                                {canCreateClassProposal && !classProposal ? (
                                                    <button className={ui.primaryButton} type="button" onClick={() => openClassProposalForSubject(subject)}>
                                                        <FiPlus /> Đề xuất lớp
                                                    </button>
                                                ) : null}
                                                {canGenerateClasses && classProposal?.status === 'APPROVED' && !hasGeneratedClasses(classProposal) ? (
                                                    <button className={ui.primaryButton} type="button" onClick={() => generateClassesFromProposal(classProposal)}>
                                                        Tự sinh lớp theo số lớp dự kiến
                                                    </button>
                                                ) : null}
                                                {classProposal && canReproposeClassProposal(classProposal) ? (
                                                    <button className={ui.primaryButton} type="button" onClick={() => openReproposeClassProposal(classProposal)}>
                                                        Đề xuất lại
                                                    </button>
                                                ) : null}
                                                {!(!classProposal && canCreateClassProposal) && !(classProposal?.status === 'APPROVED' && canGenerateClasses && !hasGeneratedClasses(classProposal)) && !(classProposal && canReproposeClassProposal(classProposal)) ? <span>-</span> : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!subjectsWithoutClasses.length ? (
                                    <tr>
                                        <td colSpan="7" className={styles.emptyCell}>
                                            Không có môn học nào đang có số lượng lớp bằng 0.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
            {(moduleKey === 'approvals' || moduleKey === 'subjectProposals') && (
                <>
                    <section className={ui.tablePanel}>
                        <div className={ui.sectionHeading}>
                            <div>
                                <p className={ui.eyebrow}>{subjectProposalSectionTitle}</p>
                                <h3>{visibleSubjectProposals.length} đề xuất môn học</h3>
                            </div>
                        </div>
                        <div className={ui.responsiveTable}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Mã môn</th>
                                        <th>Tên môn</th>
                                        <th>Bộ môn</th>
                                        <th>Tín chỉ</th>
                                        <th>Số lượng lớp</th>
                                        <th>Trạng thái</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleSubjectProposals.map((proposal) => (
                                        <tr className={styles.subjectProposalRow} key={`subject-${proposal.publicId}`} onClick={() => setSelectedSubjectProposal(proposal)}>
                                            <td>
                                                <strong>{proposal.code ?? '-'}</strong>
                                                <span>{proposal.proposedBy?.fullName ? `Người đề xuất: ${proposal.proposedBy.fullName}` : ''}</span>
                                            </td>
                                            <td className={styles.subjectNameCell}>
                                                <strong>{proposal.name ?? '-'}</strong>
                                                {proposal.rejectionReason ? <span>Lý do: {proposal.rejectionReason}</span> : null}
                                            </td>
                                            <td>{proposal.department?.name ?? '-'}</td>
                                            <td>{proposal.credits ?? '-'}</td>
                                            <td>0</td>
                                            <td><StatusPill value={proposalStatusLabels[proposal.status] ?? proposal.status} status={proposal.status} /></td>
                                            <td>{renderSubjectProposalActionDropdown(proposal)}</td>
                                        </tr>
                                    ))}
                                    {!visibleSubjectProposals.length ? (
                                        <tr>
                                            <td colSpan="7" className={styles.emptyCell}>
                                                {subjectProposalEmptyText}
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {moduleKey === 'approvals' && user?.role !== userRoles.PRINCIPAL ? (
                    <section className={ui.tablePanel}>
                        <div className={ui.sectionHeading}>
                            <div>
                                <p className={ui.eyebrow}>Duyệt đề xuất lớp</p>
                                <h3>{visibleClassProposals.length} đề xuất mở lớp</h3>
                            </div>
                        </div>
                        <div className={ui.responsiveTable}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Mã môn</th>
                                        <th>Tên môn</th>
                                        <th>Người đề xuất</th>
                                        <th>Số lớp</th>
                                        <th>Sĩ số/lớp</th>
                                        <th>Thời gian đăng ký</th>
                                        <th>Trạng thái</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleClassProposals.map((proposal) => (
                                        <tr key={`class-${proposal.publicId}`} onClick={() => setSelectedClassProposal(proposal)}>
                                            <td>
                                                <strong>{proposal.subject?.code ?? '-'}</strong>
                                                {proposal.note ? <span>Ghi chú: {proposal.note}</span> : null}
                                            </td>
                                            <td>
                                                <strong>{proposal.subject?.name ?? 'Môn học'}</strong>
                                                {proposal.rejectionReason ? <span>Lý do: {proposal.rejectionReason}</span> : null}
                                            </td>
                                            <td>{proposal.proposedBy?.fullName ?? '-'}</td>
                                            <td>{proposal.requestedClassCount ?? '-'}</td>
                                            <td>{proposal.maxStudentsPerClass ?? '-'}</td>
                                            <td>
                                                <span>{formatDateTime(proposal.registrationStart)}</span>
                                                <span>{formatDateTime(proposal.registrationEnd)}</span>
                                            </td>
                                            <td><StatusPill value={proposalStatusLabels[proposal.status] ?? proposal.status} status={proposal.status} /></td>
                                            <td>{renderClassProposalActionDropdown(proposal)}</td>
                                        </tr>
                                    ))}
                                    {!visibleClassProposals.length ? (
                                        <tr>
                                            <td colSpan="8" className={styles.emptyCell}>
                                                Chưa có đề xuất mở lớp phù hợp với quyền hiện tại.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </section>
                    ) : null}

                    {moduleKey === 'approvals' && currentUserRole === userRoles.PRINCIPAL ? (
                        <section className={ui.tablePanel}>
                            <div className={ui.sectionHeading}>
                                <div>
                                    <p className={ui.eyebrow}>Khôi phục môn lưu trữ</p>
                                    <h3>{pendingSubjectRestoreRequests.length} yêu cầu chờ duyệt</h3>
                                </div>
                            </div>
                            <div className={ui.responsiveTable}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Mã môn</th>
                                            <th>Tên môn</th>
                                            <th>Người đề nghị</th>
                                            <th>Lý do khôi phục</th>
                                            <th>Ngày gửi</th>
                                            <th>Trạng thái</th>
                                            <th>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingSubjectRestoreRequests.map((request) => (
                                            <tr key={request.publicId}>
                                                <td><strong>{request.subject?.code ?? '-'}</strong></td>
                                                <td>{request.subject?.name ?? '-'}</td>
                                                <td>{request.requestedBy?.fullName ?? '-'}</td>
                                                <td>{request.reason || 'Không có ghi chú'}</td>
                                                <td>{formatDateTime(request.createdAt)}</td>
                                                <td><StatusPill value={restoreRequestStatusLabels[request.status] ?? request.status} status={request.status} /></td>
                                                <td>
                                                    <button className={ui.primaryButton} type="button" onClick={() => openRestoreRequestReview(request)}>
                                                        <FiCheck /> Xử lý
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {!pendingSubjectRestoreRequests.length ? (
                                            <tr>
                                                <td colSpan="7" className={styles.emptyCell}>Chưa có yêu cầu khôi phục môn chờ xử lý.</td>
                                            </tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    ) : null}
                </>
            )}

            {moduleKey === 'approvals' && legacyCombinedApprovalsEnabled && (
                <section className={ui.tablePanel}>
                    <div className={ui.sectionHeading}>
                        <div>
                            <p className={ui.eyebrow}>Phê duyệt</p>
                            <h3>Đề xuất môn học và đề xuất mở lớp</h3>
                        </div>
                    </div>
                    <div className={styles.cardGrid}>
                        {[...data.subjectProposals.map((item) => ({ ...item, kind: 'Môn học' })), ...data.classProposals.map((item) => ({ ...item, kind: 'Lớp học' }))].map((proposal) => (
                            <article className={styles.recordCard} key={`${proposal.kind}-${proposal.publicId}`}>
                                <div className={styles.recordHeader}>
                                    <strong>{proposal.kind}: {proposal.code ?? proposal.subject?.code ?? proposal.name ?? proposal.publicId}</strong>
                                    <StatusPill value={proposalStatusLabels[proposal.status] ?? proposal.status} status={proposal.status} />
                                </div>
                                <span>Người đề xuất: {proposal.proposedBy?.fullName ?? '-'}</span>
                                <span>{proposal.rejectionReason ? `Lý do: ${proposal.rejectionReason}` : 'Chưa có ghi chú từ quy trình duyệt.'}</span>
                                {proposal.kind === 'Môn học' ? renderSubjectProposalActions(proposal) : null}
                                {proposal.kind === 'Lớp học' && canReviewClassProposal && proposal.status === 'PENDING' ? (
                                    <div className={styles.listStack}>
                                        <label className={ui.field}>
                                            Ghi chú/Lý do từ chối
                                            <textarea
                                                className={styles.textarea}
                                                value={reviewDrafts[proposal.publicId]?.reason ?? ''}
                                                onChange={(event) => updateReviewDraft(proposal.publicId, { reason: event.target.value })}
                                            />
                                        </label>
                                        <div className={styles.inlineActions}>
                                            <button className={ui.primaryButton} type="button" onClick={() => reviewClassProposal(proposal, true)}>
                                                Phê duyệt đề xuất lớp
                                            </button>
                                            <button className={`${ui.secondaryButton} ${ui.dangerButton}`} type="button" onClick={() => reviewClassProposal(proposal, false)}>
                                                Từ chối
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                                {proposal.kind === 'Lớp học' && canGenerateClasses && proposal.status === 'APPROVED' && !hasGeneratedClasses(proposal) ? (
                                    <button className={ui.primaryButton} type="button" onClick={() => generateClassesFromProposal(proposal)}>
                                        Tự sinh lớp theo số lớp dự kiến
                                    </button>
                                ) : null}
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {moduleKey === 'settings' && (
                <section className={styles.split}>
                    <form className={ui.sectionBlock} onSubmit={createDepartment}>
                        <div className={ui.sectionHeading}>
                            <div>
                                <p className={ui.eyebrow}>Bộ môn</p>
                                <h3>Tạo phòng ban/bộ môn</h3>
                            </div>
                        </div>
                        <label className={ui.field}>Mã<input className={ui.plainInput} value={departmentForm.code} onChange={(event) => setDepartmentForm({ ...departmentForm, code: event.target.value })} required /></label>
                        <label className={ui.field}>Tên<input className={ui.plainInput} value={departmentForm.name} onChange={(event) => setDepartmentForm({ ...departmentForm, name: event.target.value })} required /></label>
                        <label className={ui.field}>Mô tả<textarea className={styles.textarea} value={departmentForm.description} onChange={(event) => setDepartmentForm({ ...departmentForm, description: event.target.value })} /></label>
                        <button className={ui.primaryButton} type="submit"><FiSave /> Lưu bộ môn</button>
                    </form>
                    <section className={ui.tablePanel}>
                        <div className={ui.sectionHeading}>
                            <div>
                                <p className={ui.eyebrow}>Danh sách</p>
                                <h3>{data.departments.length} phòng ban/bộ môn</h3>
                            </div>
                        </div>
                        <div className={styles.listStack}>
                            {data.departments.map((department) => (
                                <article className={styles.recordCard} key={department.publicId}>
                                    <strong>{department.code} - {department.name}</strong>
                                    <span>{department.description || 'Chưa có mô tả'}</span>
                                    <span>{department.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span>
                                </article>
                            ))}
                        </div>
                    </section>
                </section>
            )}

            {isSubjectProposalModalOpen ? (
                <ModalBackdrop onClose={closeSubjectProposalModal}>
                    <form className={ui.modal} onSubmit={saveSubjectProposal}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>{editingSubjectProposal ? 'Cập nhật bản nháp' : 'Đề xuất môn học mới'}</p>
                                <h3>{editingSubjectProposal ? 'Sửa đề xuất môn' : 'Tạo đề xuất môn'}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={closeSubjectProposalModal} aria-label="Đóng form đề xuất môn">
                                x
                            </button>
                        </div>
                        <div className={ui.modalGrid}>
                            <label className={ui.field}>
                                Mã môn
                                <input className={ui.plainInput} value={subjectProposalForm.code} onChange={(event) => updateSubjectProposalForm('code', event.target.value)} required />
                            </label>
                            <label className={ui.field}>
                                Tên môn
                                <input className={ui.plainInput} value={subjectProposalForm.name} onChange={(event) => updateSubjectProposalForm('name', event.target.value)} required />
                            </label>
                            <label className={ui.field}>
                                Số tín chỉ
                                <input className={ui.plainInput} type="number" min="1" max="10" value={subjectProposalForm.credits} onChange={(event) => updateSubjectProposalForm('credits', event.target.value)} required />
                            </label>
                            <label className={ui.field}>
                                Điểm đạt
                                <input className={ui.plainInput} type="number" min="0" max="10" step="0.1" value={subjectProposalForm.passScore} onChange={(event) => updateSubjectProposalForm('passScore', event.target.value)} />
                            </label>
                            <label className={ui.field}>
                                Tỷ lệ bài tập %
                                <input className={ui.plainInput} type="number" min="0" max="100" value={subjectProposalForm.assignmentWeight} onChange={(event) => updateSubjectProposalForm('assignmentWeight', event.target.value)} required />
                            </label>
                            <label className={ui.field}>
                                Tỷ lệ kiểm tra %
                                <input className={ui.plainInput} type="number" min="0" max="100" value={subjectProposalForm.quizWeight} onChange={(event) => updateSubjectProposalForm('quizWeight', event.target.value)} required />
                            </label>
                            <label className={ui.field}>
                                Tỷ lệ giữa kỳ %
                                <input className={ui.plainInput} type="number" min="0" max="100" value={subjectProposalForm.midtermWeight} onChange={(event) => updateSubjectProposalForm('midtermWeight', event.target.value)} required />
                            </label>
                            <label className={ui.field}>
                                Tỷ lệ cuối kỳ %
                                <input className={ui.plainInput} type="number" min="0" max="100" value={subjectProposalForm.finalWeight} onChange={(event) => updateSubjectProposalForm('finalWeight', event.target.value)} required />
                            </label>
                            <label className={`${ui.field} ${ui.modalFull}`}>
                                Mô tả
                                <textarea className={styles.textarea} value={subjectProposalForm.description} onChange={(event) => updateSubjectProposalForm('description', event.target.value)} />
                            </label>
                        </div>
                        <div className={ui.modalFooter}>
                            <span className={styles.hint}>Tổng tỷ lệ hiện tại: {subjectProposalTotalWeight}%</span>
                            <button className={ui.secondaryButton} type="button" onClick={closeSubjectProposalModal}>
                                Hủy
                            </button>
                            <button className={ui.primaryButton} type="submit">
                                <FiSave /> {editingSubjectProposal ? 'Cập nhật bản nháp' : 'Lưu bản nháp'}
                            </button>
                        </div>
                    </form>
                </ModalBackdrop>
            ) : null}

            {isClassProposalModalOpen ? (
                <ModalBackdrop onClose={() => { setClassProposalModalOpen(false); setEditingClassProposal(null); }}>
                    <form className={ui.modal} onSubmit={createClassProposal}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>Đề xuất mở lớp</p>
                                <h3>{editingClassProposal ? 'Chỉnh sửa thông tin và đề xuất lại' : 'Tạo đề xuất mở lớp sau khi môn đã duyệt'}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={() => { setClassProposalModalOpen(false); setEditingClassProposal(null); }} aria-label="Đóng form đề xuất mở lớp">
                                x
                            </button>
                        </div>
                        <div className={ui.modalGrid}>
                            <label className={ui.field}>
                                Môn học đã duyệt
                                <select className={styles.select} value={classProposalForm.subjectPublicId} onChange={(event) => updateClassProposalForm('subjectPublicId', event.target.value)} required disabled={Boolean(editingClassProposal)}>
                                    <option value="">Chọn môn học</option>
                                    {classProposalSubjectOptions.map((subject) => (
                                        <option key={subject.publicId} value={subject.publicId}>
                                            {subject.code} - {subject.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className={ui.field}>
                                Mở đăng ký
                                <input className={ui.plainInput} type="datetime-local" value={classProposalForm.registrationStart} onChange={(event) => updateClassProposalForm('registrationStart', event.target.value)} required />
                            </label>
                            <label className={ui.field}>
                                Đóng đăng ký
                                <input className={ui.plainInput} type="datetime-local" value={classProposalForm.registrationEnd} onChange={(event) => updateClassProposalForm('registrationEnd', event.target.value)} required />
                            </label>
                            <label className={ui.field}>
                                Số lớp cần mở
                                <input className={ui.plainInput} type="number" min="1" max="20" value={classProposalForm.requestedClassCount} onChange={(event) => updateClassProposalForm('requestedClassCount', event.target.value)} required />
                            </label>
                            <label className={ui.field}>
                                Sĩ số tối đa mỗi lớp
                                <input className={ui.plainInput} type="number" min="1" max="500" value={classProposalForm.maxStudentsPerClass} onChange={(event) => updateClassProposalForm('maxStudentsPerClass', event.target.value)} required />
                            </label>
                            <label className={`${ui.field} ${ui.modalFull}`}>
                                Ghi chú
                                <textarea className={styles.textarea} value={classProposalForm.note} onChange={(event) => updateClassProposalForm('note', event.target.value)} />
                            </label>
                        </div>
                        <div className={ui.modalFooter}>
                            <button className={ui.secondaryButton} type="button" onClick={() => { setClassProposalModalOpen(false); setEditingClassProposal(null); }}>
                                Hủy
                            </button>
                            <button className={ui.primaryButton} type="submit">
                                <FiSave /> {editingClassProposal ? 'Gửi đề xuất lại' : 'Lưu đề xuất'}
                            </button>
                        </div>
                    </form>
                </ModalBackdrop>
            ) : null}

            {selectedSubjectProposal ? (
                <ModalBackdrop onClose={() => setSelectedSubjectProposal(null)}>
                    <section className={ui.modal}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>Chi tiết đề xuất môn</p>
                                <h3>{selectedSubjectProposal.code} - {selectedSubjectProposal.name}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={() => setSelectedSubjectProposal(null)} aria-label="Đóng chi tiết đề xuất môn">
                                x
                            </button>
                        </div>
                        <dl className={styles.detailGrid}>
                            <div className={styles.detailItem}>
                                <dt>Mã định danh</dt>
                                <dd>{selectedSubjectProposal.publicId ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Mã môn</dt>
                                <dd>{selectedSubjectProposal.code ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Tên môn</dt>
                                <dd>{selectedSubjectProposal.name ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Trạng thái</dt>
                                <dd><StatusPill value={proposalStatusLabels[selectedSubjectProposal.status] ?? selectedSubjectProposal.status} status={selectedSubjectProposal.status} /></dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Bộ môn</dt>
                                <dd>{selectedSubjectProposal.department?.name ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Người đề xuất</dt>
                                <dd>{selectedSubjectProposal.proposedBy?.fullName ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Số tín chỉ</dt>
                                <dd>{formatDecimal(selectedSubjectProposal.credits)}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Điểm đạt</dt>
                                <dd>{formatDecimal(selectedSubjectProposal.passScore)}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Bài tập</dt>
                                <dd>{formatDecimal(selectedSubjectProposal.assignmentWeight, '%')}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Kiểm tra</dt>
                                <dd>{formatDecimal(selectedSubjectProposal.quizWeight, '%')}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Giữa kỳ</dt>
                                <dd>{formatDecimal(selectedSubjectProposal.midtermWeight, '%')}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Cuối kỳ</dt>
                                <dd>{formatDecimal(selectedSubjectProposal.finalWeight, '%')}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Ngày tạo</dt>
                                <dd>{formatDateTime(selectedSubjectProposal.createdAt)}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Cập nhật gần nhất</dt>
                                <dd>{formatDateTime(selectedSubjectProposal.updatedAt)}</dd>
                            </div>
                            <div className={`${styles.detailItem} ${styles.detailWide}`}>
                                <dt>Mô tả</dt>
                                <dd>{selectedSubjectProposal.description || '-'}</dd>
                            </div>
                            {selectedSubjectProposal.rejectionReason ? (
                                <div className={`${styles.detailItem} ${styles.detailWide}`}>
                                    <dt>Lý do từ chối</dt>
                                    <dd>{selectedSubjectProposal.rejectionReason}</dd>
                                </div>
                            ) : null}
                        </dl>
                        <div className={ui.modalFooter}>
                            {renderSubjectProposalActions(selectedSubjectProposal, { layout: 'detail' })}
                        </div>
                    </section>
                </ModalBackdrop>
            ) : null}

            {selectedClassAction ? (
                <ModalBackdrop onClose={closeClassActionModal}>
                    <section className={classNames(ui.modal, classActionMode === 'detail' && styles.classWorkspaceModal)}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>{classActionMode === 'detail' ? 'Không gian quản trị lớp' : 'Thao tác lớp học'}</p>
                                <h3>{selectedClassAction.code} - {selectedClassAction.name}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={closeClassActionModal} aria-label="Đóng thao tác lớp học">
                                x
                            </button>
                        </div>

                        {classActionMode === 'detail' ? (
                            <>
                                <div className={styles.classWorkspaceHeader}>
                                    <div>
                                        <span>Trạng thái lớp</span>
                                        <StatusPill value={classStatusLabels[selectedClassAction.status] ?? selectedClassAction.status} status={selectedClassAction.status} />
                                    </div>
                                    <div>
                                        <span>Quyền hiện tại</span>
                                        <strong>{roleLabels[user?.role] ?? user?.role ?? '-'}</strong>
                                    </div>
                                </div>
                                <div className={styles.tabs}>
                                    {activeClassWorkspaceTabs.map((tab) => (
                                        <button
                                            className={classNames(styles.tabButton, { [styles.tabButtonActive]: classWorkspaceTab === tab.key })}
                                            type="button"
                                            key={tab.key}
                                            onClick={() => setClassWorkspaceTab(tab.key)}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                {renderClassWorkspaceContent()}
                            </>
                        ) : null}

                        {classActionMode === 'lecturer' ? (
                            <div className={ui.modalGrid}>
                                <label className={`${ui.field} ${ui.modalFull}`}>
                                    Giảng viên phụ trách
                                    <select
                                        className={styles.select}
                                        value={classDrafts[selectedClassAction.publicId]?.lecturerPublicId ?? selectedClassAction.lecturer?.publicId ?? ''}
                                        onChange={(event) => updateClassDraft(selectedClassAction.publicId, { lecturerPublicId: event.target.value })}
                                    >
                                        <option value="">Chọn giảng viên</option>
                                        {!getAssignableLecturers(selectedClassAction).length ? (
                                            <option value="" disabled>Chưa tải được danh sách giảng viên</option>
                                        ) : null}
                                        {getAssignableLecturers(selectedClassAction).map((lecturer) => (
                                            <option key={lecturer.publicId} value={lecturer.publicId}>
                                                {lecturer.fullName} - {lecturer.email}
                                            </option>
                                        ))}
                                    </select>
                                    {lecturerLoadError ? <span className={styles.hint}>{lecturerLoadError}</span> : null}
                                </label>
                            </div>
                        ) : null}

                        {classActionMode === 'registration' ? (
                            <div className={ui.modalGrid}>
                                <label className={ui.field}>
                                    Mở đăng ký
                                    <input
                                        className={ui.plainInput}
                                        type="datetime-local"
                                        value={classDrafts[selectedClassAction.publicId]?.registrationStart ?? toDateTimeInput(selectedClassAction.registrationStart)}
                                        onChange={(event) => updateClassDraft(selectedClassAction.publicId, { registrationStart: event.target.value })}
                                    />
                                </label>
                                <label className={ui.field}>
                                    Đóng đăng ký
                                    <input
                                        className={ui.plainInput}
                                        type="datetime-local"
                                        value={classDrafts[selectedClassAction.publicId]?.registrationEnd ?? toDateTimeInput(selectedClassAction.registrationEnd)}
                                        onChange={(event) => updateClassDraft(selectedClassAction.publicId, { registrationEnd: event.target.value })}
                                    />
                                </label>
                                <label className={`${ui.field} ${ui.modalFull}`}>
                                    Trạng thái lớp
                                    <select
                                        className={styles.select}
                                        value={classDrafts[selectedClassAction.publicId]?.status ?? selectedClassAction.status ?? ''}
                                        onChange={(event) => updateClassDraft(selectedClassAction.publicId, { status: event.target.value })}
                                    >
                                        {statusOptions.map((status) => <option value={status} key={status}>{classStatusLabels[status] ?? status}</option>)}
                                    </select>
                                </label>
                            </div>
                        ) : null}

                        <div className={ui.modalFooter}>
                            <button className={ui.secondaryButton} type="button" onClick={closeClassActionModal}>
                                Hủy
                            </button>
                            {classActionMode === 'lecturer' ? (
                                <button
                                    className={ui.primaryButton}
                                    type="button"
                                    onClick={() => assignClassLecturer(selectedClassAction, classDrafts[selectedClassAction.publicId]?.lecturerPublicId ?? selectedClassAction.lecturer?.publicId ?? '')}
                                >
                                    <FiSave /> Lưu phân công
                                </button>
                            ) : null}
                            {classActionMode === 'registration' ? (
                                <button className={ui.primaryButton} type="button" onClick={() => saveClassRegistration(selectedClassAction)}>
                                    <FiSave /> Lưu thiết lập
                                </button>
                            ) : null}
                        </div>
                    </section>
                </ModalBackdrop>
            ) : null}

            {selectedClassProposal ? (
                <ModalBackdrop onClose={() => setSelectedClassProposal(null)}>
                    <section className={ui.modal}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>Chi tiết đề xuất lớp</p>
                                <h3>{selectedClassProposal.subject?.code ?? 'Môn học'} - {selectedClassProposal.subject?.name ?? 'Đề xuất mở lớp'}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={() => setSelectedClassProposal(null)} aria-label="Đóng chi tiết đề xuất lớp">
                                x
                            </button>
                        </div>
                        <dl className={styles.detailGrid}>
                            <div className={styles.detailItem}>
                                <dt>Mã định danh</dt>
                                <dd>{selectedClassProposal.publicId ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Mã môn</dt>
                                <dd>{selectedClassProposal.subject?.code ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Tên môn</dt>
                                <dd>{selectedClassProposal.subject?.name ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Trạng thái</dt>
                                <dd><StatusPill value={proposalStatusLabels[selectedClassProposal.status] ?? selectedClassProposal.status} status={selectedClassProposal.status} /></dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Người đề xuất</dt>
                                <dd>{selectedClassProposal.proposedBy?.fullName ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Người duyệt</dt>
                                <dd>{selectedClassProposal.reviewedBy?.fullName ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Số lớp dự kiến</dt>
                                <dd>{formatDecimal(selectedClassProposal.requestedClassCount)}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Sĩ số tối đa/lớp</dt>
                                <dd>{formatDecimal(selectedClassProposal.maxStudentsPerClass)}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Mở đăng ký</dt>
                                <dd>{formatDateTime(selectedClassProposal.registrationStart)}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Đóng đăng ký</dt>
                                <dd>{formatDateTime(selectedClassProposal.registrationEnd)}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Ngày tạo</dt>
                                <dd>{formatDateTime(selectedClassProposal.createdAt)}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Ngày duyệt</dt>
                                <dd>{formatDateTime(selectedClassProposal.reviewedAt)}</dd>
                            </div>
                            <div className={`${styles.detailItem} ${styles.detailWide}`}>
                                <dt>Ghi chú đề xuất</dt>
                                <dd>{selectedClassProposal.note || '-'}</dd>
                            </div>
                            {selectedClassProposal.rejectionReason ? (
                                <div className={`${styles.detailItem} ${styles.detailWide}`}>
                                    <dt>Lý do từ chối</dt>
                                    <dd>{selectedClassProposal.rejectionReason}</dd>
                                </div>
                            ) : null}
                        </dl>
                        <div className={ui.modalFooter}>
                            {renderClassProposalActions(selectedClassProposal, { layout: 'detail' })}
                        </div>
                    </section>
                </ModalBackdrop>
            ) : null}

            {restoreSubject ? (
                <ModalBackdrop onClose={closeSubjectRestoreRequest}>
                    <form className={ui.modal} onSubmit={submitSubjectRestoreRequest}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>Đề nghị khôi phục môn</p>
                                <h3>{restoreSubject.code} - {restoreSubject.name}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={closeSubjectRestoreRequest} aria-label="Đóng yêu cầu khôi phục">
                                x
                            </button>
                        </div>
                        <div className={ui.infoPanel}>
                            Môn đang ở trạng thái lưu trữ. Yêu cầu này sẽ được gửi lên Hiệu trưởng để xét duyệt chuyển lại sang công khai.
                        </div>
                        <label className={ui.field}>
                            Lý do cần khôi phục
                            <textarea
                                className={styles.textarea}
                                value={restoreReason}
                                onChange={(event) => setRestoreReason(event.target.value)}
                                placeholder="Nhập lý do cần mở lại môn học..."
                                maxLength="2000"
                            />
                        </label>
                        <div className={ui.modalFooter}>
                            <button className={ui.secondaryButton} type="button" onClick={closeSubjectRestoreRequest} disabled={isRestoreSubmitting}>
                                Hủy
                            </button>
                            <button className={ui.primaryButton} type="submit" disabled={isRestoreSubmitting}>
                                <FiSend /> {isRestoreSubmitting ? 'Đang gửi...' : 'Gửi Hiệu trưởng duyệt'}
                            </button>
                        </div>
                    </form>
                </ModalBackdrop>
            ) : null}

            {selectedRestoreRequest ? (
                <ModalBackdrop onClose={closeRestoreRequestReview}>
                    <section className={ui.modal}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>Duyệt khôi phục môn</p>
                                <h3>{selectedRestoreRequest.subject?.code} - {selectedRestoreRequest.subject?.name}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={closeRestoreRequestReview} aria-label="Đóng duyệt khôi phục môn">
                                x
                            </button>
                        </div>
                        <dl className={styles.detailGrid}>
                            <div className={styles.detailItem}>
                                <dt>Người đề nghị</dt>
                                <dd>{selectedRestoreRequest.requestedBy?.fullName ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Ngày gửi</dt>
                                <dd>{formatDateTime(selectedRestoreRequest.createdAt)}</dd>
                            </div>
                            <div className={`${styles.detailItem} ${styles.detailWide}`}>
                                <dt>Lý do khôi phục</dt>
                                <dd>{selectedRestoreRequest.reason || 'Không có ghi chú'}</dd>
                            </div>
                        </dl>
                        <label className={ui.field}>
                            Ghi chú / lý do từ chối
                            <textarea
                                className={styles.textarea}
                                value={restoreReviewReason}
                                onChange={(event) => setRestoreReviewReason(event.target.value)}
                                placeholder="Bắt buộc nhập khi từ chối..."
                                maxLength="2000"
                            />
                        </label>
                        <div className={ui.modalFooter}>
                            <button className={`${ui.secondaryButton} ${ui.dangerButton}`} type="button" onClick={() => reviewSubjectRestoreRequest(false)} disabled={isRestoreSubmitting}>
                                <FiXCircle /> Từ chối
                            </button>
                            <button className={ui.primaryButton} type="button" onClick={() => reviewSubjectRestoreRequest(true)} disabled={isRestoreSubmitting}>
                                <FiCheck /> {isRestoreSubmitting ? 'Đang xử lý...' : 'Duyệt và công khai môn'}
                            </button>
                        </div>
                    </section>
                </ModalBackdrop>
            ) : null}

            {selectedSubject ? (
                <ModalBackdrop onClose={() => setSelectedSubject(null)}>
                    <section className={ui.modal}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>Chi tiết môn học</p>
                                <h3>{selectedSubject.code} - {selectedSubject.name}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={() => setSelectedSubject(null)} aria-label="Đóng chi tiết môn học">
                                x
                            </button>
                        </div>
                        <dl className={styles.detailGrid}>
                            <div className={styles.detailItem}>
                                <dt>Mã định danh</dt>
                                <dd>{selectedSubject.publicId ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Mã môn</dt>
                                <dd>{selectedSubject.code ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Tên môn</dt>
                                <dd>{selectedSubject.name ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Trạng thái</dt>
                                <dd><StatusPill value={subjectStatusLabels[selectedSubject.status] ?? selectedSubject.status} status={selectedSubject.status} /></dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Số tín chỉ</dt>
                                <dd>{formatDecimal(selectedSubject.credits)}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Số lớp hiện có</dt>
                                <dd>{subjectClassCounts.get(selectedSubject.publicId) ?? 0}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Điểm đạt</dt>
                                <dd>{formatDecimal(selectedSubject.passScore)}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Bài tập</dt>
                                <dd>{formatDecimal(selectedSubject.assignmentWeight, '%')}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Kiểm tra</dt>
                                <dd>{formatDecimal(selectedSubject.quizWeight, '%')}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Giữa kỳ</dt>
                                <dd>{formatDecimal(selectedSubject.midtermWeight, '%')}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Cuối kỳ</dt>
                                <dd>{formatDecimal(selectedSubject.finalWeight, '%')}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>ID bộ môn</dt>
                                <dd>{selectedSubject.departmentId ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Mã bộ môn</dt>
                                <dd>{selectedSubject.department?.code ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Tên bộ môn</dt>
                                <dd>{selectedSubject.department?.name ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Public ID bộ môn</dt>
                                <dd>{selectedSubject.department?.publicId ?? '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Trưởng bộ môn</dt>
                                <dd>{selectedSubject.department?.users?.map((item) => `${item.fullName}${item.code ? ` (${item.code})` : ''}`).join(', ') || '-'}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Ngày tạo</dt>
                                <dd>{formatDateTime(selectedSubject.createdAt)}</dd>
                            </div>
                            <div className={styles.detailItem}>
                                <dt>Cập nhật gần nhất</dt>
                                <dd>{formatDateTime(selectedSubject.updatedAt)}</dd>
                            </div>
                            <div className={`${styles.detailItem} ${styles.detailWide}`}>
                                <dt>Mô tả</dt>
                                <dd>{selectedSubject.description || '-'}</dd>
                            </div>
                            {getRejectedSubjectProposal(selectedSubject)?.rejectionReason ? (
                                <div className={`${styles.detailItem} ${styles.detailWide}`}>
                                    <dt>Lý do từ chối gần nhất</dt>
                                    <dd>{getRejectedSubjectProposal(selectedSubject).rejectionReason}</dd>
                                </div>
                            ) : null}
                        </dl>
                        <div className={ui.modalFooter}>
                            {renderSubjectActions(selectedSubject)}
                        </div>
                    </section>
                </ModalBackdrop>
            ) : null}

            {loading ? <div className={classNames(ui.infoPanel, styles.emptyState)}>Đang tải dữ liệu...</div> : null}
        </div>
    );
}
