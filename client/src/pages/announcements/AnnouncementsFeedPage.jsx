import classNames from 'classnames';
import { useCallback, useEffect, useState } from 'react';
import { FiAlertTriangle, FiBell, FiBookOpen, FiCalendar, FiClock, FiFlag, FiPlus, FiRefreshCcw, FiSend, FiUser, FiX } from 'react-icons/fi';
import { toast } from 'sonner';

import { adminModulesApi } from '~/shared/api/adminModulesApi.js';
import { getApiMessage } from '~/shared/api/http.js';
import { ModalBackdrop } from '~/shared/components/ModalBackdrop.jsx';
import { allUserRoles, roleLabels, userRoles } from '~/shared/constants/roles.js';
import { useAuthStore } from '~/shared/store/authStore.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './AnnouncementsFeedPage.module.scss';

const formatDateTime = (value) => value
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '-';

const categoryMeta = {
    GENERAL: { label: 'Thông báo chung', icon: FiBell },
    HOLIDAY: { label: 'Lịch nghỉ', icon: FiCalendar },
    ACADEMIC: { label: 'Học vụ', icon: FiBookOpen },
    EVENT: { label: 'Sự kiện', icon: FiFlag },
    EMERGENCY: { label: 'Khẩn cấp', icon: FiAlertTriangle }
};

const initialForm = {
    title: '',
    message: '',
    category: 'GENERAL',
    audience: 'ALL',
    targetRoles: [],
    targetDepartmentPublicIds: [],
    isPinned: false,
    expiresAt: ''
};

const categoryOptions = Object.entries(categoryMeta).map(([value, meta]) => ({ value, label: meta.label }));

const toItems = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    return [];
};

