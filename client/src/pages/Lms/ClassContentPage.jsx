import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    BookOpen,
    CheckCircle2,
    ChevronDown,
    ClipboardList,
    Eye,
    FileText,
    GripVertical,
    Link as LinkIcon,
    Pencil,
    PlayCircle,
    Plus,
    Trash2,
    Users
} from 'lucide-react';
import { toast } from 'sonner';

import PageShell from '~/components/common/PageShell';
import SimpleFormDialog from '~/components/common/SimpleFormDialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '~/components/ui/alert-dialog';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import lmsService from '~/services/lms.service';
import useAuthStore from '~/stores/auth.store';
import { normalizeList } from './utils';

const lessonTypes = [
    { value: 'TEXT', label: 'Bài đọc' },
    { value: 'VIDEO', label: 'Video' },
    { value: 'DOCUMENT', label: 'Tài liệu' },
    { value: 'FILE', label: 'File tải xuống' },
    { value: 'LINK', label: 'Liên kết' },
    { value: 'CODE', label: 'Bài code' }
];

const lessonIcon = {
    TEXT: FileText,
    VIDEO: PlayCircle,
    DOCUMENT: FileText,
    FILE: FileText,
    LINK: LinkIcon,
    CODE: ClipboardList
};

const questionTypes = [
    { value: 'SINGLE_CHOICE', label: 'Trắc nghiệm 1 đáp án' },
    { value: 'MULTIPLE_CHOICE', label: 'Trắc nghiệm nhiều đáp án' },
    { value: 'ESSAY', label: 'Tự luận' },
    { value: 'CODE', label: 'Bài code' }
];

const choiceQuestionTypes = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']);

const sectionFields = [
    { name: 'title', label: 'Tên chương' },
    { name: 'description', label: 'Mô tả', type: 'textarea', optional: true },
    { name: 'isPublished', label: 'Công bố ngay', type: 'checkbox', optional: true }
];

const defaultCodeConfig = {
    template: 'HTML_CSS_JS',
    instructions: 'Làm theo yêu cầu trong nội dung bài học và chỉnh sửa các file bên phải.',
    files: [
        {
            path: 'index.html',
            language: 'html',
            content:
                '<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset="UTF-8">\n    <title>Bài tập</title>\n  </head>\n  <body>\n    \n  </body>\n</html>'
        },
        { path: 'style.css', language: 'css', content: 'body {\n  font-family: sans-serif;\n}' },
        { path: 'script.js', language: 'javascript', content: '' }
    ],
    tests: []
};

const curriculumItemTypes = [
    {
        group: '',
        items: [
            {
                label: 'Bài giảng',
                description: 'Tạo bài giảng để thêm video hoặc bài viết',
                dialog: 'lesson',
                initialValues: { type: 'TEXT' }
            },
            {
                label: 'Bài tập coding',
                description: 'Bài tập lập trình có file và test',
                quickCreate: 'code',
                initialValues: { type: 'CODE', codeConfig: defaultCodeConfig }
            },
            {
                label: 'Bài tập',
                description: 'Bài tập thường để sinh viên nộp câu trả lời',
                dialog: 'exam',
                initialValues: { questionType: 'ESSAY' }
            },
            {
                label: 'Trắc nghiệm',
                description: 'Quiz có câu hỏi lựa chọn đáp án',
                dialog: 'exam',
                initialValues: { questionType: 'SINGLE_CHOICE' }
            },
            {
                label: 'Tự luận',
                description: 'Câu hỏi dạng viết câu trả lời',
                dialog: 'exam',
                initialValues: { questionType: 'ESSAY' }
            }
        ]
    }
];

const parseQuestionOptions = (rawOptions = '', type = 'SINGLE_CHOICE') => {
    if (!choiceQuestionTypes.has(type)) return undefined;

    const options = rawOptions
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            const isCorrect = line.startsWith('*');
            return {
                content: isCorrect ? line.slice(1).trim() : line,
                isCorrect,
                sortOrder: index + 1
            };
        })
        .filter((option) => option.content);

    if (options.length < 2) throw new Error('Câu hỏi trắc nghiệm cần ít nhất 2 đáp án');
    const correctCount = options.filter((option) => option.isCorrect).length;
    if (correctCount === 0) throw new Error('Đánh dấu đáp án đúng bằng dấu * ở đầu dòng');
    if (type === 'SINGLE_CHOICE' && correctCount !== 1) {
        throw new Error('Trắc nghiệm 1 đáp án chỉ được có 1 dòng bắt đầu bằng *');
    }

    return options;
};

