import 'dotenv/config';
import {
    AssessmentCategory,
    AttemptStatus,
    ClassStatus,
    Department,
    EmploymentStatus,
    EnrollmentStatus,
    Gender,
    JudgeStatus,
    Lesson,
    LessonType,
    PrismaClient,
    QuestionType,
    ScorePolicy,
    StudentStatus,
    Subject,
    SubjectStatus,
    User,
    UserRole,
    UserStatus,
    ViolationType,
    WeekDay
} from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcrypt';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Thiếu DATABASE_URL');

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });
const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? 'Lms@123';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysFromNow = (days: number) => new Date(now.getTime() + days * DAY);

const departmentSeeds = [
    {
        code: 'CNPM',
        name: 'Công nghệ phần mềm',
        subjects: [
            { code: 'JAVA101', name: 'Lập trình Java căn bản', credits: 3 },
            { code: 'JAVA201', name: 'Lập trình Java nâng cao', credits: 3 }
        ]
    },
    {
        code: 'KETOAN',
        name: 'Kế toán',
        subjects: [
            { code: 'KT101', name: 'Nguyên lý kế toán', credits: 3 },
            { code: 'KT201', name: 'Kế toán tài chính', credits: 3 }
        ]
    },
    {
        code: 'MKT',
        name: 'Marketing',
        subjects: [
            { code: 'MKT101', name: 'Marketing căn bản', credits: 3 },
            { code: 'MKT201', name: 'Marketing số', credits: 3 }
        ]
    },
    {
        code: 'LOG',
        name: 'Logistics',
        subjects: [
            { code: 'LOG101', name: 'Quản trị chuỗi cung ứng', credits: 3 },
            { code: 'LOG201', name: 'Vận tải và giao nhận', credits: 3 }
        ]
    }
];

async function upsertUser(input: {
    code: string;
    email: string;
    fullName: string;
    role: UserRole;
    password: string;
    departmentId?: number;
    gender?: Gender;
}) {
    const isStudent = input.role === UserRole.STUDENT;
    return prisma.user.upsert({
        where: { email: input.email },
        update: {
            code: input.code,
            fullName: input.fullName,
            password: input.password,
            role: input.role,
            status: UserStatus.ACTIVE,
            studentStatus: isStudent ? StudentStatus.STUDYING : null,
            employmentStatus: isStudent ? null : EmploymentStatus.WORKING,
            departmentId: input.departmentId,
            gender: input.gender
        },
        create: {
            code: input.code,
            email: input.email,
            fullName: input.fullName,
            password: input.password,
            role: input.role,
            status: UserStatus.ACTIVE,
            studentStatus: isStudent ? StudentStatus.STUDYING : null,
            employmentStatus: isStudent ? null : EmploymentStatus.WORKING,
            departmentId: input.departmentId,
            gender: input.gender
        }
    });
}

async function upsertSubject(input: {
    code: string;
    name: string;
    credits: number;
    departmentId: number;
    status?: SubjectStatus;
}) {
    const data = {
        name: input.name,
        description: `Dữ liệu mẫu cho môn ${input.name}`,
        credits: input.credits,
        assignmentWeight: 10,
        quizWeight: 20,
        midtermWeight: 20,
        finalWeight: 50,
        passScore: 4,
        departmentId: input.departmentId,
        status: input.status ?? SubjectStatus.PUBLIC
    };
    return prisma.subject.upsert({
        where: { code: input.code },
        update: data,
        create: { code: input.code, ...data }
    });
}

async function upsertClass(input: {
    code: string;
    name: string;
    subject: Subject;
    department: Department;
    manager: User;
    lecturer: User;
    status: ClassStatus;
    weekDay: WeekDay;
    startTime: string;
    endTime: string;
    room: string;
}) {
    const courseClass = await prisma.class.upsert({
        where: { code: input.code },
        update: {
            name: input.name,
            subjectId: input.subject.id,
            departmentId: input.department.id,
            managerId: input.manager.id,
            lecturerId: input.lecturer.id,
            maxStudents: 40,
            registrationStart: daysFromNow(-7),
            registrationEnd: daysFromNow(14),
            status: input.status
        },
        create: {
            code: input.code,
            name: input.name,
            subjectId: input.subject.id,
            departmentId: input.department.id,
            managerId: input.manager.id,
            lecturerId: input.lecturer.id,
            maxStudents: 40,
            registrationStart: daysFromNow(-7),
            registrationEnd: daysFromNow(14),
            status: input.status
        }
    });

    await prisma.classSchedule.deleteMany({ where: { classId: courseClass.id } });
    await prisma.classSchedule.create({
        data: {
            classId: courseClass.id,
            weekDay: input.weekDay,
            startTime: input.startTime,
            endTime: input.endTime,
            room: input.room
        }
    });
    return courseClass;
}

type CategoryScores = Record<AssessmentCategory, number>;
type TeachingFlowStage = 'UPCOMING' | 'ACTIVE' | 'COMPLETED';

