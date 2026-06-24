import classNames from 'classnames/bind';

import styles from '../AdminDashboard.module.scss';

const cx = classNames.bind(styles);

export default function Skeleton({ className = '' }) {
    return <div className={cx('skeleton', className)} />;
}
