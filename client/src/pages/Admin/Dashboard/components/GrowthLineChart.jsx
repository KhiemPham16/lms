import classNames from 'classnames/bind';

import styles from '../AdminDashboard.module.scss';

const cx = classNames.bind(styles);

export default function GrowthLineChart({ data }) {
    const max = Math.max(...data.map((item) => item.value), 1);
    const width = 640;
    const height = 210;
    const points = data.map((item, index) => {
        const x = (index / (data.length - 1 || 1)) * width;
        const y = height - (item.value / max) * (height - 24) - 8;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className={cx('lineChart')}>
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tăng trưởng tài khoản">
                <polyline points={points} />
                {data.map((item, index) => {
                    const x = (index / (data.length - 1 || 1)) * width;
                    const y = height - (item.value / max) * (height - 24) - 8;
                    return <circle key={item.label} cx={x} cy={y} r="5"><title>{`${item.label}: ${item.value}`}</title></circle>;
                })}
            </svg>
            <div className={cx('axisLabels')}>
                {data.map((item) => <span key={item.label}>{item.label}</span>)}
            </div>
        </div>
    );
}
