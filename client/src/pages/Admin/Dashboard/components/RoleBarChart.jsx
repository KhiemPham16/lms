import classNames from 'classnames/bind';

import { formatNumber } from '~/utils/formatNumber';

import styles from '../AdminDashboard.module.scss';

const cx = classNames.bind(styles);

export default function RoleBarChart({ data }) {
    const max = Math.max(...data.map((item) => item.value), 1);

    return (
        <div className={cx('barChart')}>
            {data.map((item) => (
                <div className={cx('barItem')} key={item.key}>
                    <span>{formatNumber(item.value)}</span>
                    <div title={`${item.label}: ${item.value}`}>
                        <i style={{ height: `${Math.max((item.value / max) * 100, 4)}%` }} />
                    </div>
                    <small>{item.label}</small>
                </div>
            ))}
        </div>
    );
}
