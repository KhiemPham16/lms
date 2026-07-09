import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, FolderOpen, ImageIcon, Pencil, Search, Trash2, Upload, Video } from 'lucide-react';
import { toast } from 'sonner';

import Pagination from '~/components/common/Pagination';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { courseRelatedMediaFolders, getMediaFolder, mediaFolders } from '~/constants/media';
import useDebounce from '~/hooks/useDebounce';
import lmsService from '~/services/lms.service';
import useAuthStore from '~/stores/auth.store';
import { getMediaUrlCandidates, resolveMediaUrl } from '~/utils/media-url';
import { normalizeList } from './utils';

const formatSize = (value) => {
    const size = Number(value || 0);
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const mediaTypeLabel = {
    IMAGE: 'Hình ảnh',
    VIDEO: 'Video',
    DOCUMENT: 'Tài liệu'
};

function MediaPreview({ item, className = '' }) {
    const [fallback, setFallback] = useState({ publicId: item.publicId, index: 0 });
    const index = fallback.publicId === item.publicId ? fallback.index : 0;
    const candidates = getMediaUrlCandidates(item);
    const src = candidates[index];

    const handleError = () => {
        if (index < candidates.length - 1) {
            setFallback({ publicId: item.publicId, index: index + 1 });
            return;
        }
        setFallback({ publicId: item.publicId, index: candidates.length });
    };

    if (item.type === 'VIDEO') {
        return (
            <div className={`flex h-full w-full items-center justify-center bg-zinc-950 ${className}`}>
                {src ? (
                    <video src={src} className="h-full w-full object-cover" muted onError={handleError} />
                ) : (
                    <Video className="size-10 text-white/70" />
                )}
            </div>
        );
    }

    if (item.type !== 'IMAGE' || !src) {
        return (
            <div className={`flex h-full w-full items-center justify-center bg-muted ${className}`}>
                <FileText className="size-10 text-muted-foreground" />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={item.alt || item.originalName}
            className={`h-full w-full object-cover ${className}`}
            onError={handleError}
        />
    );
}

export default function MediaPage() {
    const currentUser = useAuthStore((state) => state.user);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [selectedFolder, setSelectedFolder] = useState(mediaFolders[0].value);
    const [selectedId, setSelectedId] = useState('');
    const [open, setOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [file, setFile] = useState(null);
    const [uploadFolder, setUploadFolder] = useState(mediaFolders[0].value);
    const [alt, setAlt] = useState('');
    const [editAlt, setEditAlt] = useState('');
    const [editFolder, setEditFolder] = useState(mediaFolders[0].value);
    const keyword = useDebounce(search, 350);
    const queryClient = useQueryClient();
    const roleCode = currentUser?.role?.code || currentUser?.role;
    const visibleFolders = roleCode === 'ADMIN' ? mediaFolders : courseRelatedMediaFolders;
    const fallbackFolder = visibleFolders[0]?.value || mediaFolders[0].value;
    const selectedFolderValue = visibleFolders.some((folder) => folder.value === selectedFolder)
        ? selectedFolder
        : fallbackFolder;
    const uploadFolderValue = visibleFolders.some((folder) => folder.value === uploadFolder)
        ? uploadFolder
        : fallbackFolder;
    const folderConfig = getMediaFolder(selectedFolderValue);
    const uploadConfig = getMediaFolder(uploadFolderValue);

    const { data, isPending } = useQuery({
        queryKey: ['media', page, keyword, selectedFolderValue],
        queryFn: () =>
            lmsService.listMedia({
                page,
                limit: 24,
                keyword: keyword || undefined,
                folder: selectedFolderValue,
                type: folderConfig.type
            })
    });
    const list = normalizeList(data);

    const selectedItem = useMemo(
        () => list.items.find((item) => item.publicId === selectedId) || list.items[0] || null,
        [list.items, selectedId]
    );
    const editFolderOptions = useMemo(
        () => mediaFolders.filter((folder) => folder.type === selectedItem?.type),
        [selectedItem?.type]
    );

    const upload = useMutation({
        mutationFn: () => {
            const form = new FormData();
            form.append('file', file);
            form.append('folder', uploadFolderValue);
            if (alt) form.append('alt', alt);
            return lmsService.uploadMedia(form);
        },
        onSuccess: async (item) => {
            toast.success('Đã tải media lên');
            setOpen(false);
            setFile(null);
            setAlt('');
            setSelectedFolder(item.folder);
            setSelectedId(item.publicId);
            setPage(1);
            await queryClient.invalidateQueries({ queryKey: ['media'] });
        }
    });

    const remove = useMutation({
        mutationFn: lmsService.deleteMedia,
        onSuccess: async () => {
            toast.success('Đã xóa media');
            setSelectedId('');
            await queryClient.invalidateQueries({ queryKey: ['media'] });
        }
    });

    const update = useMutation({
        mutationFn: () =>
            lmsService.updateMedia(selectedItem.publicId, {
                alt: editAlt.trim() || undefined,
                folder: editFolder
            }),
        onSuccess: async (item) => {
            toast.success('Cập nhật media');
            setEditOpen(false);
            setSelectedFolder(item.folder);
            setSelectedId(item.publicId);
            await queryClient.invalidateQueries({ queryKey: ['media'] });
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Không cập nhật media');
        }
    });
    const openUploadDialog = () => {
        setUploadFolder(selectedFolderValue);
        setOpen(true);
    };

    const openEditDialog = () => {
        if (!selectedItem) return;
        setEditAlt(selectedItem.alt || '');
        setEditFolder(selectedItem.folder);
        setEditOpen(true);
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-normal">Thư viện media</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Quản lý hình ảnh, video và tài liệu dùng trong LMS.
                    </p>
                </div>
                <Button type="button" onClick={openUploadDialog}>
                    <Upload className="size-4" />
                    Tải lên
                </Button>
            </div>

            <div className="grid min-h-[72vh] overflow-hidden rounded-lg border bg-card shadow-sm lg:grid-cols-[250px_1fr_320px]">
                <aside className="border-b bg-muted/30 p-3 lg:border-r lg:border-b-0">
                    <div className="mb-3 px-2 text-xs font-medium uppercase text-muted-foreground">Thư mục LMS</div>
                    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
                        {visibleFolders.map((folder) => {
                            const active = selectedFolderValue === folder.value;
                            return (
                                <button
                                    key={folder.value}
                                    type="button"
                                    onClick={() => {
                                        setSelectedFolder(folder.value);
                                        setPage(1);
                                    }}
                                    className={`flex items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                                        active
                                            ? 'bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20'
                                            : 'hover:bg-muted/50'
                                    }`}
                                >
                                    <FolderOpen
                                        className={`mt-0.5 size-4 ${active ? 'text-primary' : 'text-muted-foreground'}`}
                                    />
                                    <span className="min-w-0">
                                        <span className="block font-medium">{folder.label}</span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {folder.value}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <main className="min-w-0 border-b lg:border-r lg:border-b-0">
                    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-semibold">{folderConfig.label}</h2>
                                <Badge variant="outline">
                                    {mediaTypeLabel[folderConfig.type] || folderConfig.type}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{folderConfig.description}</p>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                }}
                                className="pl-9"
                                placeholder="Tìm media..."
                            />
                        </div>
                    </div>

                    <div className="min-h-[56vh] p-4">
                        {isPending ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                                {Array.from({ length: 10 }).map((_, index) => (
                                    <div key={index} className="aspect-square animate-pulse rounded-md bg-muted" />
                                ))}
                            </div>
                        ) : list.items.length === 0 ? (
                            <div className="flex min-h-[42vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                                <ImageIcon className="size-10" />
                                <div>
                                    <p className="font-medium text-foreground">Chưa có media trong thư mục này</p>
                                    <p>Tải file mới lên đúng nhóm LMS để dùng lại ở các màn hình khác.</p>
                                </div>
                                <Button type="button" variant="outline" onClick={openUploadDialog}>
                                    <Upload className="size-4" />
                                    Tải lên
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                                {list.items.map((item) => {
                                    const active = selectedItem?.publicId === item.publicId;
                                    return (
                                        <button
                                            key={item.publicId}
                                            type="button"
                                            onClick={() => setSelectedId(item.publicId)}
                                            className={`overflow-hidden rounded-md border bg-card text-left transition ${
                                                active
                                                    ? 'border-primary ring-2 ring-primary/30'
                                                    : 'hover:border-primary/60'
                                            }`}
                                        >
                                            <div className="aspect-square bg-muted">
                                                <MediaPreview item={item} />
                                            </div>
                                            <div className="space-y-1 p-2">
                                                <p className="truncate text-xs font-medium">{item.originalName}</p>
                                                <p className="text-xs text-muted-foreground">{formatSize(item.size)}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="border-t p-4">
                        <Pagination page={page} totalPages={list.meta.totalPages} onPageChange={setPage} />
                    </div>
                </main>

                <aside className="p-4">
                    <h3 className="font-semibold">Chi tiết media</h3>
                    {selectedItem ? (
                        <div className="mt-4 space-y-4">
                            <div className="aspect-square overflow-hidden rounded-md border bg-muted">
                                <MediaPreview item={selectedItem} />
                            </div>

                            <div className="space-y-2 text-sm">
                                <p className="break-words font-medium">{selectedItem.originalName}</p>
                                <div className="grid grid-cols-[90px_1fr] gap-2 text-xs">
                                    <span className="text-muted-foreground">Loại</span>
                                    <span>{mediaTypeLabel[selectedItem.type] || selectedItem.type}</span>
                                    <span className="text-muted-foreground">Thư mục</span>
                                    <span className="break-words">{selectedItem.folder}</span>
                                    <span className="text-muted-foreground">Dung lượng</span>
                                    <span>{formatSize(selectedItem.size)}</span>
                                    <span className="text-muted-foreground">Mô tả</span>
                                    <span className="break-words">{selectedItem.alt || 'Chưa có'}</span>
                                    <span className="text-muted-foreground">Người tải</span>
                                    <span className="break-words">
                                        {selectedItem.uploadedBy?.fullName || 'Không rõ'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Đường dẫn</Label>
                                <Input value={resolveMediaUrl(selectedItem.url)} readOnly />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="outline" asChild>
                                    <a href={resolveMediaUrl(selectedItem.url)} target="_blank" rel="noreferrer">
                                        <ExternalLink className="size-4" />
                                        Mở file
                                    </a>
                                </Button>
                                <Button type="button" variant="outline" onClick={openEditDialog}>
                                    <Pencil className="size-4" />
                                    Sửa
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={remove.isPending}
                                    onClick={() => remove.mutate(selectedItem.publicId)}
                                >
                                    <Trash2 className="size-4" />
                                    Xóa
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 text-sm text-muted-foreground">
                            Chọn một file trong thư viện để xem thông tin.
                        </p>
                    )}
                </aside>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Tải media lên thư viện</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-5 md:grid-cols-[1fr_220px]">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Thư mục</Label>
                                <Select value={uploadFolder} onValueChange={setUploadFolder}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {visibleFolders.map((folder) => (
                                            <SelectItem key={folder.value} value={folder.value}>
                                                {folder.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">{uploadConfig.value}</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label>File</Label>
                                <Input
                                    accept={uploadConfig.accept}
                                    type="file"
                                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Mô tả</Label>
                                <Input
                                    value={alt}
                                    onChange={(event) => setAlt(event.target.value)}
                                    placeholder={uploadConfig.description}
                                />
                            </div>
                        </div>

                        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted">
                            {file && file.type.startsWith('image/') ? (
                                <img
                                    src={URL.createObjectURL(file)}
                                    alt="Xem trước media"
                                    className="h-full w-full object-cover"
                                />
                            ) : file && file.type.startsWith('video/') ? (
                                <Video className="size-12 text-muted-foreground" />
                            ) : file ? (
                                <FileText className="size-12 text-muted-foreground" />
                            ) : (
                                <Upload className="size-12 text-muted-foreground" />
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Hủy
                        </Button>
                        <Button type="button" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
                            Tải lên
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Chỉnh sửa media</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>File</Label>
                            <Input value={selectedItem?.originalName || ''} readOnly />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Thư mục</Label>
                            <Select value={editFolder} onValueChange={setEditFolder}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {editFolderOptions.map((folder) => (
                                        <SelectItem key={folder.value} value={folder.value}>
                                            {folder.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>{'M\u00f4 t\u1ea3'}</Label>
                            <Input
                                value={editAlt}
                                onChange={(event) => setEditAlt(event.target.value)}
                                placeholder="Mô tả media"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                            H?y
                        </Button>
                        <Button
                            type="button"
                            disabled={!selectedItem || update.isPending}
                            onClick={() => update.mutate()}
                        >
                            L?u
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}


