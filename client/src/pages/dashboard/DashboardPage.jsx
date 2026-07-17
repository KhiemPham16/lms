import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiArrowRight, FiRefreshCcw } from 'react-icons/fi';
import { Link } from 'react-router-dom';

import { apiClient, getApiMessage } from '~/shared/api/http.js';
import { moduleMeta, roleNavigation } from '~/shared/constants/modules.js';
import { roleLabels } from '~/shared/constants/roles.js';
import ui from '~/shared/styles/ui.module.scss';
import { useAuthStore } from '~/shared/store/authStore.js';
import styles from './DashboardPage.module.scss';

const metricToneClass = {
    blue: styles.metricCardBlue,
    amber: styles.metricCardAmber,
    green: styles.metricCardGreen,
    slate: styles.metricCardSlate
};

const chartColors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#475569'];

const formatNumber = (value) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value) || 0);

const formatDateTime = (value) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
};

function PercentageRing({ value }) {
    const percentage = Math.min(100, Math.max(0, Number(value) || 0));

    return (
        <div className={styles.percentageRing} role="img" aria-label={`${formatNumber(percentage)} phần trăm`}>
            <svg viewBox="0 0 44 44" aria-hidden="true">
                <circle className={styles.percentageRingTrack} cx="22" cy="22" r="18" />
                <circle
                    className={styles.percentageRingValue}
                    cx="22"
                    cy="22"
                    r="18"
                    pathLength="100"
                    strokeDasharray={`${percentage} ${100 - percentage}`}
                />
            </svg>
            <strong>{formatNumber(percentage)}%</strong>
        </div>
    );
}

