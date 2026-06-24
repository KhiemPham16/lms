import { useNavigate } from 'react-router-dom';
import classNames from 'classnames/bind';

import { quickActions } from '../data/adminDashboardMock';
import styles from '../AdminDashboard.module.scss';
import SectionCard from './SectionCard';

const cx = classNames.bind(styles);

export default function QuickActions({ onCreate }) {
    const navigate = useNavigate();

    return (
        <SectionCard title="Thao tác nhanh">
            <div className={cx('quickGrid')}>
                {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                        <button
                            type="button"
                            key={action.key}
                            onClick={() => action.role ? onCreate(action.role) : navigate(action.path)}
                        >
                            <Icon />
                            <strong>{action.title}</strong>
                            <span>{action.description}</span>
                        </button>
                    );
                })}
            </div>
        </SectionCard>
    );
}
