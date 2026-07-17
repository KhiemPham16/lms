import classNames from 'classnames';
import { useCallback, useEffect, useState } from 'react';
import { FiBell, FiCheck, FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiRefreshCcw } from 'react-icons/fi';
import { toast } from 'sonner';

import { adminModulesApi } from '~/shared/api/adminModulesApi.js';
import { getApiMessage } from '~/shared/api/http.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './NotificationsPage.module.scss';

const formatDateTime = (value) => value
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '-';

export function NotificationsPage() {
    const [query, setQuery] = useState({ page: 1, limit: 20, unreadOnly: false });
    const [notifications, setNotifications] = useState([]);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, unread: 0 });
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);

    const loadNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const result = await adminModulesApi.listNotifications(query);
            const items = Array.isArray(result) ? result : (result.data ?? result.items ?? []);
            setNotifications(items);
            setMeta(result.meta ?? { page: query.page, totalPages: 1, total: items.length, unread: items.filter((item) => !item.readAt).length });
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được thông báo cá nhân'));
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => {
        const task = window.setTimeout(loadNotifications, 0);
        return () => window.clearTimeout(task);
    }, [loadNotifications]);

    const notifyUnreadCount = (count) => {
        window.dispatchEvent(new CustomEvent('notifications:updated', { detail: { count } }));
    };

    const markRead = async (item) => {
        if (item.readAt) return;
        setUpdatingId(item.publicId);
        try {
            await adminModulesApi.markNotificationRead(item.publicId);
            const readAt = new Date().toISOString();
            const unread = Math.max(0, Number(meta.unread) - 1);
            setNotifications((current) => query.unreadOnly
                ? current.filter((notification) => notification.publicId !== item.publicId)
                : current.map((notification) => notification.publicId === item.publicId ? { ...notification, readAt } : notification));
            setMeta((current) => ({ ...current, unread, total: query.unreadOnly ? Math.max(0, current.total - 1) : current.total }));
            notifyUnreadCount(unread);
        } catch (error) {
            toast.error(getApiMessage(error, 'Không đánh dấu được thông báo'));
        } finally {
            setUpdatingId(null);
        }
    };

    const markAllRead = async () => {
        setUpdatingId('all');
        try {
            await adminModulesApi.markAllNotificationsRead();
            setNotifications((current) => query.unreadOnly ? [] : current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
            setMeta((current) => ({ ...current, unread: 0, total: query.unreadOnly ? 0 : current.total, totalPages: query.unreadOnly ? 1 : current.totalPages }));
            notifyUnreadCount(0);
            toast.success('Đã đọc toàn bộ thông báo cá nhân');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không đánh dấu được toàn bộ thông báo'));
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div className={ui.pageStack}>
            <section className={ui.moduleHeader}>
                <div className={ui.moduleHeaderIcon}><FiBell /></div>
                <div>
                    <p className={ui.eyebrow}>Notification</p>
                    <h2>Thông báo cá nhân</h2>
                    <p>Cập nhật nghiệp vụ dành riêng cho tài khoản của bạn.</p>
                </div>
                <div className={styles.headerActions}>
                    <button className={ui.secondaryButton} type="button" disabled={!meta.unread || updatingId === 'all'} onClick={markAllRead}>
                        <FiCheckCircle /> {updatingId === 'all' ? 'Đang cập nhật...' : 'Đọc tất cả'}
                    </button>
                </div>
            </section>

            <section className={styles.notificationToolbar}>
                <div className={styles.filterTabs}>
                    <button className={classNames({ [styles.activeFilter]: !query.unreadOnly })} type="button" onClick={() => setQuery((current) => ({ ...current, page: 1, unreadOnly: false }))}>Tất cả <span>{meta.total}</span></button>
                    <button className={classNames({ [styles.activeFilter]: query.unreadOnly })} type="button" onClick={() => setQuery((current) => ({ ...current, page: 1, unreadOnly: true }))}>Chưa đọc <span>{meta.unread}</span></button>
                </div>
                <button className={ui.iconButton} type="button" onClick={loadNotifications} disabled={loading} title="Tải lại"><FiRefreshCcw /></button>
            </section>

            {loading ? (
                <section className={styles.notificationState}><FiRefreshCcw className={styles.spin} /><span>Đang tải thông báo...</span></section>
            ) : notifications.length ? (
                <section className={styles.notificationList}>
                    {notifications.map((item) => (
                        <article className={classNames(styles.notificationItem, { [styles.unreadItem]: !item.readAt })} key={item.publicId}>
                            <span className={styles.notificationIcon}>{item.readAt ? <FiCheck /> : <FiBell />}</span>
                            <div className={styles.notificationContent}>
                                <div><strong>{item.title}</strong>{!item.readAt ? <span className={styles.unreadMark}>Mới</span> : null}</div>
                                <p>{item.message}</p>
                                <small><FiClock /> {formatDateTime(item.createdAt)}</small>
                            </div>
                            {!item.readAt ? <button className={ui.secondaryButton} type="button" disabled={updatingId === item.publicId} onClick={() => markRead(item)}><FiCheck /> Đã đọc</button> : null}
                        </article>
                    ))}
                </section>
            ) : (
                <section className={styles.notificationState}><FiCheckCircle /><strong>{query.unreadOnly ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo cá nhân'}</strong></section>
            )}

            {meta.totalPages > 1 ? (
                <nav className={styles.pagination} aria-label="Phân trang thông báo">
                    <button className={ui.iconButton} type="button" disabled={query.page <= 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))} title="Trang trước"><FiChevronLeft /></button>
                    <strong>{query.page} / {meta.totalPages}</strong>
                    <button className={ui.iconButton} type="button" disabled={query.page >= meta.totalPages} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))} title="Trang sau"><FiChevronRight /></button>
                </nav>
            ) : null}
        </div>
    );
}
