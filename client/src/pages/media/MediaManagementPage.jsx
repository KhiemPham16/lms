import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiEdit2,
    FiExternalLink,
    FiFile,
    FiFileText,
    FiImage,
    FiLink,
    FiRefreshCcw,
    FiSave,
    FiTrash2,
    FiUploadCloud
} from 'react-icons/fi';
import { toast } from 'sonner';

import { getApiMessage } from '~/shared/api/http.js';
import { mediaApi } from '~/shared/api/mediaApi.js';
import { ModalBackdrop } from '~/shared/components/ModalBackdrop.jsx';
import { userRoles } from '~/shared/constants/roles.js';
import { useAuthStore } from '~/shared/store/authStore.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './MediaManagementPage.module.scss';

const managerRoles = [
    userRoles.ADMIN,
    userRoles.PRINCIPAL,
    userRoles.TRAINING_OFFICER,
    userRoles.DEPARTMENT_HEAD,
    userRoles.LECTURER
];

const typeOptions = [
    { value: '', label: 'Tất cả loại' },
    { value: 'IMAGE', label: 'Ảnh' },
    { value: 'PDF', label: 'PDF' },
    { value: 'DOCUMENT', label: 'Tài liệu' }
];

const emptyUploadForm = {
    title: '',
    altText: '',
    caption: '',
    description: '',
    folder: ''
};

const emptyEditForm = {
    title: '',
    altText: '',
    caption: '',
    description: '',
    folder: ''
};

const defaultFilters = { search: '', type: '', folder: '', page: 1, limit: 24 };

