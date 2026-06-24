import classNames from 'classnames/bind';

import { formatNumber } from '~/utils/formatNumber';

import styles from '../AdminDashboard.module.scss';

const cx = classNames.bind(styles);

export default function StatusDonutChart({ data }) {
    const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
    const segments = data.reduce((result, item) => {
        const value = (item.value / total) * 100;
        const previousOffset = result.at(-1)?.nextOffset ?? 25;

        return [
            ...result,
            {
                ...item,
                value,
                offset: previousOffset,
                nextOffset: previousOffset - value
            }
        ];
    }, []);

    return (
        <div className={cx('donutWrap')}>
            <div className={cx('donut')}>
                <svg viewBox="0 0 44 44">
                    {segments.map((item) => (
                        <circle
                            key={item.key}
                            cx="22"
                            cy="22"
                            r="15.9"
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth="6"
                            strokeDasharray={`${item.value} ${100 - item.value}`}
                            strokeDashoffset={item.offset}
                        />
                    ))}
                </svg>
                <strong>{formatNumber(total)}</strong>
                <span>Tài khoản</span>
            </div>
            <div className={cx('legend')}>
                {data.map((item) => (
                    <button type="button" key={item.key}>
                        <i style={{ background: item.color }} />
                        <span>{item.label}</span>
                        <strong>{Math.round((item.value / total) * 100)}%</strong>
                    </button>
                ))}
            </div>
        </div>
    );
}