const completedScoreProfiles: CategoryScores[] = [
    { ASSIGNMENT: 8.5, QUIZ: 8, MIDTERM: 7.5, FINAL: 8 },
    { ASSIGNMENT: 7.5, QUIZ: 7, MIDTERM: 6.5, FINAL: 7 },
    { ASSIGNMENT: 6.5, QUIZ: 6, MIDTERM: 6, FINAL: 6.5 },
    { ASSIGNMENT: 5.5, QUIZ: 5, MIDTERM: 5, FINAL: 5.5 },
    { ASSIGNMENT: 4, QUIZ: 3.5, MIDTERM: 3.5, FINAL: 3.5 },
    { ASSIGNMENT: 9.5, QUIZ: 9, MIDTERM: 8.5, FINAL: 9 }
];

const inProgressScoreProfiles: CategoryScores[] = [
    { ASSIGNMENT: 8.5, QUIZ: 8, MIDTERM: 0, FINAL: 0 },
    { ASSIGNMENT: 7.5, QUIZ: 7, MIDTERM: 0, FINAL: 0 },
    { ASSIGNMENT: 6.5, QUIZ: 6, MIDTERM: 0, FINAL: 0 },
    { ASSIGNMENT: 9, QUIZ: 8.5, MIDTERM: 0, FINAL: 0 },
    { ASSIGNMENT: 5, QUIZ: 5.5, MIDTERM: 0, FINAL: 0 },
    { ASSIGNMENT: 8, QUIZ: 7.5, MIDTERM: 0, FINAL: 0 }
];

const categoryMeta: Record<AssessmentCategory, { title: string; description: string; durationMinutes: number | null }> = {
    ASSIGNMENT: {
        title: 'Bài tập thực hành tổng hợp',
        description: 'Vận dụng kiến thức bài giảng để phân tích tình huống và hoàn thiện bài thực hành.',
        durationMinutes: null
    },
    QUIZ: {
        title: 'Quiz kiểm tra kiến thức',
        description: 'Kiểm tra nhanh kiến thức nền tảng sau các chương đầu tiên.',
        durationMinutes: 30
    },
    MIDTERM: {
        title: 'Kiểm tra giữa kỳ',
        description: 'Đánh giá khả năng tổng hợp kiến thức và giải quyết vấn đề.',
        durationMinutes: 60
    },
    FINAL: {
        title: 'Thi cuối kỳ',
        description: 'Bài thi tổng kết toàn bộ chuẩn đầu ra của môn học.',
        durationMinutes: 90
    }
};

async function createAssessmentQuestions(assessmentId: number, category: AssessmentCategory) {
    const createChoiceQuestion = async (input: {
        type: QuestionType;
        content: string;
        points: number;
        sortOrder: number;
        options: Array<{ content: string; isCorrect: boolean }>;
    }) => {
        const question = await prisma.assessmentQuestion.create({
            data: {
                assessmentId,
                type: input.type,
                content: input.content,
                points: input.points,
                sortOrder: input.sortOrder
            }
        });
        await prisma.questionOption.createMany({
            data: input.options.map((option, index) => ({
                questionId: question.id,
                content: option.content,
                isCorrect: option.isCorrect,
                sortOrder: index
            }))
        });
    };

    const createEssayQuestion = (content: string, points: number, sortOrder: number) =>
        prisma.assessmentQuestion.create({
            data: { assessmentId, type: QuestionType.ESSAY, content, points, sortOrder }
        });

    const createCodeQuestion = async (input: {
        type: QuestionType;
        content: string;
        points: number;
        sortOrder: number;
        starterCode: string;
    }) => {
        const question = await prisma.assessmentQuestion.create({
            data: {
                assessmentId,
                type: input.type,
                content: input.content,
                points: input.points,
                sortOrder: input.sortOrder,
                judgeLanguageId: input.type === QuestionType.CODE ? 63 : null,
                starterCode: input.starterCode
            }
        });
        await prisma.codeTestCase.createMany({
            data: input.type === QuestionType.CODE
                ? [
                    { questionId: question.id, input: '2 3', expectedOutput: '5', isHidden: false, sortOrder: 0 },
                    { questionId: question.id, input: '-5 8', expectedOutput: '3', isHidden: true, sortOrder: 1 },
                    { questionId: question.id, input: '100 250', expectedOutput: '350', isHidden: true, sortOrder: 2 }
                ]
                : [
                    { questionId: question.id, input: 'viewport: 1440px', expectedOutput: 'layout: centered; responsive: true', isHidden: false, sortOrder: 0 },
                    { questionId: question.id, input: 'viewport: 375px', expectedOutput: 'layout: stacked; overflow: none', isHidden: true, sortOrder: 1 }
                ]
        });
    };

    if (category === AssessmentCategory.ASSIGNMENT) {
        await createEssayQuestion('Phân tích một tình huống thực tế và giải thích cách áp dụng kiến thức của môn học.', 4, 0);
        await createCodeQuestion({
            type: QuestionType.CODE,
            content: 'Viết hàm đọc hai số nguyên và in ra tổng của chúng.',
            points: 6,
            sortOrder: 1,
            starterCode: 'function solve(a, b) {\n  // Hoàn thiện lời giải\n}'
        });
        return;
    }

    if (category === AssessmentCategory.QUIZ) {
        await createChoiceQuestion({
            type: QuestionType.SINGLE_CHOICE,
            content: 'Mục tiêu quan trọng nhất của việc chia nội dung thành các module là gì?',
            points: 4,
            sortOrder: 0,
            options: [
                { content: 'Tổ chức kiến thức theo lộ trình dễ theo dõi', isCorrect: true },
                { content: 'Làm tăng số lượng trang', isCorrect: false },
                { content: 'Loại bỏ hoàn toàn bài kiểm tra', isCorrect: false },
                { content: 'Không cần theo dõi tiến độ', isCorrect: false }
            ]
        });
        await createChoiceQuestion({
            type: QuestionType.MULTIPLE_CHOICE,
            content: 'Chọn các hoạt động giúp sinh viên học hiệu quả.',
            points: 6,
            sortOrder: 1,
            options: [
                { content: 'Đọc bài giảng trước buổi học', isCorrect: true },
                { content: 'Làm bài thực hành', isCorrect: true },
                { content: 'Xem phản hồi sau khi chấm', isCorrect: true },
                { content: 'Bỏ qua hạn nộp bài', isCorrect: false }
            ]
        });
        return;
    }

    if (category === AssessmentCategory.MIDTERM) {
        await createChoiceQuestion({
            type: QuestionType.SINGLE_CHOICE,
            content: 'Khi giải quyết một bài toán mới, bước nào nên thực hiện trước?',
            points: 4,
            sortOrder: 0,
            options: [
                { content: 'Phân tích yêu cầu và dữ liệu đầu vào', isCorrect: true },
                { content: 'Viết ngay đáp án cuối cùng', isCorrect: false },
                { content: 'Bỏ qua các ràng buộc', isCorrect: false },
                { content: 'Chỉ kiểm thử một trường hợp', isCorrect: false }
            ]
        });
        await createEssayQuestion('Trình bày quy trình giải quyết vấn đề từ phân tích, thiết kế đến kiểm thử và đánh giá kết quả.', 6, 1);
        return;
    }

    await createCodeQuestion({
        type: QuestionType.CODE,
        content: 'Xây dựng lời giải hoàn chỉnh cho bài toán tính tổng hai số, có xử lý dữ liệu đầu vào.',
        points: 6,
        sortOrder: 0,
        starterCode: 'const fs = require("fs");\nconst [a, b] = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\n'
    });
    await createCodeQuestion({
        type: QuestionType.HTML_CSS,
        content: 'Tạo một thẻ thông tin môn học responsive, căn giữa trên desktop và xếp dọc trên mobile.',
        points: 4,
        sortOrder: 1,
        starterCode: '<article class="course-card">\n  <h2>Tên môn học</h2>\n  <p>Mô tả môn học</p>\n</article>\n<style>\n/* Viết CSS tại đây */\n</style>'
    });
}

