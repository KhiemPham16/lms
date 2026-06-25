import { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames/bind';
import { useSearchParams } from 'react-router-dom';
import {
    FiActivity,
    FiAlertTriangle,
    FiClock,
    FiCode,
    FiDatabase,
    FiDownload,
    FiEye,
    FiFilter,
    FiHardDrive,
    FiInfo,
    FiRefreshCw,
    FiSearch,
    FiShield,
    FiUser,
    FiX
} from 'react-icons/fi';

import AppSidebar from '~/components/AppSidebar';
import { useAuditLogStore } from '~/stores/useAuditLogStore';
import layoutStyles from '~/pages/FlowWorkbench/FlowWorkbench.module.scss';
import auditStyles from './AuditLogs.module.scss';

const styles = { ...layoutStyles, ...auditStyles };
const cx = classNames.bind(styles);

const actionOptions = [
    'CREATE',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'APPROVE',
    'REJECT',
    'ASSIGN',
    'ENROLL',
    'DROP',
    'SUBMIT',
    'GRADE',
    'STATUS_CHANGE',
    'USER_DEACTIVATED',
    'USER_REACTIVATED',
    'PERMISSION_CHANGE'
];

const moduleOptions = ['users', 'roles', 'courses', 'classes', 'enrollments', 'auth', 'system'];
const targetTypeOptions = ['USER', 'User', 'Role', 'Course', 'Class', 'Enrollment', 'Permission'];

const actionLabels = {
    CREATE: 'Tạo mới',
    UPDATE: 'Cập nhật',
    DELETE: 'Xóa',
    LOGIN: 'Đăng nhập',
    LOGOUT: 'Đăng xuất',
    APPROVE: 'Phê duyệt',
    REJECT: 'Từ chối',
    ASSIGN: 'Gán',
    ENROLL: 'Ghi danh',
    DROP: 'Hủy ghi danh',
    SUBMIT: 'Nộp bài',
    GRADE: 'Chấm điểm',
    STATUS_CHANGE: 'Đổi trạng thái',
    USER_DEACTIVATED: 'Vô hiệu hóa tài khoản',
    USER_REACTIVATED: 'Kích hoạt lại tài khoản',
    PERMISSION_CHANGE: 'Đổi phân quyền'
};

const dangerousActions = new Set(['DELETE', 'REJECT', 'USER_DEACTIVATED']);
const importantActions = new Set(['STATUS_CHANGE', 'PERMISSION_CHANGE', 'USER_REACTIVATED', 'ASSIGN']);

const getLogId = (log) => log?.publicId || `${log?.action}-${log?.createdAt}`;

const formatDateTime = (value) => {
    if (!value) return 'Chưa có dữ liệu';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const formatJson = (value) => {
    if (!value) return 'Không có dữ liệu';
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const getActorName = (log) => log?.actor?.fullName || log?.actor?.email || 'Hệ thống';
const getActorMeta = (log) => [log?.actor?.code, log?.actor?.email].filter(Boolean).join(' · ') || 'Không có thông tin người thực hiện';
const getTargetLabel = (log) => [log?.targetType, log?.targetPublicId || log?.targetId].filter(Boolean).join(' · ') || 'Không có đối tượng';

const getActionTone = (action) => {
    if (dangerousActions.has(action)) return 'danger';
    if (importantActions.has(action)) return 'warning';
    if (action === 'LOGIN' || action === 'LOGOUT') return 'neutral';
    return 'success';
};

const downloadCsv = (logs) => {
    const headers = ['time', 'actor', 'action', 'module', 'targetType', 'targetPublicId', 'ipAddress', 'userAgent'];
    const rows = logs.map((log) => [
        log.createdAt,
        getActorName(log),
        log.action,
        log.module,
        log.targetType,
        log.targetPublicId || log.targetId,
        log.ipAddress,
        log.userAgent
    ]);
    const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell || '').replaceAll('"', '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
};

export default function AdminAuditLogs() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initializedFromUrl = useRef(false);
    const [readyToFetch, setReadyToFetch] = useState(false);
    const {
        logs,
        filters,
        pagination,
        loading,
        error,
        selectedLog,
        fetchLogs,
        setFilters,
        resetFilters,
        setPage,
        setLimit,
        selectLog,
        closeDetail,
        refreshData
    } = useAuditLogStore();

    const queryState = useMemo(() => ({
        ...filters,
        page: pagination.page,
        limit: pagination.limit
    }), [filters, pagination.limit, pagination.page]);

    const summary = useMemo(() => {
        const actorCount = new Set(logs.map((log) => log?.actor?.publicId || log?.actor?.email).filter(Boolean)).size;
        const dangerCount = logs.filter((log) => dangerousActions.has(log.action)).length;
        const moduleCount = new Set(logs.map((log) => log.module).filter(Boolean)).size;

        return {
            total: pagination.total,
            currentPage: logs.length,
            actorCount,
            dangerCount,
            moduleCount
        };
    }, [logs, pagination.total]);

    const activeFilterChips = useMemo(() => {
        const entries = [
            filters.action ? ['Hành động', actionLabels[filters.action] || filters.action, () => setFilters({ action: '' })] : null,
            filters.module ? ['Module', filters.module, () => setFilters({ module: '' })] : null,
            filters.targetType ? ['Đối tượng', filters.targetType, () => setFilters({ targetType: '' })] : null,
            filters.targetPublicId ? ['Target ID', filters.targetPublicId, () => setFilters({ targetPublicId: '' })] : null,
            filters.actorId ? ['Actor ID', filters.actorId, () => setFilters({ actorId: '' })] : null
        ];
        return entries.filter(Boolean);
    }, [filters, setFilters]);

    useEffect(() => {
        if (initializedFromUrl.current) return;
        initializedFromUrl.current = true;
        setFilters({
            action: searchParams.get('action') || '',
            module: searchParams.get('module') || '',
            targetType: searchParams.get('targetType') || '',
            targetPublicId: searchParams.get('targetPublicId') || '',
            actorId: searchParams.get('actorId') || ''
        });
        setLimit(Number(searchParams.get('limit') || 20));
        setPage(Number(searchParams.get('page') || 1));
        setReadyToFetch(true);
    }, [searchParams, setFilters, setLimit, setPage]);

    useEffect(() => {
        if (!readyToFetch) return;
        const nextParams = new URLSearchParams();
        Object.entries(queryState).forEach(([key, value]) => {
            if (value) nextParams.set(key, String(value));
        });
        setSearchParams(nextParams, { replace: true });
        fetchLogs();
    }, [fetchLogs, queryState, readyToFetch, setSearchParams]);

    return (
        <div className={cx('flow-shell')}>
            <AppSidebar workspaceKey="admin" />
            <main className={cx('flow-main', 'audit-logs')}>
                <section className={cx('audit-logs__hero')}>
                    <div>
                        <span>Quản trị hệ thống / Audit Log hệ thống</span>
                        <h1>Audit Log hệ thống</h1>
                        <p>Theo dõi các thao tác quan trọng, người thực hiện, đối tượng bị tác động và dữ liệu trước/sau.</p>
                    </div>
                    <div>
                        <button type="button" onClick={refreshData} disabled={loading}><FiRefreshCw /> Làm mới</button>
                        <button type="button" onClick={() => downloadCsv(logs)} disabled={logs.length === 0}><FiDownload /> Xuất trang hiện tại</button>
                    </div>
                </section>

                <section className={cx('audit-logs__kpis')}>
                    <article><FiDatabase /><strong>{summary.total}</strong><span>Tổng bản ghi</span></article>
                    <article><FiClock /><strong>{summary.currentPage}</strong><span>Đang hiển thị</span></article>
                    <article><FiUser /><strong>{summary.actorCount}</strong><span>Người thực hiện</span></article>
                    <article><FiAlertTriangle /><strong>{summary.dangerCount}</strong><span>Thao tác nhạy cảm</span></article>
                    <article><FiHardDrive /><strong>{summary.moduleCount}</strong><span>Module phát sinh</span></article>
                </section>

                <section className={cx('audit-logs__filters')}>
                    <label className={cx('audit-logs__input')}>
                        <FiSearch />
                        <input
                            value={filters.targetPublicId}
                            onChange={(event) => setFilters({ targetPublicId: event.target.value })}
                            placeholder="Tìm theo targetPublicId"
                        />
                    </label>
                    <select value={filters.action} onChange={(event) => setFilters({ action: event.target.value })}>
                        <option value="">Tất cả hành động</option>
                        {actionOptions.map((action) => <option key={action} value={action}>{actionLabels[action] || action}</option>)}
                    </select>
                    <select value={filters.module} onChange={(event) => setFilters({ module: event.target.value })}>
                        <option value="">Tất cả module</option>
                        {moduleOptions.map((module) => <option key={module} value={module}>{module}</option>)}
                    </select>
                    <select value={filters.targetType} onChange={(event) => setFilters({ targetType: event.target.value })}>
                        <option value="">Tất cả đối tượng</option>
                        {targetTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <input
                        value={filters.actorId}
                        onChange={(event) => setFilters({ actorId: event.target.value })}
                        placeholder="Actor ID"
                    />
                    <button type="button" onClick={resetFilters}><FiFilter /> Xóa bộ lọc</button>
                </section>

                {activeFilterChips.length > 0 && (
                    <section className={cx('audit-logs__chips')}>
                        {activeFilterChips.map(([label, value, onRemove]) => (
                            <button key={`${label}-${value}`} type="button" onClick={onRemove}>
                                <strong>{label}:</strong> {value} <FiX />
                            </button>
                        ))}
                    </section>
                )}

                <section className={cx('audit-logs__panel')}>
                    {loading && (
                        <div className={cx('audit-logs__skeleton')}>
                            {Array.from({ length: 6 }).map((_, index) => <span key={index} />)}
                        </div>
                    )}

                    {!loading && error && (
                        <div className={cx('audit-logs__empty')}>
                            <FiAlertTriangle />
                            <h2>Không thể tải Audit Log</h2>
                            <p>{error}</p>
                            <button type="button" onClick={() => fetchLogs()}>Thử lại</button>
                        </div>
                    )}

                    {!loading && !error && logs.length === 0 && (
                        <div className={cx('audit-logs__empty')}>
                            <FiInfo />
                            <h2>Chưa có bản ghi phù hợp</h2>
                            <p>Thử xóa bộ lọc hoặc kiểm tra lại quyền xem Audit Log.</p>
                        </div>
                    )}

                    {!loading && !error && logs.length > 0 && (
                        <>
                            <div className={cx('audit-logs__table')}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Thời gian</th>
                                            <th>Hành động</th>
                                            <th>Người thực hiện</th>
                                            <th>Module</th>
                                            <th>Đối tượng</th>
                                            <th>IP</th>
                                            <th>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((log) => (
                                            <tr key={getLogId(log)}>
                                                <td>
                                                    <strong>{formatDateTime(log.createdAt)}</strong>
                                                    <small>{log.publicId}</small>
                                                </td>
                                                <td>
                                                    <span className={cx('audit-logs__badge', `is-${getActionTone(log.action)}`)}>
                                                        {actionLabels[log.action] || log.action}
                                                    </span>
                                                    <small>{log.action}</small>
                                                </td>
                                                <td>
                                                    <strong>{getActorName(log)}</strong>
                                                    <small>{getActorMeta(log)}</small>
                                                </td>
                                                <td><span className={cx('audit-logs__module')}>{log.module || '-'}</span></td>
                                                <td>
                                                    <strong>{getTargetLabel(log)}</strong>
                                                    <small>{log.targetPublicId || log.targetId || '-'}</small>
                                                </td>
                                                <td>{log.ipAddress || '-'}</td>
                                                <td>
                                                    <button type="button" onClick={() => selectLog(log)}><FiEye /> Chi tiết</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className={cx('audit-logs__cards')}>
                                {logs.map((log) => (
                                    <article key={`card-${getLogId(log)}`}>
                                        <header>
                                            <span className={cx('audit-logs__badge', `is-${getActionTone(log.action)}`)}>
                                                {actionLabels[log.action] || log.action}
                                            </span>
                                            <small>{formatDateTime(log.createdAt)}</small>
                                        </header>
                                        <h3>{getTargetLabel(log)}</h3>
                                        <p>{getActorName(log)} · {log.module || '-'}</p>
                                        <button type="button" onClick={() => selectLog(log)}><FiEye /> Xem chi tiết</button>
                                    </article>
                                ))}
                            </div>
                        </>
                    )}
                </section>

                <section className={cx('audit-logs__pagination')}>
                    <span>
                        Trang {pagination.page}/{pagination.totalPages} · {pagination.total} bản ghi
                    </span>
                    <select value={pagination.limit} onChange={(event) => setLimit(Number(event.target.value))}>
                        {[10, 20, 50, 100].map((limit) => <option key={limit} value={limit}>{limit}/trang</option>)}
                    </select>
                    <button type="button" onClick={() => setPage(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1}>Trước</button>
                    <button type="button" onClick={() => setPage(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages}>Sau</button>
                </section>

                {selectedLog && (
                    <aside className={cx('audit-logs__drawer')} aria-label="Chi tiết Audit Log">
                        <div>
                            <header>
                                <div>
                                    <span>Audit detail</span>
                                    <h2>{actionLabels[selectedLog.action] || selectedLog.action}</h2>
                                    <p>{formatDateTime(selectedLog.createdAt)}</p>
                                </div>
                                <button type="button" onClick={closeDetail} aria-label="Đóng"><FiX /></button>
                            </header>

                            <section>
                                <h3><FiActivity /> Tổng quan</h3>
                                <dl>
                                    <div><dt>Public ID</dt><dd>{selectedLog.publicId}</dd></div>
                                    <div><dt>Action</dt><dd>{selectedLog.action}</dd></div>
                                    <div><dt>Module</dt><dd>{selectedLog.module || '-'}</dd></div>
                                    <div><dt>Target</dt><dd>{getTargetLabel(selectedLog)}</dd></div>
                                    <div><dt>IP</dt><dd>{selectedLog.ipAddress || '-'}</dd></div>
                                    <div><dt>User Agent</dt><dd>{selectedLog.userAgent || '-'}</dd></div>
                                </dl>
                            </section>

                            <section>
                                <h3><FiShield /> Người thực hiện</h3>
                                <dl>
                                    <div><dt>Họ tên</dt><dd>{getActorName(selectedLog)}</dd></div>
                                    <div><dt>Email</dt><dd>{selectedLog.actor?.email || '-'}</dd></div>
                                    <div><dt>Mã người dùng</dt><dd>{selectedLog.actor?.code || '-'}</dd></div>
                                    <div><dt>Public ID</dt><dd>{selectedLog.actor?.publicId || '-'}</dd></div>
                                </dl>
                            </section>

                            <section className={cx('audit-logs__json-grid')}>
                                <article>
                                    <h3><FiCode /> Dữ liệu trước</h3>
                                    <pre>{formatJson(selectedLog.oldValue)}</pre>
                                </article>
                                <article>
                                    <h3><FiCode /> Dữ liệu sau</h3>
                                    <pre>{formatJson(selectedLog.newValue)}</pre>
                                </article>
                            </section>
                        </div>
                    </aside>
                )}
            </main>
        </div>
    );
}