function DonutChart({ items, title }) {
    const total = items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const percentages = items.map((item) => total ? ((Number(item.value) || 0) / total) * 100 : 0);
    const segments = items.map((item, index) => ({
        ...item,
        percentage: percentages[index],
        offset: percentages.slice(0, index).reduce((sum, percentage) => sum + percentage, 0),
        color: chartColors[index % chartColors.length]
    }));

    return (
        <div className={styles.donutLayout}>
            <div className={styles.donutChart} role="img" aria-label={`${title}: ${total} tổng`}>
                <svg viewBox="0 0 44 44" aria-hidden="true">
                    <circle className={styles.donutTrack} cx="22" cy="22" r="17" />
                    {segments.map((segment) => segment.percentage > 0 ? (
                        <circle
                            key={segment.key}
                            className={styles.donutSegment}
                            cx="22"
                            cy="22"
                            r="17"
                            pathLength="100"
                            stroke={segment.color}
                            strokeDasharray={`${segment.percentage} ${100 - segment.percentage}`}
                            strokeDashoffset={-segment.offset}
                        />
                    ) : null)}
                </svg>
                <div><strong>{formatNumber(total)}</strong><span>Tổng</span></div>
            </div>
            <div className={styles.chartLegend}>
                {segments.map((segment) => (
                    <div key={segment.key}>
                        <i style={{ backgroundColor: segment.color }} />
                        <span>{segment.label}</span>
                        <strong>{formatNumber(segment.value)}</strong>
                        <small>{formatNumber(segment.percentage)}%</small>
                        {segment.secondaryLabel ? <em>+{formatNumber(segment.secondaryValue)} {segment.secondaryLabel}</em> : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

function BarChart({ items, title }) {
    const maxValue = Math.max(1, ...items.map((item) => Number(item.value) || 0));

    return (
        <div className={styles.barChart} role="img" aria-label={title}>
            {items.map((item, index) => {
                const height = ((Number(item.value) || 0) / maxValue) * 100;
                return (
                    <div className={styles.barColumn} key={item.key}>
                        <strong>{formatNumber(item.value)}</strong>
                        <div className={styles.barTrack}>
                            <span style={{ height: `${Math.max(2, height)}%`, backgroundColor: chartColors[index % chartColors.length] }} />
                        </div>
                        <small>{item.label}</small>
                    </div>
                );
            })}
        </div>
    );
}

export function DashboardPage({ roleScope }) {
    const user = useAuthStore((state) => state.user);
    const role = roleScope ?? user?.role;
    const [dashboard, setDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const modules = useMemo(
        () => (roleNavigation[role] ?? ['dashboard'])
            .map((key) => moduleMeta[key])
            .filter((module) => module && module.path !== '/dashboard'),
        [role]
    );

    const loadDashboard = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const response = await apiClient.get('/dashboard');
            setDashboard(response.data?.data ?? response.data);
        } catch (error) {
            setErrorMessage(getApiMessage(error, 'Không thể tải dữ liệu dashboard'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const task = window.setTimeout(loadDashboard, 0);
        return () => window.clearTimeout(task);
    }, [loadDashboard]);

    return (
        <div className={ui.pageStack}>
            <section className={styles.heroBand}>
                <div>
                    <p className={ui.eyebrow}>{roleLabels[role] ?? 'Bảng điều khiển'}</p>
                    <h2>Xin chào, {user?.fullName ?? 'người dùng'}.</h2>
                    <p className={styles.heroDescription}>{dashboard?.subtitle ?? 'Dữ liệu tổng quan đang được cập nhật.'}</p>
                </div>
                <div className={styles.heroActions}>
                    <button className={ui.secondaryButton} type="button" onClick={loadDashboard} disabled={isLoading}>
                        <FiRefreshCcw className={isLoading ? styles.spinningIcon : undefined} /> Làm mới
                    </button>
                    <Link className={ui.secondaryButton} to="/profile">
                        Xem hồ sơ <FiArrowRight />
                    </Link>
                </div>
            </section>

            {errorMessage ? (
                <section className={styles.errorPanel}>
                    <strong>Không tải được dashboard</strong>
                    <span>{errorMessage}</span>
                    <button className={ui.secondaryButton} type="button" onClick={loadDashboard}>Thử lại</button>
                </section>
            ) : null}

            {dashboard?.warning ? <section className={styles.warningPanel}>{dashboard.warning}</section> : null}

            {isLoading && !dashboard ? (
                <section className={styles.loadingPanel}> Đang tổng hợp dữ liệu thời gian thực...</section>
            ) : null}

            {dashboard?.metrics?.length ? (
                <section className={styles.metricGrid} aria-label={dashboard.title}>
                    {dashboard.metrics.map((metric) => (
                        <article className={classNames(styles.metricCard, metric.suffix === '%' && styles.percentageMetricCard, metricToneClass[metric.tone] ?? styles.metricCardSlate)} key={metric.key}>
                            <span>{metric.label}</span>
                            {metric.suffix === '%' ? <PercentageRing value={metric.value} /> : <strong>{formatNumber(metric.value)}{metric.suffix ?? ''}</strong>}
                            {metric.detail ? <small>{metric.detail}</small> : null}
                        </article>
                    ))}
                </section>
            ) : null}

            {dashboard?.breakdowns?.length ? (
                <section className={styles.analyticsGrid}>
                    {dashboard.breakdowns.map((breakdown) => (
                            <article className={styles.analyticsCard} key={breakdown.key}>
                                <div className={styles.analyticsHeading}>
                                    <h3>{breakdown.title}</h3>
                                    <span>{breakdown.items.reduce((sum, item) => sum + (Number(item.value) || 0), 0)} tổng</span>
                                </div>
                                {breakdown.items.length
                                    ? breakdown.key === 'grades'
                                        ? <BarChart items={breakdown.items} title={breakdown.title} />
                                        : <DonutChart items={breakdown.items} title={breakdown.title} />
                                    : <p className={styles.emptyText}>Chưa có dữ liệu.</p>}
                            </article>
                    ))}
                </section>
            ) : null}

            {dashboard?.activity ? (
                <section className={styles.activityCard}>
                    <div className={styles.analyticsHeading}>
                        <h3>{dashboard.activity.title}</h3>
                        {dashboard.generatedAt ? <span>Cập nhật {formatDateTime(dashboard.generatedAt)}</span> : null}
                    </div>
                    <div className={styles.activityList}>
                        {dashboard.activity.items.map((item, index) => (
                            <div className={styles.activityItem} key={`${item.label}-${item.timestamp}-${index}`}>
                                <span className={styles.activityDot} />
                                <div>
                                    <strong>{item.label}</strong>
                                    <span>{item.detail}</span>
                                </div>
                                <time>{formatDateTime(item.timestamp)}</time>
                            </div>
                        ))}
                        {!dashboard.activity.items.length ? <p className={styles.emptyText}>Chưa có hoạt động gần đây.</p> : null}
                    </div>
                </section>
            ) : null}

            <section className={ui.sectionBlock}>
                <div className={ui.sectionHeading}>
                    <div>
                        <p className={ui.eyebrow}>Module theo vai trò</p>
                        <h3>Chức năng ưu tiên</h3>
                    </div>
                </div>
                <div className={styles.moduleGrid}>
                    {modules.map((module) => {
                        const Icon = module.icon;
                        return (
                            <Link className={styles.moduleCard} to={module.path} key={module.path}>
                                <Icon />
                                <strong>{module.label}</strong>
                                <span>{module.description}</span>
                            </Link>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