async function createSeedAssessment(input: {
    classId: number;
    lessonId: number;
    category: AssessmentCategory;
    flowStage: TeachingFlowStage;
    sequence: number;
}) {
    const meta = categoryMeta[input.category];
    const completedOpenOffset = -120 + input.sequence * 20;
    const activeWindows: Record<AssessmentCategory, [number, number]> = {
        ASSIGNMENT: [-30, 7],
        QUIZ: [-15, -1],
        MIDTERM: [-1, 2],
        FINAL: [20, 21]
    };
    const upcomingWindows: Record<AssessmentCategory, [number, number]> = {
        ASSIGNMENT: [14, 30],
        QUIZ: [31, 32],
        MIDTERM: [45, 46],
        FINAL: [70, 71]
    };
    const [activeOpenOffset, activeCloseOffset] = activeWindows[input.category];
    const [upcomingOpenOffset, upcomingCloseOffset] = upcomingWindows[input.category];
    const openOffset = input.flowStage === 'COMPLETED'
        ? completedOpenOffset
        : input.flowStage === 'UPCOMING'
            ? upcomingOpenOffset
            : activeOpenOffset;
    const closeOffset = input.flowStage === 'COMPLETED'
        ? completedOpenOffset + 10
        : input.flowStage === 'UPCOMING'
            ? upcomingCloseOffset
            : activeCloseOffset;
    const assessment = await prisma.assessment.create({
        data: {
            classId: input.classId,
            lessonId: input.lessonId,
            title: meta.title,
            description: meta.description,
            category: input.category,
            openAt: daysFromNow(openOffset),
            closeAt: daysFromNow(closeOffset),
            durationMinutes: meta.durationMinutes,
            maxAttempts: input.category === AssessmentCategory.ASSIGNMENT || input.category === AssessmentCategory.QUIZ ? 2 : 1,
            scorePolicy: ScorePolicy.HIGHEST,
            maxViolations: 3,
            isPublished: true
        }
    });
    await createAssessmentQuestions(assessment.id, input.category);
    return prisma.assessment.findUniqueOrThrow({
        where: { id: assessment.id },
        include: { questions: { orderBy: { sortOrder: 'asc' }, include: { options: { orderBy: { sortOrder: 'asc' } } } } }
    });
}