const formatBytes = (bytes) => {
    if (!bytes) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDateTime = (value) =>
    value
        ? new Intl.DateTimeFormat('vi-VN', {
              dateStyle: 'short',
              timeStyle: 'short'
          }).format(new Date(value))
        : '-';

const getTypeIcon = (type) => {
    if (type === 'IMAGE') return FiImage;
    if (type === 'PDF') return FiFileText;
    return FiFile;
};

export function MediaManagementPage() {
    const user = useAuthStore((state) => state.user);
    const canManageMedia = managerRoles.includes(user?.role);
    const [items, setItems] = useState([]);
    const [folders, setFolders] = useState([]);
    const [meta, setMeta] = useState({ page: 1, limit: 24, total: 0, totalPages: 1 });
    const [filters, setFilters] = useState(defaultFilters);
    const [file, setFile] = useState(null);
    const [uploadForm, setUploadForm] = useState(emptyUploadForm);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [editingMedia, setEditingMedia] = useState(null);
    const [editForm, setEditForm] = useState(emptyEditForm);
    const [replaceFile, setReplaceFile] = useState(null);

    const folderOptions = useMemo(
        () => [{ folder: '', count: items.length, totalSize: 0 }, ...folders],
        [folders, items.length]
    );

    const loadMedia = useCallback(
        async (nextFilters = filters) => {
            if (!canManageMedia) return;
            setIsLoading(true);
            try {
                const [mediaResult, folderResult] = await Promise.all([
                    mediaApi.list({
                        ...nextFilters,
                        search: nextFilters.search || undefined,
                        type: nextFilters.type || undefined,
                        folder: nextFilters.folder || undefined
                    }),
                    mediaApi.folders().catch(() => [])
                ]);
                setItems(mediaResult.items);
                setMeta(mediaResult.meta);
                setFolders(folderResult);
            } catch (error) {
                toast.error(getApiMessage(error, 'Không tải được danh sách media'));
            } finally {
                setIsLoading(false);
            }
        },
        [canManageMedia, filters]
    );

    useEffect(() => {
        const task = window.setTimeout(() => {
            loadMedia();
        }, 0);

        return () => window.clearTimeout(task);
    }, [loadMedia]);

    const updateFilters = (patch) => {
        const nextFilters = { ...filters, ...patch, page: patch.page ?? 1 };
        setFilters(nextFilters);
        loadMedia(nextFilters);
    };

    const handleUpload = async (event) => {
        event.preventDefault();
        if (!file) {
            toast.error('Vui lòng chọn tệp trước khi tải lên');
            return;
        }

        setIsUploading(true);
        try {
            await mediaApi.upload(file, uploadForm);
            toast.success('Đã tải media lên hệ thống');
            setFile(null);
            setUploadForm(emptyUploadForm);
            setFilters(defaultFilters);
            loadMedia(defaultFilters);
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được media'));
        } finally {
            setIsUploading(false);
        }
    };

    const openEdit = (media) => {
        setEditingMedia(media);
        setEditForm({
            title: media.title ?? '',
            altText: media.altText ?? '',
            caption: media.caption ?? '',
            description: media.description ?? '',
            folder: media.folder === 'legacy' ? '' : (media.folder ?? '')
        });
        setReplaceFile(null);
    };

    const saveEdit = async (event) => {
        event.preventDefault();
        if (!editingMedia) return;

        try {
            await mediaApi.update(editingMedia.publicId, editForm);
            if (replaceFile) await mediaApi.replace(editingMedia.publicId, replaceFile);
            toast.success('Đã cập nhật media');
            setEditingMedia(null);
            setReplaceFile(null);
            loadMedia();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không cập nhật được media'));
        }
    };

    const removeMedia = async (media) => {
        try {
            await mediaApi.remove(media.publicId);
            toast.success('Đã xóa media');
            loadMedia();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không xóa được media'));
        }
    };

    const copyLink = async (media) => {
        await navigator.clipboard.writeText(media.absoluteUrl);
        toast.success('Đã sao chép liên kết media');
    };

    return (
        <div className={ui.pageStack}>
            <section className={ui.moduleHeader}>
                <div className={ui.moduleHeaderIcon}>
                    <FiUploadCloud />
                </div>
                <div>
                    <p className={ui.eyebrow}>Media library</p>
                    <h2>Quản lý media</h2>
                    <p>Tải lên, lọc, cập nhật metadata, thay file và xóa media theo API mới của BE.</p>
                </div>
            </section>

            {!canManageMedia ? (
                <section className={ui.infoPanel}>
                    <p className={ui.muted}>Tài khoản hiện tại không nằm trong nhóm được BE cấp quyền quản lý media.</p>
                </section>
            ) : null}

            {canManageMedia ? (
                <>
                    <form className={styles.uploadPanel} onSubmit={handleUpload}>
                        <div className={styles.uploadDrop}>
                            <FiUploadCloud />
                            <div>
                                <strong>{file?.name ?? 'Chọn tệp media'}</strong>
                                <span>Hỗ trợ ảnh, PDF, Word, Excel, PowerPoint, TXT và CSV theo cấu hình BE.</span>
                            </div>
                            <input
                                type="file"
                                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                            />
                        </div>
                        <div className={styles.formGrid}>
                            <label className={ui.field}>
                                Tiêu đề
                                <input className={ui.plainInput} value={uploadForm.title} onChange={(event) => setUploadForm({ ...uploadForm, title: event.target.value })} />
                            </label>
                            <label className={ui.field}>
                                Thư mục
                                <input className={ui.plainInput} value={uploadForm.folder} onChange={(event) => setUploadForm({ ...uploadForm, folder: event.target.value })} placeholder="VD: bai-giang/java-201" />
                            </label>
                            <label className={ui.field}>
                                Alt text
                                <input className={ui.plainInput} value={uploadForm.altText} onChange={(event) => setUploadForm({ ...uploadForm, altText: event.target.value })} />
                            </label>
                            <label className={ui.field}>
                                Caption
                                <input className={ui.plainInput} value={uploadForm.caption} onChange={(event) => setUploadForm({ ...uploadForm, caption: event.target.value })} />
                            </label>
                            <label className={`${ui.field} ${styles.fullField}`}>
                                Mô tả
                                <textarea className={styles.textarea} value={uploadForm.description} onChange={(event) => setUploadForm({ ...uploadForm, description: event.target.value })} />
                            </label>
                        </div>
                        <button className={ui.primaryButton} type="submit" disabled={!file || isUploading}>
                            <FiUploadCloud /> Tải lên
                        </button>
                    </form>

                    <section className={styles.toolbar}>
                        <label className={ui.field}>
                            Tìm kiếm
                            <input
                                className={ui.plainInput}
                                value={filters.search}
                                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                                onBlur={() => updateFilters({ search: filters.search })}
                                placeholder="Tên, tiêu đề, alt, caption"
                            />
                        </label>
                        <label className={ui.field}>
                            Loại
                            <select className={styles.select} value={filters.type} onChange={(event) => updateFilters({ type: event.target.value })}>
                                {typeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className={ui.field}>
                            Thư mục
                            <select className={styles.select} value={filters.folder} onChange={(event) => updateFilters({ folder: event.target.value })}>
                                {folderOptions.map((folder) => (
                                    <option key={folder.folder || 'all'} value={folder.folder}>
                                        {folder.folder ? `${folder.folder} (${folder.count})` : 'Tất cả thư mục'}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button className={ui.secondaryButton} type="button" onClick={() => loadMedia()} disabled={isLoading}>
                            <FiRefreshCcw /> Tải lại
                        </button>
                    </section>

                    <section className={ui.tablePanel}>
                        <div className={ui.sectionHeading}>
                            <div>
                                <p className={ui.eyebrow}>Danh sách media</p>
                                <h3>{meta.total ?? items.length} tệp</h3>
                            </div>
                        </div>
                        <div className={styles.mediaGrid}>
                            {items.map((media) => {
                                const TypeIcon = getTypeIcon(media.type);
                                return (
                                    <article className={styles.mediaCard} key={media.publicId}>
                                        <div className={styles.preview}>
                                            {media.type === 'IMAGE' ? (
                                                <img src={media.absoluteUrl} alt={media.altText || media.title || media.originalName} />
                                            ) : (
                                                <TypeIcon />
                                            )}
                                        </div>
                                        <div className={styles.mediaBody}>
                                            <strong title={media.title || media.originalName}>{media.title || media.originalName}</strong>
                                            <span>{media.type} · {formatBytes(media.size)}</span>
                                            <span>{media.folder || 'legacy'} · {formatDateTime(media.createdAt)}</span>
                                            <span>{media.uploadedBy?.fullName ?? 'Không rõ người tải'}</span>
                                        </div>
                                        <div className={styles.mediaActions}>
                                            <button className={ui.iconButton} type="button" title="Sao chép link" onClick={() => copyLink(media)}>
                                                <FiLink />
                                            </button>
                                            <a className={ui.iconButton} title="Mở media" href={media.absoluteUrl} target="_blank" rel="noreferrer">
                                                <FiExternalLink />
                                            </a>
                                            <button className={ui.iconButton} type="button" title="Cập nhật" onClick={() => openEdit(media)}>
                                                <FiEdit2 />
                                            </button>
                                            <button className={`${ui.iconButton} ${styles.dangerIcon}`} type="button" title="Xóa" onClick={() => removeMedia(media)}>
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                            {!items.length ? <div className={styles.emptyState}>Chưa có media phù hợp bộ lọc hiện tại.</div> : null}
                        </div>
                        <div className={styles.pagination}>
                            <span>Trang {meta.page ?? filters.page}/{meta.totalPages ?? 1}</span>
                            <div className={styles.paginationActions}>
                                <button className={ui.secondaryButton} type="button" disabled={(meta.page ?? 1) <= 1} onClick={() => updateFilters({ page: (meta.page ?? 1) - 1 })}>
                                    Trước
                                </button>
                                <button className={ui.secondaryButton} type="button" disabled={(meta.page ?? 1) >= (meta.totalPages ?? 1)} onClick={() => updateFilters({ page: (meta.page ?? 1) + 1 })}>
                                    Sau
                                </button>
                            </div>
                        </div>
                    </section>
                </>
            ) : null}

            {editingMedia ? (
                <ModalBackdrop onClose={() => setEditingMedia(null)}>
                    <form className={ui.modal} onSubmit={saveEdit}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>Cập nhật media</p>
                                <h3>{editingMedia.originalName}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={() => setEditingMedia(null)}>
                                ×
                            </button>
                        </div>
                        <div className={ui.modalGrid}>
                            <label className={ui.field}>
                                Tiêu đề
                                <input className={ui.plainInput} value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} />
                            </label>
                            <label className={ui.field}>
                                Thư mục
                                <input className={ui.plainInput} value={editForm.folder} onChange={(event) => setEditForm({ ...editForm, folder: event.target.value })} />
                            </label>
                            <label className={ui.field}>
                                Alt text
                                <input className={ui.plainInput} value={editForm.altText} onChange={(event) => setEditForm({ ...editForm, altText: event.target.value })} />
                            </label>
                            <label className={ui.field}>
                                Caption
                                <input className={ui.plainInput} value={editForm.caption} onChange={(event) => setEditForm({ ...editForm, caption: event.target.value })} />
                            </label>
                            <label className={`${ui.field} ${ui.modalFull}`}>
                                Mô tả
                                <textarea className={styles.textarea} value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} />
                            </label>
                            <label className={`${ui.field} ${ui.modalFull}`}>
                                Thay file
                                <input
                                    className={styles.fileInput}
                                    type="file"
                                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                                    onChange={(event) => setReplaceFile(event.target.files?.[0] ?? null)}
                                />
                            </label>
                        </div>
                        <div className={ui.modalFooter}>
                            <button className={ui.secondaryButton} type="button" onClick={() => setEditingMedia(null)}>
                                Hủy
                            </button>
                            <button className={ui.primaryButton} type="submit">
                                <FiSave /> Lưu thay đổi
                            </button>
                        </div>
                    </form>
                </ModalBackdrop>
            ) : null}
        </div>
    );
}
