import classNames from 'classnames/bind';
import { FiEye, FiLock, FiMoreHorizontal } from 'react-icons/fi';

import { routes } from '~/config/routes';
import { roleLabels, statusLabels } from '../data/adminDashboardMock';
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

export default function RecentUsersTable({ users }) {
    return (
        <SectionCard title="Tài khoản mới tạo" action={<a href={routes.adminUsers}>Xem tất cả</a>}>
            <div className={cx('tableWrap')}>
                <table>
                    <thead>
                        <tr>
                            <th>Người dùng</th>
                            <th>Vai trò</th>
                            <th>Người tạo</th>
                            <th>Ngày tạo</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={`${user.email}-${user.createdAt}`}>
                                <td>
                                    <div className={cx('userCell')}>
                                        <div className={cx('avatar')}>{user.name?.charAt(0)}</div>
                                        <span><strong>{user.name}</strong><small>{user.email}</small></span>
                                    </div>
                                </td>
                                <td>{roleLabels[user.role] || user.role}</td>
                                <td>{user.creator}</td>
                                <td>{formatDate(user.createdAt)}</td>
                                <td><span className={cx('statusBadge', `status${user.status}`)}>{statusLabels[user.status] || user.status}</span></td>
                                <td>
                                    <div className={cx('rowActions')}>
                                        <button type="button"><FiEye /> Xem</button>
                                        <button type="button"><FiLock /> Khóa</button>
                                        <button type="button" aria-label="Thêm thao tác"><FiMoreHorizontal /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </SectionCard>
    );
}
