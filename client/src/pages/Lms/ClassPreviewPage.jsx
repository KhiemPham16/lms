import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronDown, PlayCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import lmsService from '~/services/lms.service';
import useAuthStore from '~/stores/auth.store';
import { resolveMediaUrl } from '~/utils/media-url';
import { normalizeList } from './utils';

const looksLikeHtml = (value = '') => /<\/?[a-z][\s\S]*>/i.test(value);
const languageLabel = { html: 'HTML', css: 'CSS', javascript: 'JavaScript', jsx: 'JSX', typescript: 'TypeScript', python: 'Python', java: 'Java', csharp: 'C#', json: 'JSON' };
const languageIcon = { html: '5', css: '#', javascript: 'JS', jsx: 'JSX', typescript: 'TS', python: 'PY', java: 'J', csharp: 'C#', json: '{}' };

const getYoutubeVideoId = (value = '') => {
    const directId = value.match(/^[A-Za-z0-9_-]{11}$/)?.[0];
    if (directId) return directId;

    try {
        const url = new URL(value);
        if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || null;
        if (url.hostname.includes('youtube.com')) {
            return url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1] || null;
        }
    } catch {
        return null;
    }

    return null;
};

const getYoutubeEmbedUrl = (value = '') => {
    const videoId = getYoutubeVideoId(value);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
};

let youtubeApiPromise;

const loadYoutubeApi = () => {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (youtubeApiPromise) return youtubeApiPromise;

    youtubeApiPromise = new Promise((resolve) => {
        const previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previousReady?.();
            resolve(window.YT);
        };

        if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            document.body.appendChild(script);
        }
    });

    return youtubeApiPromise;
};

function ArticleContent({ content }) {
    if (!content) return <p className="text-muted-foreground">Nội dung bài học sẽ hiển thị ở đây.</p>;
    if (looksLikeHtml(content)) return <div dangerouslySetInnerHTML={{ __html: content }} />;

    return content
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => <p key={block} className="whitespace-pre-wrap">{block}</p>);
}

const parseCodeConfig = (item) => {
    if (item?.codeConfig && typeof item.codeConfig === 'object' && !Array.isArray(item.codeConfig)) {
        return {
            instructions: item.codeConfig.instructions || '',
            files: Array.isArray(item.codeConfig.files) ? item.codeConfig.files : []
        };
    }
    return { instructions: '', files: [] };
};

const fallbackCodeFile = (item) => ({
    path: 'index.html',
    language: 'html',
    content: item?.content || '<!DOCTYPE html>\n<html>\n  <body>\n    \n  </body>\n</html>'
});

const cloneFiles = (files) => files.map((file) => ({ ...file, content: file.content ?? '' }));

