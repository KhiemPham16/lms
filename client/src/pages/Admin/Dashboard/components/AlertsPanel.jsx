import classNames from 'classnames/bind';

import styles from '../AdminDashboard.module.scss';
import SectionCard from './SectionCard';

const cx = classNames.bind(styles);

export default function AlertsPanel({ alerts }) {
    return (
        <SectionCard title="Cảnh báo cần xử lý">
            <div className={cx('alertList')}>
                {alerts.map((alert) => {
                    const Icon = alert.icon;
                    return (
                        <article key={`${alert.title}-${alert.time}`} className={cx(alert.level)}>
                            <Icon />
                            <div>
                                <strong>{alert.title}</strong>
                                <span>{alert.message}</span>
                                <small>{alert.time}</small>
                            </div>
                            <button type="button">Xem chi tiết</button>
                        </article>
                    );
                })}
            </div>
        </SectionCard>
    );
}
