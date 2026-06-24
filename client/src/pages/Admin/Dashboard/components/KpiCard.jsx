import classNames from 'classnames/bind';

import { formatNumber } from '~/utils/formatNumber';

import styles from '../AdminDashboard.module.scss';
import Skeleton from './Skeleton';

const cx = classNames.bind(styles);

export default function KpiCard({ item, loading }) {
    const Icon = item.icon;

    return (
        <button type="button" className={cx('kpiCard')}>
            {loading ? (
                <>
                    <Skeleton />
                    <Skeleton />
                </>
            ) : (
                <>
                    <div className={cx('kpiIcon')}><Icon /></div>
                    <span>{item.label}</span>
                    <strong>{formatNumber(item.value)}</strong>
                    <small className={cx(item.danger ? 'negative' : 'positive')}>{item.hint}</small>
                </>
            )}
        </button>
    );
}
