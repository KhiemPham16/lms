import classNames from 'classnames/bind';

import { formatNumber } from '~/utils/formatNumber';

import styles from '../AdminDashboard.module.scss';

const cx = classNames.bind(styles);

export default function StatusDonutChart({ data }) {
    const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
    let offset = 25;

    return (
        <div className={cx('donutWrap')}>
            <div className={cx('donut')}>
                <svg viewBox="0 0 44 44">
                    {data.map((item) => {
                        const value = (item.value / total) * 100;
                        const segment = (
                            <circle
                                key={item.key}
                                cx="22"
                                cy="22"
                                r="15.9"
                                fill="transparent"
                                stroke={item.color}
                                strokeWidth="6"
                                strokeDasharray={`${value} ${100 - value}`}
                                strokeDashoffset={offset}
                            />
                        );
                        offset -= value;
                        return segment;
                    })}
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
