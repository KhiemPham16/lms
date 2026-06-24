import classNames from 'classnames/bind';

import styles from '../AdminDashboard.module.scss';
import SectionCard from './SectionCard';

const cx = classNames.bind(styles);

export default function ServiceStatus({ services }) {
    return (
        <SectionCard title="Trạng thái dịch vụ">
            <div className={cx('serviceList')}>
                {services.map((service) => {
                    const Icon = service.icon;
                    return (
                        <article key={service.name}>
                            <Icon />
                            <div>
                                <strong>{service.name}</strong>
                                <small>{service.response}</small>
                            </div>
                            <span className={cx(`service${service.status}`)}>{service.status}</span>
                        </article>
                    );
                })}
            </div>
        </SectionCard>
    );
}