function CodeResultPanel({ result }) {
    if (!result) return null;
    const tests = Array.isArray(result.results) ? result.results : [];
    return (
        <div className="border-t border-white/10 bg-[#101114] p-4 text-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                    {result.passed ? <CheckCircle2 className="size-4 text-emerald-400" /> : <XCircle className="size-4 text-red-400" />}
                    <span>{result.passed ? 'Đã vượt qua kiểm tra' : 'Chưa đạt yêu cầu'}</span>
                </div>
                <span className="text-slate-400">Điểm: {result.score ?? 0}</span>
            </div>
            {tests.length ? (
                <div className="mt-3 space-y-2">
                    {tests.map((test, index) => (
                        <div key={`${test.name || index}`} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                                <span>{test.name || `Kiểm tra ${index + 1}`}</span>
                                <Badge variant={test.passed ? 'default' : 'destructive'}>{test.passed ? 'Đạt' : 'Sai'}</Badge>
                            </div>
                            {test.message ? <p className="mt-1 text-xs text-slate-400">{test.message}</p> : null}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="mt-2 text-xs text-slate-400">Bài này chưa cấu hình test tự động.</p>
            )}
        </div>
    );
}

export default function ClassPreviewPage({ mode = 'preview' }) {
    const { publicId } = useParams();
    const [selectedItemId, setSelectedItemId] = useState('');
    const [selectedCodeFilePath, setSelectedCodeFilePath] = useState('');
    const [editedFilesByLesson, setEditedFilesByLesson] = useState({});
    const [codeResult, setCodeResult] = useState(null);
    const [collapsedSectionIds, setCollapsedSectionIds] = useState(() => new Set());
    const [codeGuideTab, setCodeGuideTab] = useState('guide');
    const completedVideoIdsRef = useRef(new Set());
    const youtubeFrameRef = useRef(null);
    const youtubePlayerRef = useRef(null);
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((state) => state.user);
    const isStudent = currentUser?.role?.code === 'STUDENT' || currentUser?.role === 'STUDENT';
    const isLearnMode = mode === 'learn';
    const canBackToEditor = mode === 'preview' && currentUser?.role?.code && currentUser.role.code !== 'STUDENT';

    const classQuery = useQuery({ queryKey: ['class', publicId], queryFn: () => lmsService.getClass(publicId) });
    const sectionsQuery = useQuery({ queryKey: ['sections', publicId], queryFn: () => lmsService.listLessonSections(publicId) });
    const lessonsQuery = useQuery({ queryKey: ['lessons', publicId], queryFn: () => lmsService.listLessons(publicId, { limit: 100 }) });
    const examsQuery = useQuery({ queryKey: ['exams', publicId], queryFn: () => lmsService.listExams(publicId) });

    const classInfo = classQuery.data;
    const sections = normalizeList(sectionsQuery.data).items;
    const lessons = normalizeList(lessonsQuery.data).items;
    const exams = normalizeList(examsQuery.data).items;

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

    const sectionRows = useMemo(() => {
        const map = new Map();
        sections.forEach((section) => map.set(section.publicId, section));
        [...lessons, ...exams].forEach((item) => {
            if (item.section?.publicId && !map.has(item.section.publicId)) {
                map.set(item.section.publicId, {
                    publicId: item.section.publicId,
                    title: item.section.title,
                    description: item.section.description
                });
            }
        });
        return map.size ? Array.from(map.values()) : [{ publicId: 'standalone', title: 'Nội dung chưa có chương' }];
    }, [sections, lessons, exams]);

    const previewItems = sectionRows.flatMap((section, sectionIndex) => [
        ...(lessonsBySection.get(section.publicId) || []).map((item, itemIndex) => ({ ...item, kind: 'lesson', section, sectionIndex, itemIndex })),
        ...(examsBySection.get(section.publicId) || []).map((item, itemIndex) => ({ ...item, kind: 'exam', section, sectionIndex, itemIndex }))
    ]);
    const completedItemCount = previewItems.filter((item) => item.progress?.isCompleted).length;
    const progressPercent = previewItems.length > 0 ? Math.round((completedItemCount / previewItems.length) * 100) : 0;
    const selectedItem = previewItems.find((item) => item.publicId === selectedItemId) || previewItems[0] || null;
    const selectedYoutubeEmbedUrl =
        selectedItem?.type === 'VIDEO' ? getYoutubeEmbedUrl(selectedItem.resourceUrl) : '';
    const headerTitle = [classInfo?.name || (isLearnMode ? 'Lớp học' : 'Xem trước lớp học'), classInfo?.lecturer?.fullName]
        .filter(Boolean)
        .join(' - ');
    const codeConfig = useMemo(
        () => (selectedItem?.type === 'CODE' ? parseCodeConfig(selectedItem) : { instructions: '', files: [] }),
        [selectedItem]
    );
    const templateCodeFiles = useMemo(
        () => (selectedItem?.type === 'CODE' ? (codeConfig.files.length ? codeConfig.files : [fallbackCodeFile(selectedItem)]) : []),
        [codeConfig.files, selectedItem]
    );
    const codeFiles = isLearnMode && selectedItem?.publicId ? editedFilesByLesson[selectedItem.publicId] || templateCodeFiles : templateCodeFiles;
    const selectedCodeFile = codeFiles.find((file) => file.path === selectedCodeFilePath) || codeFiles[0] || null;
    const browserPreviewHtml = useMemo(() => {
        const htmlFile = codeFiles.find((file) => file.language === 'html' || file.path.endsWith('.html'));
        const cssFiles = codeFiles.filter((file) => file.language === 'css' || file.path.endsWith('.css'));
        const jsFiles = codeFiles.filter((file) => ['javascript', 'js'].includes(file.language) || file.path.endsWith('.js'));
        const html = htmlFile?.content || '<!DOCTYPE html><html><head></head><body></body></html>';
        const styles = cssFiles.map((file) => `<style data-file="${file.path}">\n${file.content || ''}\n</style>`).join('\n');
        const scripts = jsFiles.map((file) => `<script data-file="${file.path}">\n${file.content || ''}\n</script>`).join('\n');

        return html.includes('</head>')
            ? html.replace('</head>', `${styles}\n</head>`).replace('</body>', `${scripts}\n</body>`)
            : `<!DOCTYPE html><html><head>${styles}</head><body>${html}${scripts}</body></html>`;
    }, [codeFiles]);

    const checkCode = useMutation({
        mutationFn: () => lmsService.checkCodeLesson(selectedItem.publicId, { files: codeFiles }),
        onSuccess: (result) => {
            setCodeResult({ lessonPublicId: selectedItem.publicId, ...result });
            toast.success('Đã kiểm tra bài code');
        },
        onError: (error) => toast.error(error?.response?.data?.message || 'Không thể kiểm tra bài code')
    });

    const submitCode = useMutation({
        mutationFn: () => lmsService.submitCodeLesson(selectedItem.publicId, { files: codeFiles }),
        onSuccess: async (result) => {
            setCodeResult({ lessonPublicId: selectedItem.publicId, ...result });
            toast.success(result.passed ? 'Nộp bài thành công' : 'Đã nộp, nhưng bài chưa đạt yêu cầu');
            await queryClient.invalidateQueries({ queryKey: ['lessons', publicId] });
        },
        onError: (error) => toast.error(error?.response?.data?.message || 'Không thể nộp bài code')
    });

    const completeLesson = useMutation({
        mutationFn: (lesson) => lmsService.completeLesson(lesson.publicId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['lessons', publicId] });
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Không thể cập nhật tiến độ bài học');
        }
    });

    const completeVideoIfEnough = useCallback((lesson, currentTime, duration) => {
        if (!isLearnMode || !lesson || lesson.type !== 'VIDEO') return;
        if (lesson.progress?.isCompleted || completedVideoIdsRef.current.has(lesson.publicId)) return;
        if (!duration || duration <= 0 || currentTime / duration < 0.6) return;

        completedVideoIdsRef.current.add(lesson.publicId);
        completeLesson.mutate(lesson);
    }, [completeLesson, isLearnMode]);

    useEffect(() => {
        const frame = youtubeFrameRef.current;
        if (!isLearnMode || !selectedItem || selectedItem.type !== 'VIDEO' || !selectedYoutubeEmbedUrl || !frame) {
            youtubePlayerRef.current?.destroy?.();
            youtubePlayerRef.current = null;
            return undefined;
        }

        let intervalId;
        let cancelled = false;

        loadYoutubeApi().then((YT) => {
            if (cancelled || !youtubeFrameRef.current) return;

            youtubePlayerRef.current?.destroy?.();
            youtubePlayerRef.current = new YT.Player(youtubeFrameRef.current, {
                events: {
                    onStateChange: (event) => {
                        if (event.data === YT.PlayerState.PLAYING) {
                            window.clearInterval(intervalId);
                            intervalId = window.setInterval(() => {
                                const player = youtubePlayerRef.current;
                                completeVideoIfEnough(selectedItem, player?.getCurrentTime?.(), player?.getDuration?.());
                            }, 1000);
                        } else {
                            window.clearInterval(intervalId);
                        }
                    }
                }
            });
        });

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            youtubePlayerRef.current?.destroy?.();
            youtubePlayerRef.current = null;
        };
    }, [completeVideoIfEnough, isLearnMode, selectedItem, selectedYoutubeEmbedUrl]);

    const updateSelectedCode = (content) => {
        if (!selectedItem?.publicId || !selectedCodeFile) return;
        setEditedFilesByLesson((current) => ({
            ...current,
            [selectedItem.publicId]: (current[selectedItem.publicId] || cloneFiles(templateCodeFiles)).map((file) =>
                file.path === selectedCodeFile.path ? { ...file, content } : file
            )
        }));
    };

    const toggleSection = (sectionPublicId) => {
        setCollapsedSectionIds((current) => {
            const next = new Set(current);
            if (next.has(sectionPublicId)) next.delete(sectionPublicId);
            else next.add(sectionPublicId);
            return next;
        });
    };

    const renderMainContent = () => {
        if (!selectedItem) {
            return <div className="flex h-full items-center justify-center text-muted-foreground">Chưa có nội dung để học.</div>;
        }

        if (selectedItem.kind === 'exam') {
            return (
                <div className="p-6">
                    <div className="rounded-lg border border-dashed p-6 text-center">
                        <h2 className="font-semibold">Bài kiểm tra</h2>
                        <p className="mt-2 text-sm text-muted-foreground">Học viên sẽ làm quiz tại đây sau khi bài kiểm tra được công bố.</p>
                        <Button type="button" className="mt-4">Kiểm tra</Button>
                    </div>
                </div>
            );
        }

        if (selectedItem.type === 'VIDEO') {
            const videoUrl = resolveMediaUrl(selectedItem.resourceUrl);
            const youtubeUrl = selectedYoutubeEmbedUrl
                ? `${selectedYoutubeEmbedUrl}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
                : '';

            return (
                <div>
                    <div className="bg-black">
                        <div className="mx-auto flex aspect-video max-h-[calc(100vh-16rem)] w-full items-center justify-center overflow-hidden bg-black">
                            {selectedYoutubeEmbedUrl ? (
                                <iframe
                                    ref={youtubeFrameRef}
                                    src={youtubeUrl}
                                    title={selectedItem.title}
                                    className="h-full w-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                />
                            ) : selectedItem.resourceUrl ? (
                                <video
                                    src={videoUrl}
                                    className="h-full w-full object-contain"
                                    controls
                                    onTimeUpdate={(event) => {
                                        completeVideoIfEnough(
                                            selectedItem,
                                            event.currentTarget.currentTime,
                                            event.currentTarget.duration
                                        );
                                    }}
                                />
                            ) : (
                                <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 text-white">
                                    <div className="flex size-20 items-center justify-center rounded-full bg-white/20"><PlayCircle className="size-12" /></div>
                                    <p className="mt-4 text-sm text-white/70">Chưa gắn video cho bài học này.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-4 px-8 py-7">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                                <h2 className="text-3xl font-semibold">{selectedItem.title}</h2>
                                {selectedItem.durationMinutes ? <p className="mt-2 text-sm text-muted-foreground">Thời lượng {selectedItem.durationMinutes} phút</p> : null}
                            </div>
                        </div>
                        {selectedItem.description ? <p className="text-sm text-muted-foreground">{selectedItem.description}</p> : null}
                        {selectedItem.content ? <ArticleContent content={selectedItem.content} /> : null}
                    </div>
                </div>
            );
        }

        if (selectedItem.type === 'CODE') {
            return (
                <div className="grid min-h-[calc(100vh-48px)] lg:grid-cols-[45%_55%]">
                    <section className="border-b p-8 lg:border-b-0 lg:border-r">
                        <div className="mb-6 grid grid-cols-2 border-b text-center text-sm font-semibold">
                            <button
                                type="button"
                                className={`px-4 py-3 ${codeGuideTab === 'guide' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={() => setCodeGuideTab('guide')}
                            >
                                Nội dung
                            </button>
                            <button
                                type="button"
                                className={`px-4 py-3 ${codeGuideTab === 'browser' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={() => setCodeGuideTab('browser')}
                            >
                                Trình duyệt
                            </button>
                        </div>
                        {codeGuideTab === 'guide' ? (
                            <article className="prose prose-slate max-w-none text-[15px] leading-8">
                                <h2>{selectedItem.title}</h2>
                                {selectedItem.description ? <p className="text-muted-foreground">{selectedItem.description}</p> : null}
                                <ArticleContent content={codeConfig.instructions || selectedItem.content} />
                                {!isStudent ? (
                                    <Button asChild type="button" className="mt-4">
                                        <Link to={`/lessons/${selectedItem.publicId}/code-lab`}>Mở trang lab coding</Link>
                                    </Button>
                                ) : null}
                            </article>
                        ) : (
                            <div className="overflow-hidden rounded-lg border bg-white">
                                <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                                    Xem trước kết quả HTML/CSS/JS
                                </div>
                                <iframe
                                    title="Xem trước bài code"
                                    className="h-[calc(100vh-13rem)] min-h-96 w-full bg-white"
                                    sandbox="allow-scripts"
                                    srcDoc={browserPreviewHtml}
                                />
                            </div>
                        )}
                    </section>
                    <section className="flex min-w-0 flex-col bg-[#1e1e1e] text-slate-100">
                        <div className="flex min-h-11 items-center overflow-x-auto border-b border-white/10 bg-[#252526]">
                            {codeFiles.map((file) => (
                                <button key={file.path} type="button" onClick={() => setSelectedCodeFilePath(file.path)} className={`flex items-center gap-2 border-r border-white/10 px-4 py-3 text-sm ${selectedCodeFile?.path === file.path ? 'bg-[#1e1e1e] text-white' : 'text-slate-300 hover:bg-white/5'}`}>
                                    <span className="text-xs text-orange-400">{languageIcon[file.language] || '<>'}</span>{file.path}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-slate-400">
                            <span>{selectedCodeFile ? languageLabel[selectedCodeFile.language] || selectedCodeFile.language : 'Code'}</span>
                            <span>{isLearnMode ? 'Chế độ làm bài' : 'Chế độ xem trước'}</span>
                        </div>
                        <div className="grid flex-1 grid-cols-[56px_1fr] overflow-hidden">
                            <pre className="select-none overflow-hidden border-r border-white/10 bg-[#1b1b1b] py-4 text-right text-sm leading-6 text-slate-500">
                                {(selectedCodeFile?.content || '').split('\n').map((_, index) => <span key={index} className="block px-3">{index + 1}</span>)}
                            </pre>
                            {isLearnMode ? (
                                <textarea
                                    value={selectedCodeFile?.content || ''}
                                    onChange={(event) => updateSelectedCode(event.target.value)}
                                    spellCheck={false}
                                    className="min-h-[420px] resize-none overflow-auto bg-[#1e1e1e] p-4 font-mono text-sm leading-6 text-slate-100 outline-none"
                                />
                            ) : (
                                <pre className="overflow-auto p-4 text-sm leading-6 text-slate-100"><code>{selectedCodeFile?.content || '// Chưa có nội dung file'}</code></pre>
                            )}
                        </div>
                        {isLearnMode ? (
                            <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-[#15161a] p-3">
                                <Button type="button" variant="secondary" onClick={() => checkCode.mutate()} disabled={checkCode.isPending || submitCode.isPending}>
                                    Kiểm tra
                                </Button>
                                <Button type="button" onClick={() => submitCode.mutate()} disabled={checkCode.isPending || submitCode.isPending}>
                                    Nộp bài
                                </Button>
                            </div>
                        ) : null}
                        <CodeResultPanel result={codeResult?.lessonPublicId === selectedItem.publicId ? codeResult : null} />
                    </section>
                </div>
            );
        }

        return (
            <article className="mx-auto max-w-4xl px-8 py-12">
                <header className="mb-8">
                    <h2 className="text-3xl font-semibold tracking-normal">{selectedItem.title}</h2>
                    <p className="mt-3 text-sm text-muted-foreground">{selectedItem.durationMinutes ? `Thời lượng ${selectedItem.durationMinutes} phút` : 'Bài đọc'}</p>
                </header>
                {selectedItem.description ? <div className="mb-8 border-l-4 border-primary py-1 pl-5 text-sm font-semibold text-muted-foreground">{selectedItem.description}</div> : null}
                <div className="prose prose-slate max-w-none text-[15px] leading-8">
                    <ArticleContent content={selectedItem.content} />
                    {selectedItem.resourceUrl ? <p><a href={resolveMediaUrl(selectedItem.resourceUrl)} target="_blank" rel="noreferrer">Mở tài nguyên</a></p> : null}
                </div>
            </article>
        );
    };

    return (
        <div className="min-h-screen bg-white text-slate-950">
            <header className="flex h-12 items-center justify-between bg-slate-900 px-4 text-white">
                <div className="flex min-w-0 items-center gap-3">
                    {canBackToEditor ? (
                        <Button asChild variant="ghost" className="h-9 shrink-0 gap-2 px-2 text-white hover:bg-white/10 hover:text-white">
                            <Link to={`/classes/${publicId}/content`}>
                                <ArrowLeft className="size-5" />
                                <span className="hidden sm:inline">Quay lại editor</span>
                            </Link>
                        </Button>
                    ) : null}
                    <Button asChild variant="ghost" className="h-9 shrink-0 px-2 text-white hover:bg-white/10 hover:text-white">
                        <Link to="/dashboard" aria-label="Quay lại dashboard">
                            <ArrowLeft className="size-5" />
                        </Link>
                    </Button>
                    <h1 className="truncate font-semibold">{headerTitle}</h1>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm font-semibold">
                    <div className="hidden w-32 items-center gap-2 sm:flex">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20">
                            <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <span className="min-w-9 text-right text-orange-500">{progressPercent}%</span>
                    </div>
                    <span className="sm:hidden text-orange-500">{progressPercent}%</span>
                    <span>{completedItemCount}/{previewItems.length} bài học</span>
                </div>
            </header>

            <div className="grid min-h-[calc(100vh-48px)] lg:grid-cols-[1fr_380px]">
                <main className="min-w-0 border-r">{renderMainContent()}</main>

                <aside className="bg-muted/30">
                    <div className="border-b bg-card p-4">
                        <h3 className="font-semibold">Nội dung khóa học</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{classInfo?.code}</p>
                    </div>
                    <div className="max-h-[calc(100vh-105px)] overflow-y-auto">
                        {sectionRows.map((section, sectionIndex) => {
                            const items = [
                                ...(lessonsBySection.get(section.publicId) || []).map((item) => ({ ...item, kind: 'lesson' })),
                                ...(examsBySection.get(section.publicId) || []).map((item) => ({ ...item, kind: 'exam' }))
                            ];
                            const isCollapsed = collapsedSectionIds.has(section.publicId);
                            return (
                                <div key={section.publicId} className="border-b">
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold transition hover:bg-muted"
                                        onClick={() => toggleSection(section.publicId)}
                                        aria-expanded={!isCollapsed}
                                    >
                                        <span>{sectionIndex + 1}. {section.title}</span>
                                        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                    </button>
                                    {!isCollapsed && (items.length === 0 ? <p className="px-4 pb-3 text-sm text-muted-foreground">Chưa có mục nào.</p> : items.map((item, itemIndex) => (
                                        <button key={item.publicId} type="button" onClick={() => setSelectedItemId(item.publicId)} className={`flex w-full items-start gap-2 px-4 py-3 text-left text-sm transition ${selectedItem?.publicId === item.publicId ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                                            <span className="font-medium">{sectionIndex + 1}.{itemIndex + 1}</span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate">{item.title}</span>
                                                <span className="text-xs text-muted-foreground">{item.kind === 'exam' ? 'Quiz' : item.type}</span>
                                            </span>
                                            {item.progress?.isCompleted ? <Badge variant="secondary">OK</Badge> : null}
                                        </button>
                                    )))}
                                </div>
                            );
                        })}
                    </div>
                </aside>
            </div>
        </div>
    );
}
