import classNames from 'classnames/bind';

import styles from '../AdminDashboard.module.scss';
import SectionCard from './SectionCard';

const cx = classNames.bind(styles);

const formatDate = (value) => {
    if (!value) return 'Hôm nay';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

export default function ActivityTimeline({ activities }) {
    return (
        <SectionCard title="Hoạt động gần đây">
            <div className={cx('timeline')}>
                {activities.map((activity) => (
                    <article key={`${activity.actor}-${activity.time}`}>
                        <i className={cx(activity.success ? 'successDot' : 'failDot')} />
                        <div>
                            <strong>{activity.actor}</strong>
                            <p>{activity.action} <b>{activity.target}</b></p>
                            <small>{formatDate(activity.time)}</small>
                        </div>
                    </article>
                ))}
            </div>
        </SectionCard>
    );
}