const buildQuestionPayload = (payload) => {
    if (!payload.questionContent?.trim()) return null;
    const type = payload.questionType || 'SINGLE_CHOICE';
    return {
        type,
        content: payload.questionContent.trim(),
        points: payload.questionPoints ?? 1,
        options: parseQuestionOptions(payload.questionOptions, type)
    };
};

const examPayloadKeys = new Set([
    'sectionPublicId',
    'title',
    'description',
    'durationMinutes',
    'maxAttempts',
    'passScore',
    'isPublished'
]);

const pickExamPayload = (payload) =>
    Object.fromEntries(Object.entries(payload).filter(([key]) => examPayloadKeys.has(key)));

const moveItem = (items, fromIndex, toIndex) => {
    const next = [...items];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
};

const extractYoutubeVideoId = (value = '') => {
    const trimmed = value.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

    try {
        const url = new URL(trimmed);
        if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || '';
        if (url.hostname.includes('youtube.com')) {
            return (
                url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1] || ''
            );
        }
    } catch {
        return '';
    }

    return '';
};

const normalizeLessonPayload = (payload) => {
    const next = { ...payload };
    if (next.type === 'VIDEO') {
        const videoId = extractYoutubeVideoId(next.youtubeVideoId || next.resourceUrl || '');
        if (!videoId) throw new Error('Nhập ID YouTube hợp lệ, ví dụ: Wd90eW5sASE');
        next.resourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }
    delete next.youtubeVideoId;
    return next;
};

const patchListItems = (data, updater) => {
    if (!data) return data;
    if (Array.isArray(data)) return updater(data);
    if (Array.isArray(data.items)) return { ...data, items: updater(data.items) };
    if (Array.isArray(data.data)) return { ...data, data: updater(data.data) };
    return data;
};

