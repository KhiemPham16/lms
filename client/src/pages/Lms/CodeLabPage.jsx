import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileCode2, Plus, PlayCircle, Save, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Textarea } from '~/components/ui/textarea';
import lmsService from '~/services/lms.service';
import useAuthStore from '~/stores/auth.store';

const fallbackFiles = [
    {
        path: 'App.js',
        language: 'javascript',
        content: "import React from 'react';\n\nexport default function App() {\n  return <h1>Hello, world!</h1>;\n}\n"
    },
    {
        path: 'App.spec.js',
        language: 'javascript',
        readonly: true,
        content:
            "describe('App component', () => {\n  test('should render', () => {\n    // TODO: customize test\n  });\n});\n"
    }
];

const languageLabel = {
    html: 'HTML',
    css: 'CSS',
    javascript: 'JavaScript',
    jsx: 'JSX',
    typescript: 'TypeScript',
    python: 'Python',
    java: 'Java',
    csharp: 'C#',
    json: 'JSON'
};

const testTypes = [
    { value: 'TEXT_CONTAINS', label: 'File chứa text' },
    { value: 'TEXT_NOT_CONTAINS', label: 'File không chứa text' },
    { value: 'REGEX_MATCH', label: 'Khớp regex' },
    { value: 'FILE_EXISTS', label: 'File tồn tại' }
];

const cloneFiles = (files) => files.map((file) => ({ ...file, content: file.content ?? '' }));

const parseCodeConfig = (lesson) => {
    const config = lesson?.codeConfig && typeof lesson.codeConfig === 'object' ? lesson.codeConfig : {};
    const files = Array.isArray(config.files) && config.files.length ? config.files : fallbackFiles;
    return {
        instructions: config.instructions || lesson?.content || '',
        files: cloneFiles(files),
        tests: Array.isArray(config.tests) ? config.tests : []
    };
};

function CodeResult({ result }) {
    if (!result) return <p className="text-sm text-muted-foreground">Chạy kiểm tra để xem kết quả tại đây.</p>;
    const tests = Array.isArray(result.results) ? result.results : [];

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3">
                <span className="flex items-center gap-2 font-medium">
                    {result.passed ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                        <XCircle className="size-4 text-destructive" />
                    )}
                    {result.passed ? 'Đạt yêu cầu' : 'Chưa đạt'}
                </span>
                <Badge variant={result.passed ? 'default' : 'destructive'}>{result.score ?? 0} điểm</Badge>
            </div>
            {tests.length ? (
                tests.map((test, index) => (
                    <div key={`${test.name}-${index}`} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{test.name || `Kiểm tra ${index + 1}`}</span>
                            <Badge variant={test.passed ? 'default' : 'destructive'}>{test.passed ? 'Đạt' : 'Sai'}</Badge>
                        </div>
                        {test.message ? <p className="mt-1 text-xs text-muted-foreground">{test.message}</p> : null}
                    </div>
                ))
            ) : (
                <p className="text-sm text-muted-foreground">Bài này chưa có test tự động.</p>
            )}
        </div>
    );
}

