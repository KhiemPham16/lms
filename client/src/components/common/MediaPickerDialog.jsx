import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { getMediaFolder } from '~/constants/media';
import lmsService from '~/services/lms.service';
import { getMediaUrlCandidates, resolveMediaUrl } from '~/utils/media-url';

function MediaThumbnail({ item }) {
    const [index, setIndex] = useState(0);
    const candidates = getMediaUrlCandidates(item);
    const src = candidates[index];

    const handleError = () => {
        if (index < candidates.length - 1) {
            setIndex((current) => current + 1);
            return;
        }
        setIndex(candidates.length);
    };

    if (!src) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-muted">
                <ImageIcon className="size-8 text-muted-foreground" />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={item.alt || item.originalName}
            className="h-full w-full object-cover"
            onError={handleError}
        />
    );
}

export default function MediaPickerDialog({ open, onOpenChange, value, onSelect, title = 'Chọn ảnh', folder = 'avatars' }) {
    const [selected, setSelected] = useState(value || '');
    const [file, setFile] = useState(null);
    const [alt, setAlt] = useState('');
    const queryClient = useQueryClient();
    const folderConfig = getMediaFolder(folder);

    const media = useQuery({
        queryKey: ['media-picker-images', folder],
        queryFn: () => lmsService.listMedia({ page: 1, limit: 48, type: 'IMAGE', folder }),
        enabled: open
    });

    const upload = useMutation({
        mutationFn: async () => {
            const form = new FormData();
            form.append('file', file);
            form.append('folder', folder);
            if (alt) form.append('alt', alt);
            return lmsService.uploadMedia(form);
        },
        onSuccess: async (item) => {
            toast.success('Đã tải ảnh lên');
            setSelected(item.url);
            setFile(null);
            setAlt('');
            await queryClient.invalidateQueries({ queryKey: ['media-picker-images', folder] });
        }
    });

    const handleUseSelected = () => {
        onSelect(resolveMediaUrl(selected));
        onOpenChange(false);
    };

    const items = media.data?.items ?? [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="border-b px-5 py-4">{title}</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="library" className="min-h-0 px-5">
                    <TabsList className="mb-4">
                        <TabsTrigger value="library">Thư viện {folderConfig.label.toLowerCase()}</TabsTrigger>
                        <TabsTrigger value="upload">Tải ảnh mới</TabsTrigger>
                    </TabsList>

                    <TabsContent value="library" className="mt-0">
                        {media.isPending ? (
                            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Đang tải thư viện...</div>
                        ) : items.length === 0 ? (
                            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground">
                                <ImageIcon className="size-8" />
                                Chưa có ảnh trong thư viện
                            </div>
                        ) : (
                            <div className="grid min-h-[56vh] gap-4 lg:grid-cols-[1fr_260px]">
                                <div className="max-h-[56vh] overflow-y-auto pr-1">
                                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                        {items.map((item) => {
                                            const active = selected === item.url;
                                            return (
                                                <button
                                                    key={item.publicId}
                                                    type="button"
                                                    onClick={() => setSelected(item.url)}
                                                    className={`group overflow-hidden rounded-lg border bg-background text-left transition ${
                                                        active ? 'border-primary ring-2 ring-primary/40' : 'hover:border-primary/60'
                                                    }`}
                                                >
                                                    <div className="aspect-square bg-muted">
                                                        <MediaThumbnail item={item} />
                                                    </div>
                                                    <div className="truncate px-2 py-1.5 text-xs">{item.originalName}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <aside className="hidden border-l pl-4 text-sm lg:block">
                                    <h3 className="font-medium">Chi tiết ảnh</h3>
                                    {selected ? (
                                        (() => {
                                            const item = items.find((mediaItem) => mediaItem.url === selected);
                                            return item ? (
                                                <div className="mt-3 space-y-3">
                                                    <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                                                        <MediaThumbnail item={item} />
                                                    </div>
                                                    <div>
                                                        <p className="break-words font-medium">{item.originalName}</p>
                                                        <p className="text-xs text-muted-foreground">{Math.round((item.size || 0) / 1024)} KB</p>
                                                        <p className="mt-1 text-xs text-muted-foreground">{item.folder}</p>
                                                    </div>
                                                </div>
                                            ) : null;
                                        })()
                                    ) : (
                                        <p className="mt-3 text-muted-foreground">Chọn một ảnh để xem chi tiết.</p>
                                    )}
                                </aside>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="upload" className="mt-0 pb-4">
                        <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-[1fr_260px]">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Chọn file ảnh</Label>
                                    <Input accept={folderConfig.accept} type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Mô tả ảnh</Label>
                                    <Input value={alt} onChange={(event) => setAlt(event.target.value)} placeholder={folderConfig.description} />
                                </div>
                                <Button type="button" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
                                    <Upload className="size-4" />
                                    Tải ảnh lên
                                </Button>
                            </div>

                            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted">
                                {file ? (
                                    <img src={URL.createObjectURL(file)} alt="Ảnh xem trước" className="h-full w-full object-cover" />
                                ) : (
                                    <ImageIcon className="size-10 text-muted-foreground" />
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Hủy
                    </Button>
                    <Button type="button" disabled={!selected} onClick={handleUseSelected}>
                        Dùng ảnh này
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