const sortByOrder = (items) => [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

export default function ClassContentPage() {
    const { publicId } = useParams();
    const [dialog, setDialog] = useState(null);
    const [selectedExam, setSelectedExam] = useState(null);
    const [selectedSectionPublicId, setSelectedSectionPublicId] = useState(null);
    const [contentPreset, setContentPreset] = useState(null);
    const [editingLesson, setEditingLesson] = useState(null);
    const [editingSection, setEditingSection] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [expandedLessonIds, setExpandedLessonIds] = useState(() => new Set());
    const autoSectionRequested = useRef(false);
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const currentUser = useAuthStore((state) => state.user);

    const classQuery = useQuery({ queryKey: ['class', publicId], queryFn: () => lmsService.getClass(publicId) });
    const sectionsQuery = useQuery({
        queryKey: ['sections', publicId],
        queryFn: () => lmsService.listLessonSections(publicId)
    });
    const lessonsQuery = useQuery({
        queryKey: ['lessons', publicId],
        queryFn: () => lmsService.listLessons(publicId, { limit: 100 })
    });
    const examsQuery = useQuery({ queryKey: ['exams', publicId], queryFn: () => lmsService.listExams(publicId) });

    const classInfo = classQuery.data;
    const sections = normalizeList(sectionsQuery.data).items;
    const lessons = normalizeList(lessonsQuery.data).items;
    const exams = normalizeList(examsQuery.data).items;
    const enrollments = classInfo?.enrollments || [];
    const canEdit = Boolean(classInfo?.lecturer?.publicId && currentUser?.publicId === classInfo.lecturer.publicId);

    const sectionOptions = useMemo(
        () => sections.map((section) => ({ value: section.publicId, label: section.title })),
        [sections]
    );

    const lessonFields = useMemo(
        () => [
            {
                name: 'sectionPublicId',
                label: 'Chương',
                type: 'select',
                optional: true,
                options: sectionOptions,
                visibleWhen: () => !selectedSectionPublicId
            },
            { name: 'title', label: 'Tên bài học' },
            { name: 'description', label: 'Mô tả ngắn', type: 'textarea', optional: true, fullWidth: true },
            { name: 'type', label: 'Loại bài học', type: 'select', options: lessonTypes, defaultValue: 'TEXT' },
            { name: 'content', label: 'Nội dung', type: 'textarea', optional: true, fullWidth: true },
            {
                name: 'youtubeVideoId',
                label: 'YouTube video ID',
                optional: true,
                placeholder: 'Ví dụ: Wd90eW5sASE',
                visibleWhen: (values) => values.type === 'VIDEO'
            },
            {
                name: 'resourceUrl',
                label: 'Link tài nguyên',
                optional: true,
                visibleWhen: (values) => ['DOCUMENT', 'FILE', 'LINK'].includes(values.type)
            },
            { name: 'durationMinutes', label: 'Thời lượng phút', type: 'number', optional: true },
            { name: 'isPublished', label: 'Công bố ngay', type: 'checkbox', optional: true }
        ],
        [sectionOptions, selectedSectionPublicId]
    );

    const examFields = useMemo(
        () => [
            {
                name: 'sectionPublicId',
                label: 'Chương',
                type: 'select',
                optional: true,
                options: sectionOptions,
                visibleWhen: () => !selectedSectionPublicId
            },
            { name: 'title', label: 'Tên quiz/bài kiểm tra' },
            { name: 'description', label: 'Mô tả', type: 'textarea', optional: true, fullWidth: true },
            { name: 'durationMinutes', label: 'Thời gian phút', type: 'number', optional: true },
            { name: 'maxAttempts', label: 'Số lần làm tối đa', type: 'number', optional: true },
            { name: 'passScore', label: 'Điểm đạt', type: 'number', optional: true },
            { name: 'isPublished', label: 'Công bố ngay', type: 'checkbox', optional: true },
            {
                name: 'questionType',
                label: 'Loại câu hỏi đầu tiên',
                type: 'select',
                optional: true,
                options: questionTypes,
                defaultValue: 'SINGLE_CHOICE'
            },
            {
                name: 'questionContent',
                label: 'Nội dung câu hỏi đầu tiên',
                type: 'textarea',
                optional: true,
                fullWidth: true
            },
            {
                name: 'questionOptions',
                label: 'Đáp án trắc nghiệm',
                type: 'textarea',
                optional: true,
                fullWidth: true,
                placeholder: '*Đáp án đúng\nĐáp án sai',
                visibleWhen: (values) => choiceQuestionTypes.has(values.questionType || 'SINGLE_CHOICE')
            },
            { name: 'questionPoints', label: 'Điểm câu hỏi', type: 'number', optional: true, defaultValue: 1 }
        ],
        [sectionOptions, selectedSectionPublicId]
    );

    const questionFields = useMemo(
        () => [
            {
                name: 'type',
                label: 'Loại câu hỏi',
                type: 'select',
                options: questionTypes,
                defaultValue: 'SINGLE_CHOICE'
            },
            { name: 'questionContent', label: 'Nội dung câu hỏi', type: 'textarea', fullWidth: true },
            {
                name: 'questionOptions',
                label: 'Đáp án trắc nghiệm',
                type: 'textarea',
                optional: true,
                fullWidth: true,
                placeholder: '*Đáp án đúng\nĐáp án sai',
                visibleWhen: (values) => choiceQuestionTypes.has(values.type || 'SINGLE_CHOICE')
            },
            { name: 'questionPoints', label: 'Điểm câu hỏi', type: 'number', optional: true, defaultValue: 1 }
        ],
        []
    );

    const lessonsBySection = useMemo(() => {
        const map = new Map();
        lessons.forEach((lesson) => {
            const key = lesson.section?.publicId || 'standalone';
            map.set(key, [...(map.get(key) || []), lesson]);
        });
        return map;
    }, [lessons]);

    const examsBySection = useMemo(() => {
        const map = new Map();
        exams.forEach((exam) => {
            const key = exam.section?.publicId || 'standalone';
            map.set(key, [...(map.get(key) || []), exam]);
        });
        return map;
    }, [exams]);

    const refresh = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['class', publicId] }),
            queryClient.invalidateQueries({ queryKey: ['sections', publicId] }),
            queryClient.invalidateQueries({ queryKey: ['lessons', publicId] }),
            queryClient.invalidateQueries({ queryKey: ['exams', publicId] })
        ]);
    };

    const autoCreateSection = useMutation({
        mutationFn: () =>
            lmsService.createLessonSection(publicId, {
                title: 'Chương 1',
                sortOrder: 1,
                isPublished: true
            }),
        onSuccess: refresh,
        onError: () => {
            autoSectionRequested.current = false;
        }
    });

    useEffect(() => {
        if (!canEdit || !sectionsQuery.isSuccess || sections.length > 0 || autoSectionRequested.current) return;
        autoSectionRequested.current = true;
        autoCreateSection.mutate();
    }, [autoCreateSection, canEdit, sections.length, sectionsQuery.isSuccess]);

    const create = useMutation({
        mutationFn: async (payload) => {
            if (!canEdit) throw new Error('Chỉ giảng viên được chỉ định mới được chỉnh sửa nội dung lớp');
            if ((dialog === 'lesson' || dialog === 'exam') && selectedSectionPublicId && !payload.sectionPublicId) {
                payload.sectionPublicId = selectedSectionPublicId;
            }
            if (dialog === 'lesson') payload = normalizeLessonPayload(payload);
            if (payload.type !== 'CODE') delete payload.codeConfig;
            if (dialog === 'section') return lmsService.createLessonSection(publicId, payload);
            if (dialog === 'lesson') return lmsService.createLesson(publicId, payload);
            if (dialog === 'question') {
                const questionPayload = buildQuestionPayload({
                    questionType: payload.type,
                    questionContent: payload.questionContent,
                    questionOptions: payload.questionOptions,
                    questionPoints: payload.questionPoints
                });
                if (!questionPayload) throw new Error('Vui lòng nhập nội dung câu hỏi');
                return lmsService.createExamQuestion(selectedExam.publicId, questionPayload);
            }

            const exam = await lmsService.createExam(publicId, pickExamPayload(payload));
            const questionPayload = buildQuestionPayload(payload);
            if (questionPayload) {
                await lmsService.createExamQuestion(exam.publicId, questionPayload);
            }
            return exam;
        },
        onSuccess: async () => {
            toast.success('Đã lưu nội dung lớp');
            setDialog(null);
            setSelectedExam(null);
            setSelectedSectionPublicId(null);
            setContentPreset(null);
            await refresh();
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || error?.message || 'Không thể lưu nội dung lớp');
        }
    });

    const quickCreateCodeLesson = useMutation({
        mutationFn: async (sectionPublicId) => {
            if (!canEdit) throw new Error('Chỉ giảng viên được chỉ định mới được chỉnh sửa nội dung lớp');

            const sectionLessons = lessonsBySection.get(sectionPublicId) || [];
            const title = `Bài tập coding ${sectionLessons.filter((lesson) => lesson.type === 'CODE').length + 1}`;
            return lmsService.createLesson(publicId, {
                sectionPublicId: sectionPublicId === 'standalone' ? undefined : sectionPublicId,
                title,
                type: 'CODE',
                content: 'Mô tả yêu cầu bài tập coding tại đây.',
                codeConfig: defaultCodeConfig,
                isPublished: false
            });
        },
        onSuccess: async (lesson) => {
            toast.success('Đã tạo bài tập coding');
            setExpandedLessonIds((current) => new Set(current).add(lesson.publicId));
            await refresh();
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || error?.message || 'Không thể tạo bài tập coding');
        }
    });

    const reorderSections = useMutation({
        mutationFn: (items) => lmsService.reorderLessonSections(publicId, items),
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Không thể sắp xếp chương');
            queryClient.invalidateQueries({ queryKey: ['sections', publicId] });
        }
    });

    const reorderLessons = useMutation({
        mutationFn: (items) => lmsService.reorderLessons(publicId, items),
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Không thể sắp xếp bài học');
            queryClient.invalidateQueries({ queryKey: ['lessons', publicId] });
        }
    });

    const updateLessonTitle = useMutation({
        mutationFn: ({ lesson, title }) => {
            if (!canEdit) throw new Error('Chỉ giảng viên được chỉ định mới được chỉnh sửa nội dung lớp');
            return lmsService.updateLesson(lesson.publicId, { title });
        },
        onSuccess: async () => {
            toast.success('Đã đổi tiêu đề bài học');
            setEditingLesson(null);
            await queryClient.invalidateQueries({ queryKey: ['lessons', publicId] });
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Không thể đổi tiêu đề bài học');
        }
    });

    const deleteLesson = useMutation({
        mutationFn: (lesson) => {
            if (!canEdit) throw new Error('Chỉ giảng viên được chỉ định mới được chỉnh sửa nội dung lớp');
            return lmsService.deleteLesson(lesson.publicId);
        },
        onSuccess: async () => {
            toast.success('Đã xóa bài học');
            setDeleteTarget(null);
            await refresh();
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Không thể xóa bài học');
        }
    });

    const publishLesson = useMutation({
        mutationFn: (lesson) => {
            if (!canEdit) throw new Error('Chỉ giảng viên được chỉ định mới được chỉnh sửa nội dung lớp');
            return lmsService.publishLesson(lesson.publicId, !lesson.isPublished);
        },
        onSuccess: async (_data, lesson) => {
            toast.success(lesson.isPublished ? 'Đã ẩn bài giảng' : 'Đã công bố bài giảng');
            await refresh();
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Không thể cập nhật trạng thái bài giảng');
        }
    });

    const updateSectionTitle = useMutation({
        mutationFn: ({ section, title }) => {
            if (!canEdit) throw new Error('Chỉ giảng viên được chỉ định mới được chỉnh sửa nội dung lớp');
            return lmsService.updateLessonSection(section.publicId, { title });
        },
        onSuccess: async () => {
            toast.success('Đã đổi tên chương');
            setEditingSection(null);
            await queryClient.invalidateQueries({ queryKey: ['sections', publicId] });
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Không thể đổi tên chương');
        }
    });

    const deleteSection = useMutation({
        mutationFn: (section) => {
            if (!canEdit) throw new Error('Chỉ giảng viên được chỉ định mới được chỉnh sửa nội dung lớp');
            return lmsService.deleteLessonSection(section.publicId);
        },
        onSuccess: async () => {
            toast.success('Đã xóa chương');
            setDeleteTarget(null);
            await refresh();
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Không thể xóa chương');
        }
    });

    const publishExam = useMutation({
        mutationFn: (exam) => {
            if (!canEdit) throw new Error('Chỉ giảng viên được chỉ định mới được chỉnh sửa nội dung lớp');
            return lmsService.publishExam(exam.publicId, !exam.isPublished);
        },
        onSuccess: refresh
    });

    const handleDragEnd = (result) => {
        const { source, destination, type } = result;
        if (!canEdit || !destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        if (type === 'section') {
            const reordered = moveItem(sections, source.index, destination.index);
            const items = reordered.map((section, index) => ({ publicId: section.publicId, sortOrder: index + 1 }));
            const orderByPublicId = new Map(items.map((item) => [item.publicId, item.sortOrder]));

            queryClient.setQueryData(['sections', publicId], (current) =>
                patchListItems(current, (currentItems) =>
                    sortByOrder(
                        currentItems.map((section) => ({
                            ...section,
                            sortOrder: orderByPublicId.get(section.publicId) ?? section.sortOrder
                        }))
                    )
                )
            );
            reorderSections.mutate(items);
            return;
        }

        if (type === 'lesson' && source.droppableId === destination.droppableId) {
            const sectionPublicId = source.droppableId.replace('lessons:', '');
            const sectionLessons = lessonsBySection.get(sectionPublicId) || [];
            const reordered = moveItem(sectionLessons, source.index, destination.index);
            const items = reordered.map((lesson, index) => ({ publicId: lesson.publicId, sortOrder: index + 1 }));
            const orderByPublicId = new Map(items.map((item) => [item.publicId, item.sortOrder]));

            queryClient.setQueryData(['lessons', publicId], (current) =>
                patchListItems(current, (currentItems) =>
                    sortByOrder(
                        currentItems.map((lesson) => ({
                            ...lesson,
                            sortOrder: orderByPublicId.get(lesson.publicId) ?? lesson.sortOrder
                        }))
                    )
                )
            );
            reorderLessons.mutate(items);
        }
    };

    const openCurriculumItem = (sectionPublicId, item) => {
        if (item.quickCreate === 'code') {
            quickCreateCodeLesson.mutate(sectionPublicId);
            return;
        }

        setSelectedSectionPublicId(sectionPublicId === 'standalone' ? null : sectionPublicId);
        setContentPreset(item.initialValues);
        setDialog(item.dialog);
    };

    const toggleSetValue = (setValue, value) => {
        setValue((current) => {
            const next = new Set(current);
            if (next.has(value)) {
                next.delete(value);
            } else {
                next.add(value);
            }
            return next;
        });
    };

    const renderLesson = (lesson, dragProvided, lessonIndex = 0) => {
        const Icon = lessonIcon[lesson.type] || BookOpen;
        const isExpanded = expandedLessonIds.has(lesson.publicId);
        return (
            <div
                key={lesson.publicId}
                ref={dragProvided?.innerRef}
                {...(dragProvided?.draggableProps || {})}
                className="group border bg-background"
            >
                <div className="flex items-center gap-2 px-3 py-2">
                    {canEdit ? (
                        <button
                            type="button"
                            {...(dragProvided?.dragHandleProps || {})}
                            className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                            aria-label="Kéo để sắp xếp bài học"
                        >
                            <GripVertical className="size-4" />
                        </button>
                    ) : null}
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-muted">
                        <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <p className="font-medium">
                                Bài giảng {lessonIndex + 1}: {lesson.title}
                            </p>
                            {canEdit ? (
                                <span className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                                    <button
                                        type="button"
                                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        aria-label={lesson.type === 'CODE' ? 'Thiết lập bài code' : 'Sửa tiêu đề bài học'}
                                        onClick={() => {
                                            if (lesson.type === 'CODE') {
                                                navigate(`/lessons/${lesson.publicId}/code-lab`);
                                                return;
                                            }
                                            setEditingLesson(lesson);
                                        }}
                                    >
                                        <Pencil className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        aria-label="Xóa bài học"
                                        onClick={() => setDeleteTarget({ type: 'lesson', item: lesson })}
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </span>
                            ) : null}
                            <Badge variant="outline">{lesson.type}</Badge>
                            <Badge variant={lesson.isPublished ? 'default' : 'secondary'}>
                                {lesson.isPublished ? 'Đã công bố' : 'Bản nháp'}
                            </Badge>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                        onClick={() => toggleSetValue(setExpandedLessonIds, lesson.publicId)}
                        aria-label={isExpanded ? 'Thu gọn bài học' : 'Mở rộng bài học'}
                    >
                        <ChevronDown className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                {canEdit && isExpanded ? (
                    <div className="flex flex-wrap items-center gap-2 border-t px-3 py-3">
                        <Button type="button" size="sm" variant="outline">
                            <Plus className="size-4" />
                            Mô tả
                        </Button>
                        <Button type="button" size="sm" variant="outline">
                            <Plus className="size-4" />
                            Tài nguyên
                        </Button>
                        {lesson.type === 'CODE' ? (
                            <Button type="button" size="sm" variant="outline" asChild>
                                <Link to={`/lessons/${lesson.publicId}/code-lab`}>
                                    <Plus className="size-4" />
                                    Lab
                                </Link>
                            </Button>
                        ) : (
                            <Button type="button" size="sm" variant="outline" disabled>
                                <Plus className="size-4" />
                                Lab
                            </Button>
                        )}
                        <Button
                            type="button"
                            size="sm"
                            variant={lesson.isPublished ? 'secondary' : 'default'}
                            onClick={() => publishLesson.mutate(lesson)}
                            disabled={publishLesson.isPending}
                        >
                            <Eye className="size-4" />
                            {lesson.isPublished ? 'Ẩn' : 'Công bố'}
                        </Button>
                    </div>
                ) : null}
            </div>
        );
    };

    const renderExam = (exam) => (
        <div key={exam.publicId} className="flex items-start gap-3 rounded-md border border-dashed p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <ClipboardList className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{exam.title}</p>
                    <Badge variant="outline">Quiz</Badge>
                    <Badge variant={exam.isPublished ? 'default' : 'secondary'}>
                        {exam.isPublished ? 'Đã công bố' : 'Bản nháp'}
                    </Badge>
                </div>
                {exam.description ? <p className="mt-1 text-sm text-muted-foreground">{exam.description}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                    {exam.durationMinutes ? `${exam.durationMinutes} phút` : 'Không giới hạn'} ·{' '}
                    {exam.attemptCount || 0} lượt làm
                </p>
            </div>
            {canEdit ? (
                <div className="flex gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setSelectedExam(exam);
                            setDialog('question');
                        }}
                    >
                        <Plus className="size-4" />
                        Câu hỏi
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => publishExam.mutate(exam)}>
                        {exam.isPublished ? 'Ẩn' : 'Công bố'}
                    </Button>
                </div>
            ) : null}
        </div>
    );

    const sectionRows = sections.length
        ? sections
        : [
              {
                  publicId: 'standalone',
                  title: 'Nội dung chưa có chương',
                  description: 'Các bài học chưa được gắn vào chương.'
              }
          ];

    return (
        <PageShell
            title="Nội dung lớp học"
            description={classInfo ? `${classInfo.code} - ${classInfo.name}` : publicId}
        >
            <div className="flex flex-wrap items-center gap-2">
                <Button asChild type="button" variant="outline">
                    <Link to={`/classes/${publicId}/preview`}>
                        <Eye className="size-4" />
                        Xem trước
                    </Link>
                </Button>
                {canEdit ? (
                    <>
                        <Button
                            type="button"
                            onClick={() => {
                                setSelectedSectionPublicId(null);
                                setContentPreset(null);
                                setDialog('section');
                            }}
                        >
                            <Plus className="size-4" />
                            Thêm chương
                        </Button>
                    </>
                ) : (
                    <span className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                        Chỉ giảng viên được chỉ định mới được chỉnh sửa nội dung lớp này.
                    </span>
                )}
            </div>

            <div className="grid gap-4 xl:grid-cols-[260px_1fr_300px]">
                <Card className="rounded-lg">
                    <CardHeader>
                        <CardTitle className="text-base">Chương trình học</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {sectionRows.map((section, index) => (
                            <div key={section.publicId} className="rounded-md border p-3">
                                <p className="text-xs text-muted-foreground">Chương {index + 1}</p>
                                <p className="font-medium">{section.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {(lessonsBySection.get(section.publicId) || []).length} bài học ·{' '}
                                    {(examsBySection.get(section.publicId) || []).length} quiz
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="sections" type="section" isDropDisabled={!canEdit}>
                        {(sectionDropProvided) => (
                            <div
                                ref={sectionDropProvided.innerRef}
                                {...sectionDropProvided.droppableProps}
                                className="space-y-4"
                            >
                                {sectionRows.map((section, index) => {
                                    const sectionLessons = lessonsBySection.get(section.publicId) || [];
                                    const sectionExams = examsBySection.get(section.publicId) || [];
                                    const canDragSection = canEdit && section.publicId !== 'standalone';
                                    const sectionContent = (sectionDragProvided) => (
                                        <div
                                            ref={sectionDragProvided?.innerRef}
                                            {...(sectionDragProvided?.draggableProps || {})}
                                            className="group/section border border-slate-400/70 bg-muted/25 p-3"
                                        >
                                            <div className="mb-10 flex items-center gap-2 text-base">
                                                {canDragSection ? (
                                                    <button
                                                        type="button"
                                                        {...(sectionDragProvided?.dragHandleProps || {})}
                                                        className="cursor-grab rounded p-1 text-muted-foreground hover:bg-background active:cursor-grabbing"
                                                        aria-label="Kéo để sắp xếp phần"
                                                    >
                                                        <GripVertical className="size-4" />
                                                    </button>
                                                ) : null}
                                                <span className="font-semibold">Phần {index + 1}:</span>
                                                <BookOpen className="size-4" />
                                                <span>{section.title}</span>
                                                {canDragSection ? (
                                                    <span className="flex items-center gap-1 opacity-0 transition group-hover/section:opacity-100">
                                                        <button
                                                            type="button"
                                                            className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                                                            aria-label="Sửa tên chương"
                                                            onClick={() => setEditingSection(section)}
                                                        >
                                                            <Pencil className="size-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                            aria-label="Xóa chương"
                                                            onClick={() =>
                                                                setDeleteTarget({ type: 'section', item: section })
                                                            }
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </button>
                                                    </span>
                                                ) : null}
                                            </div>

                                            <Droppable
                                                droppableId={`lessons:${section.publicId}`}
                                                type="lesson"
                                                isDropDisabled={!canEdit}
                                            >
                                                {(lessonDropProvided) => (
                                                    <div
                                                        ref={lessonDropProvided.innerRef}
                                                        {...lessonDropProvided.droppableProps}
                                                        className="ml-10 space-y-3"
                                                    >
                                                        {sectionLessons.map((lesson, lessonIndex) => (
                                                            <Draggable
                                                                key={lesson.publicId}
                                                                draggableId={`lesson:${lesson.publicId}`}
                                                                index={lessonIndex}
                                                                isDragDisabled={!canEdit}
                                                            >
                                                                {(lessonDragProvided) =>
                                                                    renderLesson(
                                                                        lesson,
                                                                        lessonDragProvided,
                                                                        lessonIndex
                                                                    )
                                                                }
                                                            </Draggable>
                                                        ))}
                                                        {lessonDropProvided.placeholder}
                                                        {sectionExams.map(renderExam)}
                                                        {sectionLessons.length === 0 && sectionExams.length === 0 ? (
                                                            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                                                Chưa có bài học trong chương này.
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </Droppable>

                                            {canEdit ? (
                                                <div className="ml-10 mt-4 flex flex-wrap gap-2">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button type="button" variant="outline">
                                                                <Plus className="size-4" />
                                                                Mục trong khung chương trình
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent
                                                            align="start"
                                                            className="max-h-96 w-80 overflow-y-auto"
                                                        >
                                                            {curriculumItemTypes.map((group, groupIndex) => (
                                                                <div key={group.group}>
                                                                    {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
                                                                    {group.group ? (
                                                                        <DropdownMenuLabel>
                                                                            {group.group}
                                                                        </DropdownMenuLabel>
                                                                    ) : null}
                                                                    {group.items.map((item) => (
                                                                        <DropdownMenuItem
                                                                            key={item.label}
                                                                            className="flex flex-col items-start gap-1 whitespace-normal py-3"
                                                                            onClick={() =>
                                                                                openCurriculumItem(
                                                                                    section.publicId,
                                                                                    item
                                                                                )
                                                                            }
                                                                        >
                                                                            <span className="font-medium">
                                                                                {item.label}
                                                                            </span>
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {item.description}
                                                                            </span>
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            ) : null}
                                        </div>
                                    );

                                    return canDragSection ? (
                                        <Draggable
                                            key={section.publicId}
                                            draggableId={`section:${section.publicId}`}
                                            index={index}
                                        >
                                            {(sectionDragProvided) => sectionContent(sectionDragProvided)}
                                        </Draggable>
                                    ) : (
                                        <div key={section.publicId}>{sectionContent(null)}</div>
                                    );
                                })}
                                {sectionDropProvided.placeholder}

                                {canEdit ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedSectionPublicId(null);
                                            setContentPreset(null);
                                            setDialog('section');
                                        }}
                                    >
                                        <Plus className="size-4" />
                                        Phần
                                    </Button>
                                ) : null}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>

                <Card className="rounded-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Users className="size-4" />
                            Học viên
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-md border p-3">
                                <p className="text-muted-foreground">Sĩ số</p>
                                <p className="text-lg font-semibold">
                                    {classInfo?.enrolledCount || 0}/{classInfo?.maxStudents || 0}
                                </p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="text-muted-foreground">Bài học</p>
                                <p className="text-lg font-semibold">{lessons.length}</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {enrollments.length === 0 ? (
                                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                    Chưa có học viên.
                                </p>
                            ) : (
                                enrollments.map((enrollment) => (
                                    <div
                                        key={enrollment.student.publicId}
                                        className="flex items-center gap-2 rounded-md border p-2 text-sm"
                                    >
                                        <CheckCircle2 className="size-4 text-primary" />
                                        <span className="min-w-0">
                                            <span className="block truncate font-medium">
                                                {enrollment.student.fullName}
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {enrollment.student.email}
                                            </span>
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {canEdit ? (
                <SimpleFormDialog
                    open={Boolean(dialog)}
                    onOpenChange={(value) => {
                        if (!value) {
                            setDialog(null);
                            setSelectedExam(null);
                            setSelectedSectionPublicId(null);
                            setContentPreset(null);
                        }
                    }}
                    title={
                        dialog === 'section'
                            ? 'Thêm chương'
                            : dialog === 'lesson'
                              ? 'Thêm bài học'
                              : dialog === 'question'
                                ? `Thêm câu hỏi: ${selectedExam?.title || ''}`
                                : 'Thêm quiz'
                    }
                    fields={
                        dialog === 'section'
                            ? sectionFields
                            : dialog === 'lesson'
                              ? lessonFields
                              : dialog === 'question'
                                ? questionFields
                                : examFields
                    }
                    initialValues={contentPreset}
                    onSubmit={(payload) => create.mutate(payload)}
                    submitting={create.isPending}
                />
            ) : null}
            {canEdit ? (
                <SimpleFormDialog
                    open={Boolean(editingLesson)}
                    onOpenChange={(value) => {
                        if (!value) setEditingLesson(null);
                    }}
                    title="Sửa tiêu đề bài học"
                    fields={[{ name: 'title', label: 'Tiêu đề' }]}
                    initialValues={editingLesson ? { title: editingLesson.title } : null}
                    onSubmit={(payload) => {
                        const title = payload.title?.trim();
                        if (!title) {
                            toast.error('Vui lòng nhập tiêu đề bài học');
                            return;
                        }
                        updateLessonTitle.mutate({ lesson: editingLesson, title });
                    }}
                    submitting={updateLessonTitle.isPending}
                />
            ) : null}
            {canEdit ? (
                <SimpleFormDialog
                    open={Boolean(editingSection)}
                    onOpenChange={(value) => {
                        if (!value) setEditingSection(null);
                    }}
                    title="Sửa tên chương"
                    fields={[{ name: 'title', label: 'Tên chương' }]}
                    initialValues={editingSection ? { title: editingSection.title } : null}
                    onSubmit={(payload) => {
                        const title = payload.title?.trim();
                        if (!title) {
                            toast.error('Vui lòng nhập tên chương');
                            return;
                        }
                        updateSectionTitle.mutate({ section: editingSection, title });
                    }}
                    submitting={updateSectionTitle.isPending}
                />
            ) : null}
            <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {deleteTarget?.type === 'section' ? 'Xóa chương?' : 'Xóa bài học?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget?.type === 'section'
                                ? `Chương "${deleteTarget?.item?.title || ''}" sẽ bị xóa khỏi khung chương trình.`
                                : `Bài học "${deleteTarget?.item?.title || ''}" sẽ bị xóa khỏi chương này.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLesson.isPending || deleteSection.isPending}>
                            Hủy
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleteLesson.isPending || deleteSection.isPending}
                            onClick={(event) => {
                                event.preventDefault();
                                if (deleteTarget?.type === 'section') {
                                    deleteSection.mutate(deleteTarget.item);
                                    return;
                                }
                                if (deleteTarget?.type === 'lesson') {
                                    deleteLesson.mutate(deleteTarget.item);
                                }
                            }}
                        >
                            Xóa
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PageShell>
    );
}