export default function CodeLabPage() {
    const { publicId } = useParams();
    const navigate = useNavigate();
    const currentUser = useAuthStore((state) => state.user);
    const isStudent = currentUser?.role?.code === 'STUDENT' || currentUser?.role === 'STUDENT';
    const [instructions, setInstructions] = useState(null);
    const [files, setFiles] = useState(null);
    const [tests, setTests] = useState(null);
    const [activeFilePath, setActiveFilePath] = useState(fallbackFiles[0].path);
    const [result, setResult] = useState(null);

    const lessonQuery = useQuery({
        queryKey: ['lesson', publicId],
        queryFn: () => lmsService.getLesson(publicId)
    });
    const lesson = lessonQuery.data;
    const backTo = lesson?.class?.publicId
        ? isStudent
            ? `/classes/${lesson.class.publicId}/learn`
            : `/classes/${lesson.class.publicId}/content`
        : '/courses';

    useEffect(() => {
        if (isStudent && lesson?.class?.publicId) {
            navigate(`/classes/${lesson.class.publicId}/learn`, { replace: true });
        }
    }, [isStudent, lesson?.class?.publicId, navigate]);

    const initialConfig = useMemo(() => parseCodeConfig(lesson), [lesson]);
    const draftInstructions = instructions ?? initialConfig.instructions;
    const draftFiles = files ?? initialConfig.files;
    const draftTests = tests ?? initialConfig.tests;
    const activeFile = draftFiles.find((file) => file.path === activeFilePath) || draftFiles[0] || null;
    const runnableFiles = useMemo(() => draftFiles.filter((file) => !file.readonly), [draftFiles]);

    const saveLab = useMutation({
        mutationFn: () =>
            lmsService.updateLesson(publicId, {
                type: 'CODE',
                content: draftInstructions,
                codeConfig: {
                    template: lesson?.codeConfig?.template || 'CUSTOM',
                    instructions: draftInstructions,
                    files: draftFiles,
                    tests: draftTests
                }
            }),
        onSuccess: () => toast.success('Đã lưu lab'),
        onError: (error) => toast.error(error?.response?.data?.message || 'Không thể lưu lab')
    });

    const checkCode = useMutation({
        mutationFn: () => lmsService.checkCodeLesson(publicId, { files: runnableFiles }),
        onSuccess: (data) => {
            setResult(data);
            toast.success('Đã chạy kiểm tra');
        },
        onError: (error) => toast.error(error?.response?.data?.message || 'Không thể kiểm tra code')
    });

    const submitCode = useMutation({
        mutationFn: () => lmsService.submitCodeLesson(publicId, { files: runnableFiles }),
        onSuccess: (data) => {
            setResult(data);
            toast.success(data.passed ? 'Nộp bài thành công' : 'Đã nộp, nhưng bài chưa đạt');
        },
        onError: (error) => toast.error(error?.response?.data?.message || 'Không thể nộp bài')
    });

    const updateFile = (path, patch) => {
        setFiles((current) =>
            (current ?? draftFiles).map((file) => (file.path === path ? { ...file, ...patch } : file))
        );
    };

    const addFile = () => {
        const nextIndex = draftFiles.length + 1;
        const file = { path: `file${nextIndex}.js`, language: 'javascript', content: '' };
        setFiles((current) => [...(current ?? draftFiles), file]);
        setActiveFilePath(file.path);
    };

    const removeFile = (path) => {
        const next = draftFiles.filter((file) => file.path !== path);
        const safeNext = next.length ? next : fallbackFiles;
        setFiles(safeNext);
        setActiveFilePath(safeNext[0]?.path || '');
    };

    const addTest = () => {
        setTests((current) => [
            ...(current ?? draftTests),
            {
                name: `Kiểm tra ${(current ?? draftTests).length + 1}`,
                type: 'TEXT_CONTAINS',
                file: draftFiles[0]?.path || '',
                expected: ''
            }
        ]);
    };

    const updateTest = (index, patch) => {
        setTests((current) =>
            (current ?? draftTests).map((test, testIndex) => (testIndex === index ? { ...test, ...patch } : test))
        );
    };

    const removeTest = (index) => {
        setTests((current) => (current ?? draftTests).filter((_, testIndex) => testIndex !== index));
    };

    return (
        <div className="flex min-h-screen flex-col bg-white text-slate-950">
            <header className="flex h-14 items-center justify-between border-b px-4">
                <div className="flex min-w-0 items-center gap-4">
                    <Button asChild type="button" variant="ghost">
                        <Link to={backTo}>
                            <ArrowLeft className="size-4" />
                            Quay lại chương trình giảng dạy
                        </Link>
                    </Button>
                    <h1 className="truncate font-semibold">{lesson?.title || 'Bài tập coding'}</h1>
                </div>
                <div className="flex items-center gap-2">
                    {!isStudent ? (
                        <Button type="button" variant="outline" onClick={() => saveLab.mutate()} disabled={saveLab.isPending}>
                            <Save className="size-4" />
                            Lưu
                        </Button>
                    ) : null}
                    <Button type="button" variant="outline" onClick={() => checkCode.mutate()} disabled={checkCode.isPending}>
                        <PlayCircle className="size-4" />
                        Chạy kiểm tra
                    </Button>
                    {isStudent ? (
                        <Button type="button" onClick={() => submitCode.mutate()} disabled={submitCode.isPending}>
                            Nộp bài
                        </Button>
                    ) : null}
                </div>
            </header>

            <main className="grid min-h-0 flex-1 lg:grid-cols-[43%_57%]">
                <section className="min-h-0 border-r bg-white">
                    <Tabs defaultValue="guide" className="flex h-full flex-col">
                        <TabsList className="h-12 justify-start rounded-none border-b bg-white px-4">
                            <TabsTrigger value="guide">Hướng dẫn</TabsTrigger>
                            <TabsTrigger value="tests">Spec/Test</TabsTrigger>
                            <TabsTrigger value="result">Kết quả</TabsTrigger>
                        </TabsList>
                        <TabsContent value="guide" className="m-0 min-h-0 flex-1 overflow-auto p-4">
                            {!isStudent ? (
                                <Textarea
                                    value={draftInstructions}
                                    onChange={(event) => setInstructions(event.target.value)}
                                    className="min-h-[calc(100vh-9rem)] resize-none border-0 text-base leading-7 shadow-none focus-visible:ring-0"
                                    placeholder="Viết hướng dẫn cho học viên ở đây."
                                />
                            ) : (
                                <article className="prose prose-slate max-w-none whitespace-pre-wrap text-sm leading-7">
                                    {draftInstructions || 'Bài này chưa có hướng dẫn.'}
                                </article>
                            )}
                        </TabsContent>
                        <TabsContent value="tests" className="m-0 min-h-0 flex-1 overflow-auto p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <h2 className="font-semibold">Bộ kiểm tra</h2>
                                    <p className="text-sm text-muted-foreground">Spec dùng để so sánh bài làm đúng kết quả hay chưa.</p>
                                </div>
                                {!isStudent ? (
                                    <Button type="button" variant="outline" onClick={addTest}>
                                        <Plus className="size-4" />
                                        Test
                                    </Button>
                                ) : null}
                            </div>
                            <div className="space-y-3">
                                {draftTests.length === 0 ? (
                                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                        Chưa có test tự động.
                                    </p>
                                ) : (
                                    draftTests.map((test, index) => (
                                        <div key={index} className="space-y-2 rounded-md border p-3">
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={test.name || ''}
                                                    readOnly={isStudent}
                                                    onChange={(event) => updateTest(index, { name: event.target.value })}
                                                    placeholder="Tên test"
                                                />
                                                {!isStudent ? (
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeTest(index)}>
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                ) : null}
                                            </div>
                                            <div className="grid gap-2 md:grid-cols-3">
                                                <select
                                                    value={test.type || 'TEXT_CONTAINS'}
                                                    disabled={isStudent}
                                                    onChange={(event) => updateTest(index, { type: event.target.value })}
                                                    className="h-9 rounded-md border bg-transparent px-3 text-sm"
                                                >
                                                    {testTypes.map((type) => (
                                                        <option key={type.value} value={type.value}>
                                                            {type.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <Input
                                                    value={test.file || ''}
                                                    readOnly={isStudent}
                                                    onChange={(event) => updateTest(index, { file: event.target.value })}
                                                    placeholder="File"
                                                />
                                                <Input
                                                    value={test.expected || ''}
                                                    readOnly={isStudent}
                                                    onChange={(event) => updateTest(index, { expected: event.target.value })}
                                                    placeholder="Kết quả mong đợi"
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </TabsContent>
                        <TabsContent value="result" className="m-0 min-h-0 flex-1 overflow-auto p-4">
                            <CodeResult result={result} />
                        </TabsContent>
                    </Tabs>
                </section>

                <section className="flex min-h-0 flex-col bg-[#1e1e1e] text-slate-100">
                    <div className="flex h-10 items-center justify-between border-b border-white/10 bg-[#2f3142] px-4">
                        <span className="font-semibold">File code</span>
                        {!isStudent ? (
                            <Button type="button" size="sm" variant="secondary" onClick={addFile}>
                                <Plus className="size-4" />
                                File
                            </Button>
                        ) : null}
                    </div>
                    <div className="flex min-h-11 items-center overflow-x-auto border-b border-white/10 bg-[#252526]">
                        {draftFiles.map((file) => (
                            <button
                                key={file.path}
                                type="button"
                                onClick={() => setActiveFilePath(file.path)}
                                className={`flex items-center gap-2 border-r border-white/10 px-4 py-3 text-sm ${
                                    activeFile?.path === file.path ? 'bg-[#1e1e1e] text-white' : 'text-slate-300 hover:bg-white/5'
                                }`}
                            >
                                <FileCode2 className="size-4" />
                                {file.path}
                            </button>
                        ))}
                    </div>
                    {activeFile ? (
                        <>
                            <div className="flex items-center gap-2 border-b border-white/10 bg-[#2f3142] px-4 py-2">
                                {!isStudent ? (
                                    <>
                                        <Input
                                            value={activeFile.path}
                                            onChange={(event) => updateFile(activeFile.path, { path: event.target.value })}
                                            className="h-8 max-w-56 border-white/20 bg-[#1e1e1e] text-white"
                                        />
                                        <select
                                            value={activeFile.language || 'javascript'}
                                            onChange={(event) => updateFile(activeFile.path, { language: event.target.value })}
                                            className="h-8 rounded-md border border-white/20 bg-[#1e1e1e] px-2 text-sm"
                                        >
                                            {Object.entries(languageLabel).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                        <Button type="button" size="sm" variant="ghost" onClick={() => removeFile(activeFile.path)}>
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <span className="text-sm text-slate-300">
                                        {activeFile.path} · {languageLabel[activeFile.language] || activeFile.language}
                                    </span>
                                )}
                            </div>
                            <div className="grid min-h-0 flex-1 grid-cols-[56px_1fr] overflow-hidden">
                                <pre className="select-none overflow-hidden border-r border-white/10 bg-[#1b1b1b] py-4 text-right text-sm leading-6 text-slate-500">
                                    {(activeFile.content || '').split('\n').map((_, index) => (
                                        <span key={index} className="block px-3">
                                            {index + 1}
                                        </span>
                                    ))}
                                </pre>
                                <textarea
                                    value={activeFile.content || ''}
                                    readOnly={isStudent ? activeFile.readonly : false}
                                    onChange={(event) => updateFile(activeFile.path, { content: event.target.value })}
                                    spellCheck={false}
                                    className="min-h-[calc(100vh-11.25rem)] resize-none overflow-auto bg-[#1e1e1e] p-4 font-mono text-sm leading-6 text-slate-100 outline-none"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-1 items-center justify-center text-slate-400">Chưa có file code.</div>
                    )}
                </section>
            </main>
        </div>
    );
}