async function seedAttempt(input: {
    assessment: Awaited<ReturnType<typeof createSeedAssessment>>;
    student: User;
    lecturer: User;
    score: number | null;
    status: AttemptStatus;
    sequence: number;
}) {
    const graded = input.status === AttemptStatus.GRADED;
    const ratio = input.score === null ? 0 : input.score / 10;
    const startedAt = new Date(input.assessment.closeAt.getTime() - (input.sequence + 2) * 60 * 60 * 1000);
    const submittedAt = input.status === AttemptStatus.IN_PROGRESS ? null : new Date(startedAt.getTime() + 45 * 60 * 1000);
    const attempt = await prisma.assessmentAttempt.create({
        data: {
            assessmentId: input.assessment.id,
            studentId: input.student.id,
            attemptNumber: 1,
            status: input.status,
            score: graded ? input.score : null,
            violationCount: input.sequence % 3 === 0 ? 1 : 0,
            startedAt,
            deadlineAt: new Date(startedAt.getTime() + (input.assessment.durationMinutes ?? 24 * 60) * 60 * 1000),
            submittedAt,
            gradedAt: graded ? new Date((submittedAt ?? startedAt).getTime() + 2 * 60 * 60 * 1000) : null
        }
    });

    for (const question of input.assessment.questions) {
        const questionPoints = Number(question.points);
        const isCode = question.type === QuestionType.CODE || question.type === QuestionType.HTML_CSS;
        const awardedPoints = graded ? Math.round(questionPoints * ratio * 100) / 100 : null;
        const answer = await prisma.attemptAnswer.create({
            data: {
                attemptId: attempt.id,
                questionId: question.id,
                textAnswer: question.type === QuestionType.ESSAY
                    ? 'Sinh viên phân tích yêu cầu, đề xuất phương án, nêu ví dụ thực tế và đánh giá kết quả.'
                    : null,
                sourceCode: question.type === QuestionType.CODE
                    ? 'const fs = require("fs"); const [a,b] = fs.readFileSync(0,"utf8").trim().split(/\\s+/).map(Number); console.log(a+b);'
                    : question.type === QuestionType.HTML_CSS
                        ? '<article class="course-card"><h2>Tên môn học</h2><p>Mô tả môn học</p></article><style>.course-card{max-width:720px;margin:auto;padding:24px;display:grid;gap:12px}@media(max-width:600px){.course-card{display:block}}</style>'
                        : null,
                languageId: question.type === QuestionType.CODE ? 63 : null,
                awardedPoints,
                feedback: graded ? (ratio >= 0.7 ? 'Bài làm tốt, lập luận rõ ràng và đáp ứng phần lớn yêu cầu.' : 'Cần bổ sung phân tích và kiểm thử thêm các trường hợp biên.') : null,
                judgeStatus: isCode
                    ? (graded ? (ratio >= 0.6 ? JudgeStatus.ACCEPTED : JudgeStatus.WRONG_ANSWER) : JudgeStatus.QUEUED)
                    : JudgeStatus.NOT_REQUIRED,
                judgeMessage: isCode && graded ? `${ratio >= 0.6 ? 'Passed' : 'Failed'} seed test cases` : null,
                gradedById: graded ? input.lecturer.id : null,
                gradedAt: graded ? new Date() : null
            }
        });

        if ((question.type === QuestionType.SINGLE_CHOICE || question.type === QuestionType.MULTIPLE_CHOICE) && question.options.length) {
            const correctOptions = question.options.filter((option) => option.isCorrect);
            const wrongOption = question.options.find((option) => !option.isCorrect);
            const selectedOptions = ratio >= 0.6 ? correctOptions : (wrongOption ? [wrongOption] : correctOptions.slice(0, 1));
            if (selectedOptions.length) {
                await prisma.attemptAnswerOption.createMany({
                    data: selectedOptions.map((option) => ({ answerId: answer.id, optionId: option.id }))
                });
            }
        }
    }

    if (input.sequence % 3 === 0) {
        await prisma.attemptViolation.create({
            data: { attemptId: attempt.id, type: ViolationType.WINDOW_BLUR, createdAt: new Date(startedAt.getTime() + 15 * 60 * 1000) }
        });
    }
}

