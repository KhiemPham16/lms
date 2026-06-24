import classNames from 'classnames/bind';

import styles from '../AdminDashboard.module.scss';

const cx = classNames.bind(styles);

export default function SectionCard({ title, action, children, className = '' }) {
    return (
        <section className={cx('card', className)}>
            <div className={cx('cardHeader')}>
                <h2>{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}
