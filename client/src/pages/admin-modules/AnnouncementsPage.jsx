import classNames from 'classnames';
import { useCallback, useEffect, useState } from 'react';
import { FiBell, FiRefreshCcw, FiSend, FiTrash2 } from 'react-icons/fi';
import { toast } from 'sonner';

import { adminModulesApi } from '~/shared/api/adminModulesApi.js';
import { getApiMessage } from '~/shared/api/http.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './AdminModulePages.module.scss';

const categories = ['GENERAL', 'ACADEMIC', 'SYSTEM', 'URGENT'];
const audiences = ['ALL', 'ROLES', 'DEPARTMENTS'];
const statuses = ['', 'DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'CANCELLED'];

const initialForm = {
    title: '',
    message: '',
    category: 'GENERAL',
    audience: 'ALL',
    isPinned: false,
    expiresAt: ''
};

export function AnnouncementsPage() {
    const [filters, setFilters] = useState({ search: '', status: '', page: 1, limit: 20 });
    const [announcements, setAnnouncements] = useState([]);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
    const [form, setForm] = useState(initialForm);

    const loadAnnouncements = useCallback(async (nextFilters = filters) => {
        try {
            const result = await adminModulesApi.listAnnouncements({
                ...nextFilters,
                status: nextFilters.status || undefined,
                search: nextFilters.search || undefined
            });
            setAnnouncements(result.data ?? []);
            setMeta(result.meta ?? { page: nextFilters.page, totalPages: 1, total: 0 });
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được thông báo toàn trường'));
        }
    }, [filters]);

    useEffect(() => {
        const task = window.setTimeout(loadAnnouncements, 0);

        return () => window.clearTimeout(task);
    }, [loadAnnouncements]);

    const updateFilter = (patch) => {
        const next = { ...filters, ...patch, page: patch.page ?? 1 };
        setFilters(next);
        loadAnnouncements(next);
    };

    const createAnnouncement = async (event) => {
        event.preventDefault();
        try {
            await adminModulesApi.createAnnouncement({
                ...form,
                expiresAt: form.expiresAt || undefined
            });
            toast.success('Đã tạo thông báo');
            setForm(initialForm);
            loadAnnouncements();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tạo được thông báo'));
        }
    };

    const runAction = async (label, action) => {
        try {
            await action();
            toast.success(label);
            loadAnnouncements();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thực hiện được thao tác'));
        }
    };

    return (
        <div className={ui.pageStack}>
            <section className={ui.moduleHeader}>
                <div className={ui.moduleHeaderIcon}><FiBell /></div>
                <div>
                    <p className={ui.eyebrow}>Thông báo</p>
                    <h2>Quản lý thông báo toàn trường</h2>
                </div>
            </section>

            <>
                    <form className={styles.toolbarGrid} onSubmit={createAnnouncement}>
                        <label className={ui.field}>Tiêu đề<input className={ui.plainInput} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
                        <label className={ui.field}>Nhóm<select className={styles.select} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
                        <label className={ui.field}>Đối tượng<select className={styles.select} value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}>{audiences.map((item) => <option key={item}>{item}</option>)}</select></label>
                        <label className={styles.checkboxLine}><input type="checkbox" checked={form.isPinned} onChange={(event) => setForm({ ...form, isPinned: event.target.checked })} /> Ghim thông báo</label>
                        <label className={classNames(ui.field, styles.toolbarWide)}>Nội dung<textarea className={styles.textarea} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required /></label>
                        <label className={ui.field}>Hết hiệu lực<input className={ui.plainInput} type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
                        <button className={ui.primaryButton} type="submit"><FiSend /> Tạo thông báo</button>
                    </form>

                    <section className={styles.toolbarGrid}>
                        <label className={ui.field}>Tìm kiếm<input className={ui.plainInput} value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} onBlur={() => updateFilter({ search: filters.search })} /></label>
                        <label className={ui.field}>Trạng thái<select className={styles.select} value={filters.status} onChange={(event) => updateFilter({ status: event.target.value })}>{statuses.map((status) => <option key={status} value={status}>{status || 'Tất cả'}</option>)}</select></label>
                        <button className={ui.secondaryButton} type="button" onClick={() => loadAnnouncements()}><FiRefreshCcw /> Tải lại</button>
                    </section>

                    <section className={ui.tablePanel}>
                        <div className={ui.sectionHeading}>
                            <div>
                                <p className={ui.eyebrow}>Announcement</p>
                                <h3>{meta.total ?? announcements.length} thông báo</h3>
                            </div>
                        </div>
                        <div className={styles.listStack}>
                            {announcements.map((item) => (
                                <article className={styles.recordCard} key={item.publicId}>
                                    <div className={styles.recordHeader}>
                                        <div>
                                            <strong>{item.title}</strong>
                                            <span>{item.category} · {item.audience} · {item.isPinned ? 'Đã ghim' : 'Không ghim'}</span>
                                        </div>
                                        <span className={ui.statusPill}>{item.status}</span>
                                    </div>
                                    <span>{item.message}</span>
                                    <div className={styles.inlineActions}>
                                        <button className={ui.secondaryButton} type="button" onClick={() => runAction('Đã publish thông báo', () => adminModulesApi.publishAnnouncement(item.publicId))}>Publish</button>
                                        <button className={ui.secondaryButton} type="button" onClick={() => runAction('Đã hủy thông báo', () => adminModulesApi.cancelAnnouncement(item.publicId))}>Hủy</button>
                                        <button className={classNames(ui.secondaryButton, ui.dangerButton)} type="button" onClick={() => runAction('Đã xóa thông báo', () => adminModulesApi.deleteAnnouncement(item.publicId))}><FiTrash2 /> Xóa</button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
            </>
        </div>
    );
}