async function seedTeachingFlow(input: {
    courseClass: Awaited<ReturnType<typeof upsertClass>>;
    subject: Subject;
    lecturer: User;
    students: User[];
    flowStage: TeachingFlowStage;
}) {
    await prisma.assessment.deleteMany({ where: { classId: input.courseClass.id } });
    await prisma.lessonSection.deleteMany({ where: { classId: input.courseClass.id } });

    const sectionSeeds = [
        {
            title: 'Chương 1 - Khởi động và bài tập đầu tiên',
            assessmentCategory: AssessmentCategory.ASSIGNMENT,
            lessons: [
                { title: 'Giới thiệu môn học và lộ trình', type: LessonType.TEXT, content: `<h2>${input.subject.name}</h2><p>Bài giảng giới thiệu mục tiêu, chuẩn đầu ra, phương pháp học và cách tính điểm.</p><ul><li>Hiểu kiến thức nền tảng</li><li>Vận dụng vào bài tập</li><li>Hoàn thành đầy đủ đánh giá</li></ul>` },
                { title: 'Video định hướng học tập', type: LessonType.VIDEO, resourceUrl: 'https://www.youtube.com/watch?v=ysz5S6PUM-U', content: '<p>Xem video và ghi lại ba mục tiêu cá nhân.</p>' },
                { title: 'Đề cương chi tiết dạng PDF', type: LessonType.PDF, resourceUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', content: '<p>Tài liệu đề cương dùng để kiểm tra luồng xem PDF.</p>' }
            ]
        },
        {
            title: 'Chương 2 - Kiến thức nền tảng và quiz',
            assessmentCategory: AssessmentCategory.QUIZ,
            lessons: [
                { title: 'Bài giảng nền tảng', type: LessonType.TEXT, content: '<h3>Khái niệm cốt lõi</h3><p>Nội dung có ví dụ, bảng so sánh và câu hỏi tự kiểm tra cuối bài.</p><blockquote>Học đi đôi với thực hành và phản hồi.</blockquote>' },
                { title: 'Tài liệu đọc mở rộng', type: LessonType.DOCUMENT, content: '<h3>Tài liệu hướng dẫn</h3><p>Đọc tình huống mẫu, xác định dữ liệu đầu vào, đầu ra và các ràng buộc.</p>' },
                { title: 'Liên kết tài liệu tham khảo', type: LessonType.LINK, resourceUrl: 'https://developer.mozilla.org/en-US/docs/Learn', content: '<p>Nguồn tham khảo bổ sung phục vụ tự học.</p>' }
            ]
        },
        {
            title: 'Chương 3 - Thực hành và kiểm tra giữa kỳ',
            assessmentCategory: AssessmentCategory.MIDTERM,
            lessons: [
                { title: 'Thực hành phân tích yêu cầu', type: LessonType.TEXT, content: '<h3>Tình huống thực hành</h3><p>Phân tích yêu cầu, chia nhỏ bài toán và đề xuất tiêu chí kiểm thử.</p>' },
                { title: 'Coding lab - Xử lý dữ liệu đầu vào', type: LessonType.CODE, content: 'function solve(input) {\n  const values = input.trim().split(/\\s+/).map(Number);\n  return values.reduce((sum, value) => sum + value, 0);\n}' }
            ]
        },
        {
            title: 'Chương 4 - Tổng kết và thi cuối kỳ',
            assessmentCategory: AssessmentCategory.FINAL,
            lessons: [
                { title: 'Ôn tập theo chuẩn đầu ra', type: LessonType.TEXT, content: '<h3>Ôn tập tổng hợp</h3><p>Hệ thống hóa kiến thức, đối chiếu chuẩn đầu ra và tự kiểm tra các nội dung còn yếu.</p>' },
                { title: 'Hướng dẫn chuẩn bị thi cuối kỳ', type: LessonType.TEXT, content: '<h3>Chuẩn bị thi</h3><p>Ôn quy chế, cấu trúc đề, thời lượng và các yêu cầu trước khi bắt đầu bài thi cuối kỳ.</p>' }
            ]
        }
    ];

    const allLessons: Lesson[] = [];
    const assessmentLessons = new Map<AssessmentCategory, { id: number }>();
    for (let sectionIndex = 0; sectionIndex < sectionSeeds.length; sectionIndex += 1) {
        const sectionSeed = sectionSeeds[sectionIndex];
        const section = await prisma.lessonSection.create({
            data: {
                classId: input.courseClass.id,
                title: sectionSeed.title,
                sortOrder: sectionIndex,
                isPublished: true
            }
        });
        for (let lessonIndex = 0; lessonIndex < sectionSeed.lessons.length; lessonIndex += 1) {
            const lessonSeed = sectionSeed.lessons[lessonIndex];
            const lesson = await prisma.lesson.create({
                data: {
                    sectionId: section.id,
                    title: lessonSeed.title,
                    type: lessonSeed.type,
                    content: lessonSeed.content,
                    resourceUrl: 'resourceUrl' in lessonSeed ? lessonSeed.resourceUrl : null,
                    sortOrder: lessonIndex,
                    isPublished: true
                }
            });
            allLessons.push(lesson);
            if (lessonIndex === sectionSeed.lessons.length - 1) {
                assessmentLessons.set(sectionSeed.assessmentCategory, lesson);
            }
        }
    }

    const assessments = new Map<AssessmentCategory, Awaited<ReturnType<typeof createSeedAssessment>>>();
    for (let index = 0; index < Object.values(AssessmentCategory).length; index += 1) {
        const category = Object.values(AssessmentCategory)[index];
        const lesson = assessmentLessons.get(category);
        if (!lesson) throw new Error(`Thiếu lesson cho assessment ${category}`);
        assessments.set(category, await createSeedAssessment({
            classId: input.courseClass.id,
            lessonId: lesson.id,
            category,
            flowStage: input.flowStage,
            sequence: index
        }));
    }

    for (let studentIndex = 0; studentIndex < input.students.length; studentIndex += 1) {
        const student = input.students[studentIndex];
        const progressLessonCount = input.flowStage === 'COMPLETED'
            ? allLessons.length
            : input.flowStage === 'ACTIVE'
                ? Math.min(allLessons.length, studentIndex < 2 ? 8 : 6)
                : 0;
        for (const lesson of allLessons.slice(0, progressLessonCount)) {
            await prisma.lessonProgress.upsert({
                where: { lessonId_studentId: { lessonId: lesson.id, studentId: student.id } },
                update: { completedAt: daysFromNow(input.flowStage === 'COMPLETED' ? -80 + studentIndex : -5 + studentIndex) },
                create: { lessonId: lesson.id, studentId: student.id, completedAt: daysFromNow(input.flowStage === 'COMPLETED' ? -80 + studentIndex : -5 + studentIndex) }
            });
        }

        const profile = (input.flowStage === 'COMPLETED' ? completedScoreProfiles : inProgressScoreProfiles)[studentIndex % completedScoreProfiles.length];
        for (const category of Object.values(AssessmentCategory)) {
            const assessment = assessments.get(category)!;
            if (input.flowStage === 'COMPLETED' || (input.flowStage === 'ACTIVE' && (category === AssessmentCategory.ASSIGNMENT || category === AssessmentCategory.QUIZ))) {
                await seedAttempt({
                    assessment,
                    student,
                    lecturer: input.lecturer,
                    score: profile[category],
                    status: AttemptStatus.GRADED,
                    sequence: studentIndex
                });
            } else if (input.flowStage === 'ACTIVE' && category === AssessmentCategory.MIDTERM && studentIndex < 2) {
                await seedAttempt({
                    assessment,
                    student,
                    lecturer: input.lecturer,
                    score: null,
                    status: AttemptStatus.PENDING_GRADING,
                    sequence: studentIndex
                });
            }
        }

        if (input.flowStage === 'COMPLETED') {
            const finalScore = Math.round((
                profile.ASSIGNMENT * 0.1
                + profile.QUIZ * 0.2
                + profile.MIDTERM * 0.2
                + profile.FINAL * 0.5
            ) * 100) / 100;
            await prisma.enrollment.update({
                where: { classId_studentId: { classId: input.courseClass.id, studentId: student.id } },
                data: { finalScore, passed: finalScore >= Number(input.subject.passScore) }
            });
        }
    }

    return { sectionCount: sectionSeeds.length, lessonCount: allLessons.length, assessmentCount: assessments.size };
}

async function main() {
    const password = await bcrypt.hash(defaultPassword, 10);

    const departments: Department[] = [];
    for (const item of departmentSeeds) {
        departments.push(await prisma.department.upsert({
            where: { code: item.code },
            update: { name: item.name, description: `Bộ môn ${item.name}`, isActive: true },
            create: { code: item.code, name: item.name, description: `Bộ môn ${item.name}`, isActive: true }
        }));
    }

    const admin = await upsertUser({
        code: 'ADMIN001', email: 'admin@lms.local', fullName: 'Quản trị hệ thống',
        role: UserRole.ADMIN, password, gender: Gender.MALE
    });
    const principal = await upsertUser({
        code: 'HT001', email: 'hieutruong@lms.local', fullName: 'Nguyễn Minh Hiệu',
        role: UserRole.PRINCIPAL, password, gender: Gender.MALE
    });
    const hr = await upsertUser({
        code: 'HR001', email: 'nhansu@lms.local', fullName: 'Trần Thanh Hà',
        role: UserRole.HR, password, gender: Gender.FEMALE
    });
    const trainingOfficer = await upsertUser({
        code: 'PDT001', email: 'phongdaotao@lms.local', fullName: 'Võ Thanh Đào',
        role: UserRole.TRAINING_OFFICER, password, gender: Gender.FEMALE
    });

    const departmentHeads: User[] = [];
    const lecturers: User[] = [];
    for (let index = 0; index < departments.length; index += 1) {
        departmentHeads.push(await upsertUser({
            code: `TBM${String(index + 1).padStart(3, '0')}`,
            email: `truongbomon${index + 1}@lms.local`,
            fullName: `Trưởng bộ môn ${departmentSeeds[index].name}`,
            role: UserRole.DEPARTMENT_HEAD,
            password,
            departmentId: departments[index].id,
            gender: index % 2 === 0 ? Gender.MALE : Gender.FEMALE
        }));

        for (let lecturerIndex = 0; lecturerIndex < 2; lecturerIndex += 1) {
            lecturers.push(await upsertUser({
                code: `GV${String(index * 2 + lecturerIndex + 1).padStart(3, '0')}`,
                email: `giangvien${index * 2 + lecturerIndex + 1}@lms.local`,
                fullName: `Giảng viên ${departmentSeeds[index].name} ${lecturerIndex + 1}`,
                role: UserRole.LECTURER,
                password,
                departmentId: departments[index].id,
                gender: lecturerIndex % 2 === 0 ? Gender.FEMALE : Gender.MALE
            }));
        }
    }

    const students: User[] = [];
    const studentsPerDepartment = 10;
    for (let departmentIndex = 0; departmentIndex < departments.length; departmentIndex += 1) {
        for (let studentIndex = 0; studentIndex < studentsPerDepartment; studentIndex += 1) {
            const number = departmentIndex * studentsPerDepartment + studentIndex + 1;
            students.push(await upsertUser({
                code: `SV${String(number).padStart(4, '0')}`,
                email: `sinhvien${number}@lms.local`,
                fullName: `Sinh viên ${departmentSeeds[departmentIndex].name} ${String(studentIndex + 1).padStart(2, '0')}`,
                role: UserRole.STUDENT,
                password,
                departmentId: departments[departmentIndex].id,
                gender: studentIndex % 2 === 0 ? Gender.MALE : Gender.FEMALE
            }));
        }
    }

    const subjects: Subject[] = [];
    for (let departmentIndex = 0; departmentIndex < departmentSeeds.length; departmentIndex += 1) {
        for (const subjectSeed of departmentSeeds[departmentIndex].subjects) {
            subjects.push(await upsertSubject({
                ...subjectSeed,
                departmentId: departments[departmentIndex].id
            }));
        }
    }

    const archivedSubject = await upsertSubject({
        code: 'JAVA099',
        name: 'Java nhập môn (chương trình cũ)',
        credits: 2,
        departmentId: departments[0].id,
        status: SubjectStatus.ARCHIVE
    });
    subjects.push(archivedSubject);

    const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject]));
    const prerequisitePairs = [
        ['JAVA201', 'JAVA101'],
        ['KT201', 'KT101'],
        ['MKT201', 'MKT101'],
        ['LOG201', 'LOG101']
    ];
    for (const [subjectCode, prerequisiteCode] of prerequisitePairs) {
        const subject = subjectByCode.get(subjectCode)!;
        const prerequisite = subjectByCode.get(prerequisiteCode)!;
        await prisma.subjectPrerequisite.upsert({
            where: { subjectId_prerequisiteId: { subjectId: subject.id, prerequisiteId: prerequisite.id } },
            update: {},
            create: { subjectId: subject.id, prerequisiteId: prerequisite.id }
        });
    }

    const weekdays = [WeekDay.MONDAY, WeekDay.TUESDAY, WeekDay.WEDNESDAY, WeekDay.THURSDAY];
    let openClassCount = 0;
    const openClasses: Awaited<ReturnType<typeof upsertClass>>[] = [];
    for (let departmentIndex = 0; departmentIndex < departmentSeeds.length; departmentIndex += 1) {
        const subject = subjectByCode.get(departmentSeeds[departmentIndex].subjects[0].code)!;
        const openClass = await upsertClass({
            code: `${subject.code}-001`,
            name: `${subject.name} - Lớp 001`,
            subject,
            department: departments[departmentIndex],
            manager: departmentHeads[departmentIndex],
            lecturer: lecturers[departmentIndex * 2],
            status: ClassStatus.OPEN_REGISTRATION,
            weekDay: weekdays[departmentIndex],
            startTime: departmentIndex < 2 ? '07:30' : '13:30',
            endTime: departmentIndex < 2 ? '10:30' : '16:30',
            room: `P${String(departmentIndex + 1).padStart(3, '0')}`
        });
        openClasses.push(openClass);
        openClassCount += 1;
    }

    const inProgressSubject = subjectByCode.get('JAVA201')!;
    const inProgressClass = await upsertClass({
        code: 'JAVA201-001',
        name: 'Lập trình Java nâng cao - Lớp 001',
        subject: inProgressSubject,
        department: departments[0],
        manager: departmentHeads[0],
        lecturer: lecturers[1],
        status: ClassStatus.IN_PROGRESS,
        weekDay: WeekDay.FRIDAY,
        startTime: '07:30',
        endTime: '10:30',
        room: 'P105'
    });

    const additionalTeachingClassSeeds = [
        { subjectCode: 'KT201', departmentIndex: 1, weekDay: WeekDay.TUESDAY, room: 'P205' },
        { subjectCode: 'MKT201', departmentIndex: 2, weekDay: WeekDay.WEDNESDAY, room: 'P305' },
        { subjectCode: 'LOG201', departmentIndex: 3, weekDay: WeekDay.THURSDAY, room: 'P405' }
    ];
    const additionalTeachingClasses: Array<{
        courseClass: Awaited<ReturnType<typeof upsertClass>>;
        subject: Subject;
        lecturer: User;
    }> = [];
    for (const item of additionalTeachingClassSeeds) {
        const subject = subjectByCode.get(item.subjectCode)!;
        const lecturer = lecturers[item.departmentIndex * 2 + 1];
        const courseClass = await upsertClass({
            code: `${item.subjectCode}-001`,
            name: `${subject.name} - Lớp 001`,
            subject,
            department: departments[item.departmentIndex],
            manager: departmentHeads[item.departmentIndex],
            lecturer,
            status: ClassStatus.IN_PROGRESS,
            weekDay: item.weekDay,
            startTime: item.departmentIndex % 2 === 0 ? '13:30' : '07:30',
            endTime: item.departmentIndex % 2 === 0 ? '16:30' : '10:30',
            room: item.room
        });
        additionalTeachingClasses.push({ courseClass, subject, lecturer });
    }

    const completedClass = await upsertClass({
        code: 'JAVA099-001',
        name: 'Java nhập môn (chương trình cũ) - Lớp 001',
        subject: archivedSubject,
        department: departments[0],
        manager: departmentHeads[0],
        lecturer: lecturers[0],
        status: ClassStatus.COMPLETED,
        weekDay: WeekDay.SATURDAY,
        startTime: '07:30',
        endTime: '10:30',
        room: 'P106'
    });

    await prisma.subjectRestoreRequest.deleteMany({ where: { subjectId: archivedSubject.id } });
    await prisma.enrollment.deleteMany({
        where: {
            classId: {
                in: [
                    ...openClasses.map((courseClass) => courseClass.id),
                    inProgressClass.id,
                    ...additionalTeachingClasses.map((item) => item.courseClass.id),
                    completedClass.id
                ]
            }
        }
    });

    for (let classIndex = 0; classIndex < openClasses.length; classIndex += 1) {
        const matchingStudents = students.filter((student) => student.departmentId === departments[classIndex].id);
        for (const student of matchingStudents) {
            await prisma.enrollment.create({
                data: { classId: openClasses[classIndex].id, studentId: student.id, status: EnrollmentStatus.ACTIVE }
            });
        }
    }

    const softwareStudents = students.filter((student) => student.departmentId === departments[0].id);
    for (const student of softwareStudents) {
        await prisma.enrollment.create({
            data: { classId: inProgressClass.id, studentId: student.id, status: EnrollmentStatus.ACTIVE }
        });
        await prisma.enrollment.create({
            data: { classId: completedClass.id, studentId: student.id, status: EnrollmentStatus.ACTIVE }
        });
    }
    for (const item of additionalTeachingClasses) {
        const matchingStudents = students.filter((student) => student.departmentId === item.courseClass.departmentId);
        for (const student of matchingStudents) {
            await prisma.enrollment.create({
                data: { classId: item.courseClass.id, studentId: student.id, status: EnrollmentStatus.ACTIVE }
            });
        }
    }

    const upcomingFlows: Awaited<ReturnType<typeof seedTeachingFlow>>[] = [];
    for (let classIndex = 0; classIndex < openClasses.length; classIndex += 1) {
        const subject = subjectByCode.get(departmentSeeds[classIndex].subjects[0].code)!;
        const matchingStudents = students.filter((student) => student.departmentId === departments[classIndex].id);
        upcomingFlows.push(await seedTeachingFlow({
            courseClass: openClasses[classIndex],
            subject,
            lecturer: lecturers[classIndex * 2],
            students: matchingStudents,
            flowStage: 'UPCOMING'
        }));
    }

    const activeFlow = await seedTeachingFlow({
        courseClass: inProgressClass,
        subject: inProgressSubject,
        lecturer: lecturers[1],
        students: softwareStudents,
        flowStage: 'ACTIVE'
    });
    const additionalActiveFlows: Awaited<ReturnType<typeof seedTeachingFlow>>[] = [];
    for (const item of additionalTeachingClasses) {
        const matchingStudents = students.filter((student) => student.departmentId === item.courseClass.departmentId);
        additionalActiveFlows.push(await seedTeachingFlow({
            courseClass: item.courseClass,
            subject: item.subject,
            lecturer: item.lecturer,
            students: matchingStudents,
            flowStage: 'ACTIVE'
        }));
    }
    const archivedFlow = await seedTeachingFlow({
        courseClass: completedClass,
        subject: archivedSubject,
        lecturer: lecturers[0],
        students: softwareStudents,
        flowStage: 'COMPLETED'
    });

    console.log(`Active teaching flow: ${activeFlow.sectionCount} sections, ${activeFlow.lessonCount} lessons, ${activeFlow.assessmentCount} assessments.`);
    console.log(`Upcoming PUBLIC teaching flows: ${upcomingFlows.length} classes, ${upcomingFlows.reduce((sum, flow) => sum + flow.lessonCount, 0)} lessons.`);
    console.log(`Additional PUBLIC teaching flows: ${additionalActiveFlows.length} classes, ${additionalActiveFlows.reduce((sum, flow) => sum + flow.lessonCount, 0)} lessons.`);
    console.log(`ARCHIVE flow: ${archivedFlow.sectionCount} sections, ${archivedFlow.lessonCount} lessons, ${archivedFlow.assessmentCount} assessments, ${softwareStudents.length} finalized enrollments.`);
    console.log('ARCHIVE test data: subject JAVA099, class JAVA099-001. Use phongdaotao@lms.local to request restore.');

    console.log('Đã tạo dữ liệu mẫu LMS không sử dụng học kỳ.');
    console.log(`Mật khẩu chung: ${defaultPassword}`);
    console.log(`Admin: ${admin.email}`);
    console.log(`Hiệu trưởng: ${principal.email}`);
    console.log(`Nhân sự: ${hr.email}`);
    console.log(`Phòng đào tạo: ${trainingOfficer.email}`);
    console.log('TBM: truongbomon1@lms.local ... truongbomon4@lms.local');
    console.log('Giảng viên: giangvien1@lms.local ... giangvien8@lms.local');
    console.log(`Sinh viên: sinhvien1@lms.local ... sinhvien${students.length}@lms.local (${studentsPerDepartment} sinh viên/ngành)`);
    console.log(`Lớp mở đăng ký: ${openClassCount}; lớp đang học: ${1 + additionalTeachingClasses.length}; lớp hoàn thành: 1.`);
}

main()
    .catch((error) => {
        console.error('Không thể tạo dữ liệu mẫu:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