export function AnnouncementsFeedPage() {
    const user = useAuthStore((state) => state.user);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [departments, setDepartments] = useState([]);
    const [loadingDepartments, setLoadingDepartments] = useState(false);

    const loadAnnouncements = useCallback(async () => {
        setLoading(true);
        try {
            const result = await adminModulesApi.announcementFeed();
            setAnnouncements(Array.isArray(result) ? result : (result?.data ?? []));
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được bảng tin'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const task = window.setTimeout(loadAnnouncements, 0);
        return () => window.clearTimeout(task);
    }, [loadAnnouncements]);

    const openCreateModal = async () => {
        setForm(initialForm);
        setIsCreateOpen(true);
        if (departments.length) return;
        setLoadingDepartments(true);
        try {
            setDepartments(toItems(await adminModulesApi.listDepartments()));
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được danh sách phòng ban'));
        } finally {
            setLoadingDepartments(false);
        }
    };

    const closeCreateModal = () => {
        if (!isSaving) setIsCreateOpen(false);
    };

    const toggleArrayValue = (key, value) => {
        setForm((current) => ({
            ...current,
            [key]: current[key].includes(value)
                ? current[key].filter((item) => item !== value)
                : [...current[key], value]
        }));
    };

    const createAnnouncement = async (event) => {
        event.preventDefault();
        const publishNow = event.nativeEvent.submitter?.value === 'publish';
        if (form.audience === 'ROLES' && !form.targetRoles.length) {
            toast.error('Chọn ít nhất một vai trò nhận thông báo');
            return;
        }
        if (form.audience === 'DEPARTMENTS' && !form.targetDepartmentPublicIds.length) {
            toast.error('Chọn ít nhất một phòng ban nhận thông báo');
            return;
        }

        setIsSaving(true);
        try {
            const created = await adminModulesApi.createAnnouncement({
                title: form.title.trim(),
                message: form.message.trim(),
                category: form.category,
                audience: form.audience,
                targetRoles: form.audience === 'ROLES' ? form.targetRoles : undefined,
                targetDepartmentPublicIds: form.audience === 'DEPARTMENTS' ? form.targetDepartmentPublicIds : undefined,
                isPinned: form.isPinned,
                expiresAt: form.expiresAt || undefined
            });
            if (publishNow) await adminModulesApi.publishAnnouncement(created.publicId);
            toast.success(publishNow ? 'Đã tạo và đăng thông báo' : 'Đã lưu thông báo nháp');
            setIsCreateOpen(false);
            setForm(initialForm);
            if (publishNow) await loadAnnouncements();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tạo được thông báo'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={ui.pageStack}>
            <section className={styles.pageHeader}>
                <div className={ui.moduleHeaderIcon}><FiFlag /></div>
                <div className={styles.headerCopy}>
                    <p className={ui.eyebrow}>Announcement</p>
                    <h2>Bảng tin nhà trường</h2>
                    <p>Các thông báo chung được gửi đến vai trò hoặc phòng ban của bạn.</p>
                </div>
                <div className={styles.headerActions}>
                    {user?.role === userRoles.ADMIN ? <button className={ui.primaryButton} type="button" onClick={openCreateModal}><FiPlus /> Tạo thông báo</button> : null}
                    <button className={ui.iconButton} type="button" onClick={loadAnnouncements} disabled={loading} title="Tải lại"><FiRefreshCcw /></button>
                </div>
            </section>

            {loading ? (
                <section className={styles.announcementState}><FiRefreshCcw className={styles.spin} /><span>Đang tải bảng tin...</span></section>
            ) : announcements.length ? (
                <section className={styles.announcementList} aria-label="Bảng tin nhà trường">
                    <div className={styles.listHeading}>
                        <p className={ui.eyebrow}>Mới nhất</p>
                        <h3>{announcements.length} thông báo dành cho bạn</h3>
                    </div>
                    {announcements.map((item) => {
                        const meta = categoryMeta[item.category] ?? categoryMeta.GENERAL;
                        const CategoryIcon = meta.icon;
                        return (
                            <article className={styles.announcementItem} key={item.publicId}>
                                <span className={styles.announcementIcon}><CategoryIcon /></span>
                                <div className={styles.announcementContent}>
                                    <div className={styles.badges}>
                                        <span className={styles.categoryBadge}>{meta.label}</span>
                                        {item.isPinned ? <span className={styles.pinnedBadge}><FiFlag /> Đã ghim</span> : null}
                                    </div>
                                    <h3>{item.title}</h3>
                                    <p>{item.message}</p>
                                    <div className={styles.metaLine}>
                                        <span><FiClock /> {formatDateTime(item.publishedAt ?? item.createdAt)}</span>
                                        {item.publishedBy?.fullName ? <span><FiUser /> {item.publishedBy.fullName}</span> : null}
                                        {item.expiresAt ? <span>Hiệu lực đến {formatDateTime(item.expiresAt)}</span> : null}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </section>
            ) : (
                <section className={`${styles.announcementState} ${styles.emptyState}`}>
                    <FiFlag />
                    <div className={styles.emptyCopy}>
                        <strong>Chưa có thông báo chung</strong>
                        <p>Khi có thông báo dành cho vai trò hoặc phòng ban của bạn, nội dung sẽ xuất hiện tại đây.</p>
                    </div>
                </section>
            )}

            {user?.role === userRoles.ADMIN && isCreateOpen ? (
                <ModalBackdrop onClose={closeCreateModal}>
                    <form className={ui.modal} onSubmit={createAnnouncement}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>Announcement</p>
                                <h3>Tạo thông báo mới</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={closeCreateModal} disabled={isSaving} aria-label="Đóng"><FiX /></button>
                        </div>

                        <div className={ui.modalGrid}>
                            <label className={classNames(ui.field, ui.modalFull)}>
                                Tiêu đề
                                <input className={ui.plainInput} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} minLength="3" maxLength="200" placeholder="Nhập tiêu đề thông báo" required autoFocus />
                            </label>
                            <label className={ui.field}>
                                Nhóm thông báo
                                <select className={ui.plainInput} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                                    {categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                                </select>
                            </label>
                            <label className={ui.field}>
                                Đối tượng nhận
                                <select className={ui.plainInput} value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}>
                                    <option value="ALL">Toàn trường</option>
                                    <option value="ROLES">Theo vai trò</option>
                                    <option value="DEPARTMENTS">Theo phòng ban</option>
                                </select>
                            </label>

                            {form.audience === 'ROLES' ? (
                                <fieldset className={classNames(styles.targetFieldset, ui.modalFull)}>
                                    <legend>Vai trò nhận thông báo</legend>
                                    <div className={styles.choiceGrid}>
                                        {allUserRoles.map((role) => (
                                            <label className={styles.choiceChip} key={role}>
                                                <input type="checkbox" checked={form.targetRoles.includes(role)} onChange={() => toggleArrayValue('targetRoles', role)} />
                                                {roleLabels[role]}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                            ) : null}

                            {form.audience === 'DEPARTMENTS' ? (
                                <fieldset className={classNames(styles.targetFieldset, ui.modalFull)}>
                                    <legend>Phòng ban nhận thông báo</legend>
                                    {loadingDepartments ? <span className={styles.helperText}>Đang tải phòng ban...</span> : (
                                        <div className={styles.choiceGrid}>
                                            {departments.map((department) => (
                                                <label className={styles.choiceChip} key={department.publicId}>
                                                    <input type="checkbox" checked={form.targetDepartmentPublicIds.includes(department.publicId)} onChange={() => toggleArrayValue('targetDepartmentPublicIds', department.publicId)} />
                                                    {department.name}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </fieldset>
                            ) : null}

                            <label className={classNames(ui.field, ui.modalFull)}>
                                Nội dung
                                <textarea className={styles.messageInput} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} minLength="3" maxLength="5000" placeholder="Nhập nội dung thông báo" required />
                            </label>
                            <label className={ui.field}>
                                Hết hiệu lực
                                <input className={ui.plainInput} type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} />
                            </label>
                            <label className={styles.pinOption}>
                                <input type="checkbox" checked={form.isPinned} onChange={(event) => setForm((current) => ({ ...current, isPinned: event.target.checked }))} />
                                <span><strong>Ghim thông báo</strong><small>Ưu tiên hiển thị ở đầu bảng tin</small></span>
                            </label>
                        </div>

                        <div className={ui.modalFooter}>
                            <button className={ui.secondaryButton} type="button" onClick={closeCreateModal} disabled={isSaving}>Hủy</button>
                            <button className={ui.secondaryButton} type="submit" value="draft" disabled={isSaving}>{isSaving ? 'Đang lưu...' : 'Lưu bản nháp'}</button>
                            <button className={ui.primaryButton} type="submit" value="publish" disabled={isSaving}><FiSend /> {isSaving ? 'Đang đăng...' : 'Tạo và đăng'}</button>
                        </div>
                    </form>
                </ModalBackdrop>
            ) : null}
        </div>
    );
}
