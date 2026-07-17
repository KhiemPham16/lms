import { useCallback, useEffect, useState } from 'react';
import { FiActivity, FiRefreshCcw } from 'react-icons/fi';
import { toast } from 'sonner';

import { adminModulesApi } from '~/shared/api/adminModulesApi.js';
import { getApiMessage } from '~/shared/api/http.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './AdminModulePages.module.scss';

const actions = [
    '',
    'CREATE',
    'UPDATE',
    'DELETE',
    'STATUS_CHANGE',
    'LOGIN',
    'LOGOUT',
    'RESET_PASSWORD',
    'CHANGE_PASSWORD',
    'APPROVE',
    'REJECT',
    'ASSIGN',
    'ENROLL',
    'DROP'
];
const fmtDateTime = (value) => (value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '-');

export function AuditLogPage() {
    const [filters, setFilters] = useState({ action: '', module: '', page: 1, limit: 20 });
    const [logs, setLogs] = useState([]);
    const [meta, setMeta] = useState({ total: 0, totalPages: 1, page: 1 });
    const [isLoading, setIsLoading] = useState(false);

    const loadLogs = useCallback(async (nextFilters = filters) => {
        setIsLoading(true);
        try {
            const result = await adminModulesApi.listAuditLogs({
                ...nextFilters,
                action: nextFilters.action || undefined,
                module: nextFilters.module || undefined
            });
            setLogs(result.data ?? []);
            setMeta(result.meta ?? { total: 0, totalPages: 1, page: nextFilters.page });
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được audit log'));
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        const task = window.setTimeout(() => {
            loadLogs();
        }, 0);

        return () => window.clearTimeout(task);
    }, [loadLogs]);

    const updateFilter = (patch) => {
        const next = { ...filters, ...patch, page: patch.page ?? 1 };
        setFilters(next);
        loadLogs(next);
    };

    return (
        <div className={ui.pageStack}>
            <section className={ui.moduleHeader}>
                <div className={ui.moduleHeaderIcon}><FiActivity /></div>
                <div>
                    <p className={ui.eyebrow}>Audit</p>
                    <h2>Audit log</h2>
                    <p>Theo dõi thao tác quan trọng trong hệ thống từ API `/audit-logs`.</p>
                </div>
            </section>

            <section className={styles.toolbarGrid}>
                <label className={ui.field}>Action<select className={styles.select} value={filters.action} onChange={(event) => updateFilter({ action: event.target.value })}>{actions.map((action) => <option key={action} value={action}>{action || 'Tất cả'}</option>)}</select></label>
                <label className={ui.field}>Module<input className={ui.plainInput} value={filters.module} onChange={(event) => setFilters({ ...filters, module: event.target.value })} onBlur={() => updateFilter({ module: filters.module })} placeholder="VD: users, media..." /></label>
                <button className={ui.secondaryButton} type="button" onClick={() => loadLogs()} disabled={isLoading}><FiRefreshCcw /> Tải lại</button>
            </section>

            <section className={ui.tablePanel}>
                <div className={ui.sectionHeading}>
                    <div>
                        <p className={ui.eyebrow}>Nhật ký</p>
                        <h3>{meta.total ?? logs.length} bản ghi</h3>
                    </div>
                </div>
                <div className={ui.responsiveTable}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Thời gian</th>
                                <th>Actor</th>
                                <th>Action</th>
                                <th>Target</th>
                                <th>Dữ liệu mới</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id}>
                                    <td>{fmtDateTime(log.createdAt)}</td>
                                    <td><strong>{log.actor?.fullName ?? 'Hệ thống'}</strong><span>{log.actor?.role ?? '-'}</span></td>
                                    <td><span className={ui.statusPill}>{log.action}</span><span>{log.module}</span></td>
                                    <td>{log.targetType}<span>{log.targetPublicId ?? '-'}</span></td>
                                    <td><pre className={styles.jsonPreview}>{JSON.stringify(log.newValue ?? {}, null, 2)}</pre></td>
                                </tr>
                            ))}
                            {isLoading ? (
                                <tr>
                                    <td className={styles.emptyCell} colSpan={5}>Đang tải nhật ký hệ thống...</td>
                                </tr>
                            ) : null}
                            {!isLoading && logs.length === 0 ? (
                                <tr>
                                    <td className={styles.emptyCell} colSpan={5}>Chưa có nhật ký phù hợp với bộ lọc.</td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}>
                    <span>Trang {meta.page ?? filters.page}/{meta.totalPages ?? 1}</span>
                    <div className={styles.inlineActions}>
                        <button className={ui.secondaryButton} type="button" disabled={(meta.page ?? 1) <= 1} onClick={() => updateFilter({ page: (meta.page ?? 1) - 1 })}>Trước</button>
                        <button className={ui.secondaryButton} type="button" disabled={(meta.page ?? 1) >= (meta.totalPages ?? 1)} onClick={() => updateFilter({ page: (meta.page ?? 1) + 1 })}>Sau</button>
                    </div>
                </div>
            </section>
        </div>
    );
}
