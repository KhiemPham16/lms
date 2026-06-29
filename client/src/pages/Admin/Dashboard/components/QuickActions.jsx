import { useNavigate } from 'react-router-dom';
import classNames from 'classnames/bind';

import { quickActions } from '../data/adminDashboardMock';
import { useAuthStore } from '~/stores/useAuthStore';
import { userHasBackendPermission } from '~/utils/permissions';
import styles from '../AdminDashboard.module.scss';
import SectionCard from './SectionCard';

const cx = classNames.bind(styles);

const actionPermissions = {
    'create-hr': 'users.create',
    'create-principal': 'users.create',
    users: 'users.read',
    permissions: 'system.permissions.manage',
    audit: 'system.audit.read'
};

export default function QuickActions({ onCreate }) {
    const navigate = useNavigate();
    const currentUser = useAuthStore((state) => state.user);
    const visibleActions = quickActions.filter((action) =>
        userHasBackendPermission(currentUser, actionPermissions[action.key])
    );

    if (visibleActions.length === 0) {
        return null;
    }

    return (
        <SectionCard title="Thao tác nhanh">
            <div className={cx('quickGrid')}>
                {visibleActions.map((action) => {
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
